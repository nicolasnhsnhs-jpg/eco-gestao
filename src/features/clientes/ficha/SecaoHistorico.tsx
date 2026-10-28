import { History } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { formatarCep, formatarDocumento, formatarTelefone } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'

import {
  NOME_FORMA,
  NOME_SITUACAO,
  type FormaPagamento,
  type Situacao,
} from '../../financeiro/rotulos'
import { useEquipe, useHistoricoCliente, type RegistroAuditoria } from '../api'
import { CANAIS } from '../esquemas'
import { Secao, Vazio } from './Secao'

const NOME_CANAL: Record<string, string> = Object.fromEntries(
  CANAIS.map((c) => [c.valor, c.rotulo]),
)

const NOME_TABELA: Record<string, string> = {
  clientes: 'Cadastro',
  enderecos: 'Endereço',
  contatos_cliente: 'Contato',
  atendimentos: 'Atendimento',
  lancamentos: 'Lançamento',
  propostas: 'Proposta',
  arquivos: 'Arquivo',
  servicos: 'Serviço',
  vencimentos_servico: 'Vencimento',
  contratos: 'Contrato',
}

const NOME_ACAO: Record<string, string> = {
  insert: 'criou',
  update: 'alterou',
  delete: 'removeu',
}

const NOME_CAMPO: Record<string, string> = {
  nome: 'Nome',
  nome_fantasia: 'Nome fantasia',
  cpf_cnpj: 'CPF/CNPJ',
  inscricao_estadual: 'Inscrição estadual',
  email: 'E-mail',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  vendedor_responsavel_id: 'Vendedor responsável',
  origem: 'Origem',
  observacoes: 'Observações',
  ativo: 'Ativo',
  apelido: 'Identificação',
  cep: 'CEP',
  logradouro: 'Rua',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
  principal: 'Principal',
  cargo: 'Cargo',
  canal: 'Canal',
  resumo: 'Resumo',
  data_hora: 'Data',
  tipo_pessoa: 'Tipo',
  descricao: 'Descrição',
  valor: 'Valor',
  valor_pago: 'Valor pago',
  vencimento: 'Vencimento',
  competencia: 'Competência',
  data_pagamento: 'Data do pagamento',
  status: 'Situação',
  forma_pagamento: 'Forma',
  numero_nota_fiscal: 'Nota fiscal',
  tipo: 'Tipo',
  valor_total: 'Valor total',
  data_envio: 'Enviada em',
  validade: 'Validade',
  data_resposta: 'Respondida em',
  motivo_recusa: 'Motivo da recusa',
  prazo_pagamento_dias: 'Prazo (dias)',
  condicao_pagamento: 'Condição de pagamento',
  nome_original: 'Arquivo',
  categoria: 'Categoria',
  data_execucao: 'Data do serviço',
  numero_certificado: 'Nº do certificado',
  tecnicos: 'Técnicos',
  periodicidade_meses: 'Repetir a cada (meses)',
  antecedencia_aviso_dias: 'Avisar dias antes',
  data_ultimo_servico: 'Último serviço',
  valor_mensal: 'Valor mensal',
  dia_util_cobranca: 'Dia útil de cobrança',
  data_inicio: 'Início',
  data_fim: 'Fim',
}

const CAMPOS_TECNICOS = new Set([
  'id',
  'cliente_id',
  'usuario_id',
  'criado_em',
  'criado_por',
  'atualizado_em',
  'atualizado_por',
  'anonimizado_em',
  'categoria_id',
  'conta_bancaria_id',
  'fornecedor_id',
  'grupo_parcelamento_id',
  'parcela_numero',
  'parcela_total',
  'confirmado_por',
  'confirmado_em',
  'vendedor_id',
  'endereco_id',
  'proposta_id',
  'lancamento_id',
  'caminho_storage',
  'tipo_mime',
  'tamanho_bytes',
  'enviado_por',
  'descricao_arquivo',
  'servico_id',
  'tipo_servico_id',
  'ultimo_servico_id',
  'proxima_data',
  'contrato_id',
])

type Mudanca = { campo: string; antes: unknown; depois: unknown }

