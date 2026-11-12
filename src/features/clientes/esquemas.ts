import { z } from 'zod'

import type { Database } from '@/lib/database.types'
import { cnpjValido, cpfValido, limparDocumento, soNumeros, telefoneValido } from '@/lib/documentos'
import { UNIDADE } from '@/lib/unidade'

/*
 * Regras dos formulários de clientes (o que é obrigatório, o que é válido)
 * e a conversão do que foi digitado para o formato do banco.
 */

export type Canal = Database['public']['Enums']['canal_atendimento']

export const CANAIS: { valor: Canal; rotulo: string }[] = [
  { valor: 'whatsapp', rotulo: 'WhatsApp' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'presencial', rotulo: 'Presencial' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const ORIGENS = ['Site', 'Indicação', 'Google', 'Instagram', 'Já era cliente', 'Outro']

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] // prettier-ignore

const textoOpcional = z.string().trim()

const telefoneOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || telefoneValido(v), 'Informe o DDD e o número (10 ou 11 dígitos).')

const emailOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || z.email().safeParse(v).success, 'E-mail inválido.')

/** Lista de campos repetidos (useFieldArray do formulário precisa de objetos). */
const listaDe = <T extends z.ZodType<string, string>>(campo: T) =>
  z.array(z.object({ valor: campo }))

/** Campo vazio vira null no banco. */
function ouNulo(valor: string): string | null {
  const v = valor.trim()
  return v === '' ? null : v
}

// -----------------------------------------------------------------------------
// Endereço
// -----------------------------------------------------------------------------

export const esquemaEndereco = z.object({
  apelido: textoOpcional,
  cep: z
    .string()
    .trim()
    .refine((v) => v === '' || soNumeros(v).length === 8, 'O CEP tem 8 números.'),
  logradouro: z.string().trim().min(2, 'Informe a rua.'),
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cidade: z.string().trim().min(2, 'Informe a cidade.'),
  uf: z.enum(UFS as [string, ...string[]], 'Escolha o estado.'),
  principal: z.boolean(),
  // Preenchido pelo CEP (ViaCEP); não aparece na tela.
  codigo_ibge: z.string(),
})

export type FormEndereco = z.infer<typeof esquemaEndereco>

export const ENDERECO_VAZIO: FormEndereco = {
  apelido: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: UNIDADE.cidade,
  uf: UNIDADE.uf,
  principal: false,
  codigo_ibge: '',
}

export function enderecoParaBanco(f: FormEndereco) {
  return {
    apelido: ouNulo(f.apelido),
    cep: ouNulo(soNumeros(f.cep)),
    logradouro: f.logradouro.trim(),
    numero: ouNulo(f.numero),
    complemento: ouNulo(f.complemento),
    bairro: ouNulo(f.bairro),
    cidade: f.cidade.trim(),
    uf: f.uf,
    principal: f.principal,
    codigo_ibge: /^\d{7}$/.test(f.codigo_ibge) ? f.codigo_ibge : null,
  }
}

// -----------------------------------------------------------------------------
// Cliente
// -----------------------------------------------------------------------------

export const esquemaCliente = z
  .object({
    tipo_pessoa: z.enum(['PF', 'PJ']),
    nome: z.string().trim().min(2, 'Informe o nome.'),
    nome_fantasia: textoOpcional,
    cpf_cnpj: textoOpcional,
    inscricao_estadual: textoOpcional,
    email: emailOpcional,
    emails_extras: listaDe(emailOpcional),
    // Marcado: nota e boleto vão só para estes; certificado e OS, só para os de cima.
    separar_financeiro: z.boolean(),
    emails_financeiro: listaDe(emailOpcional),
    telefone: telefoneOpcional,
    telefones_extras: listaDe(telefoneOpcional),
    whatsapp: telefoneOpcional,
    vendedor_responsavel_id: z.string(),
    origem: textoOpcional,
    observacoes: textoOpcional,
  })
  .superRefine((d, ctx) => {
    if (d.separar_financeiro && !d.emails_financeiro.some((e) => e.valor.trim())) {
      ctx.addIssue({
        code: 'custom',
        path: ['emails_financeiro'],
        message: 'Informe o e-mail que recebe a nota e o boleto (ou desmarque a opção).',
      })
    }
    if (d.cpf_cnpj === '') return
    const valido = d.tipo_pessoa === 'PF' ? cpfValido(d.cpf_cnpj) : cnpjValido(d.cpf_cnpj)
    if (!valido) {
      ctx.addIssue({
        code: 'custom',
        path: ['cpf_cnpj'],
        message: d.tipo_pessoa === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.',
      })
    }
  })

