import { History } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { formatarDataHora } from '@/lib/datas'
import { formatarCep, formatarDocumento, formatarTelefone } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'

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