function mudancas(r: RegistroAuditoria): Mudanca[] {
  const antes = (r.dados_antes ?? {}) as Record<string, unknown>
  const depois = (r.dados_depois ?? {}) as Record<string, unknown>
  const campos = new Set([...Object.keys(antes), ...Object.keys(depois)])
  return [...campos]
    .filter((c) => !CAMPOS_TECNICOS.has(c))
    .filter((c) => r.acao !== 'update' || JSON.stringify(antes[c]) !== JSON.stringify(depois[c]))
    .filter((c) => r.acao === 'update' || (depois[c] ?? antes[c]) != null)
    .map((c) => ({ campo: c, antes: antes[c], depois: depois[c] }))
}

/** Histórico de alterações (auditoria). Visível só para Admin e Financeiro. */
export function SecaoHistorico({ clienteId }: { clienteId: string }) {
  const [aberto, setAberto] = useState(false)
  const historico = useHistoricoCliente(clienteId, aberto)
  const equipe = useEquipe()
  const nomeDe = (id: unknown) =>
    equipe.data?.find((p) => p.id === id)?.nome ?? (id ? 'Usuário removido' : 'Sistema')

  function valor(campo: string, v: unknown): string {
    if (v === null || v === undefined || v === '') return '—'
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
    if (campo === 'vendedor_responsavel_id') return nomeDe(v)
    if (campo === 'data_hora') return formatarDataHora(String(v))
    if (campo === 'telefone' || campo === 'whatsapp') return formatarTelefone(String(v))
    if (campo === 'cep') return formatarCep(String(v))
    if (campo === 'cpf_cnpj') {
      const doc = String(v)
      return formatarDocumento(doc, doc.length === 11 ? 'PF' : 'PJ')
    }
    if (campo === 'canal') return NOME_CANAL[String(v)] ?? String(v)
    if (campo === 'valor' || campo === 'valor_pago') return formatarReais(Number(v))
    if (campo === 'valor_total' || campo === 'valor_mensal') return formatarReais(Number(v))
    if (
      [
        'vencimento',
        'competencia',
        'data_pagamento',
        'data_envio',
        'validade',
        'data_resposta',
      ].includes(campo)
    )
      return formatarData(String(v))
    if (campo === 'status') return NOME_SITUACAO[v as Situacao] ?? String(v)
    if (campo === 'forma_pagamento') return NOME_FORMA[v as FormaPagamento] ?? String(v)
    if (campo === 'tipo')
      return v === 'entrada' ? 'A receber' : v === 'saida' ? 'A pagar' : String(v)
    return String(v)
  }

  return (
    <Secao
      titulo="Histórico de alterações"
      acao={
        !aberto && (
          <Button variante="secundario" onClick={() => setAberto(true)}>
            <History className="size-4" aria-hidden /> Ver histórico
          </Button>
        )
      }
    >
      {!aberto && <Vazio>Quem criou ou alterou cada informação deste cliente, e quando.</Vazio>}
      {aberto && historico.isPending && <Carregando />}
      {historico.isError && <Aviso tipo="erro">{mensagemDeErro(historico.error)}</Aviso>}
      {historico.data?.length === 0 && <Vazio>Nenhuma alteração registrada.</Vazio>}

      <ol className="flex flex-col gap-3">
        {historico.data?.map((r) => (
          <li key={r.id} className="rounded-xl border border-borda p-3 text-sm">
            <p>
              <strong>{nomeDe(r.usuario_id)}</strong> {NOME_ACAO[r.acao]}{' '}
              {(NOME_TABELA[r.tabela] ?? r.tabela).toLowerCase()} ·{' '}
              <span className="text-texto-suave">{formatarDataHora(r.em)}</span>
            </p>
            <ul className="mt-1 text-texto-suave">
              {mudancas(r).map((m) => (
                <li key={m.campo}>
                  {NOME_CAMPO[m.campo] ?? m.campo}:{' '}
                  {r.acao === 'update' ? (
                    <>
                      <s>{valor(m.campo, m.antes)}</s> → {valor(m.campo, m.depois)}
                    </>
                  ) : (
                    valor(m.campo, m.depois ?? m.antes)
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Secao>
  )
}