export type FormCliente = z.infer<typeof esquemaCliente>

export const CLIENTE_VAZIO: FormCliente = {
  tipo_pessoa: 'PJ',
  nome: '',
  nome_fantasia: '',
  cpf_cnpj: '',
  inscricao_estadual: '',
  email: '',
  emails_extras: [],
  separar_financeiro: false,
  emails_financeiro: [],
  telefone: '',
  telefones_extras: [],
  whatsapp: '',
  vendedor_responsavel_id: '',
  origem: '',
  observacoes: '',
}

/**
 * O primeiro e-mail (ou telefone) preenchido vira o principal; os outros vão para a
 * lista de extras, sem vazios e sem repetidos.
 */
function principalEExtras(valores: string[]): [string | null, string[]] {
  const unicos = [...new Set(valores.map((v) => v.trim()).filter(Boolean))]
  return [unicos[0] ?? null, unicos.slice(1)]
}

export function clienteParaBanco(f: FormCliente) {
  const pj = f.tipo_pessoa === 'PJ'
  const [email, emails_extras] = principalEExtras(
    [f.email, ...f.emails_extras.map((e) => e.valor)].map((e) => e.toLowerCase()),
  )
  const [telefone, telefones_extras] = principalEExtras(
    [f.telefone, ...f.telefones_extras.map((t) => t.valor)].map(soNumeros),
  )
  return {
    tipo_pessoa: f.tipo_pessoa,
    nome: f.nome.trim(),
    nome_fantasia: pj ? ouNulo(f.nome_fantasia) : null,
    cpf_cnpj: ouNulo(limparDocumento(f.cpf_cnpj)),
    inscricao_estadual: pj ? ouNulo(f.inscricao_estadual) : null,
    email,
    emails_extras,
    emails_financeiro: f.separar_financeiro
      ? [...new Set(f.emails_financeiro.map((e) => e.valor.trim().toLowerCase()).filter(Boolean))]
      : [],
    telefone,
    telefones_extras,
    whatsapp: ouNulo(soNumeros(f.whatsapp)),
    vendedor_responsavel_id: ouNulo(f.vendedor_responsavel_id),
    origem: ouNulo(f.origem),
    observacoes: ouNulo(f.observacoes),
  }
}

// -----------------------------------------------------------------------------
// Contato
// -----------------------------------------------------------------------------

export const esquemaContato = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  cargo: textoOpcional,
  telefone: telefoneOpcional,
  email: emailOpcional,
  principal: z.boolean(),
  observacoes: textoOpcional,
})

export type FormContato = z.infer<typeof esquemaContato>

export function contatoParaBanco(f: FormContato) {
  return {
    nome: f.nome.trim(),
    cargo: ouNulo(f.cargo),
    telefone: ouNulo(soNumeros(f.telefone)),
    email: ouNulo(f.email.toLowerCase()),
    principal: f.principal,
    observacoes: ouNulo(f.observacoes),
  }
}

// -----------------------------------------------------------------------------
// Atendimento
// -----------------------------------------------------------------------------

export const esquemaAtendimento = z.object({
  canal: z.enum(['telefone', 'whatsapp', 'presencial', 'email', 'outro']),
  data_hora: z.string().min(1, 'Informe a data e a hora.'),
  resumo: z.string().trim().min(2, 'Descreva o atendimento.'),
})

export type FormAtendimento = z.infer<typeof esquemaAtendimento>
