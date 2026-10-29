import { useQuery } from '@tanstack/react-query'

import { Aviso } from '@/components/ui/Aviso'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import {
  COR_SITUACAO_VENCIMENTO,
  COR_STATUS_SERVICO,
  NOME_SITUACAO_VENCIMENTO,
  NOME_STATUS_SERVICO,
  useVencimentos,
  type SituacaoVencimento,
} from '../../servicos/api'
import { Secao, Vazio } from './Secao'

/**
 * Serviços do cliente para a recepção: datas, certificado e quem vendeu — sem valores.
 * Vem de uma função do banco que simplesmente não devolve as colunas de dinheiro.
 */
export function SecaoServicosRecepcao({ clienteId }: { clienteId: string }) {
  const servicos = useQuery({
    queryKey: ['servicos', 'sem-valor', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('servicos_do_cliente_sem_valor', {
        cliente: clienteId,
      })
      if (error) throw error
      return data
    },
  })
  const vencimentos = useVencimentos({ clienteId })

  return (
    <Secao titulo="Serviços e vencimentos">
      {(servicos.isPending || vencimentos.isPending) && <Carregando />}
      {servicos.isError && <Aviso tipo="erro">{mensagemDeErro(servicos.error)}</Aviso>}

      {!!vencimentos.data?.length && (
        <>
          <h3 className="mb-2 text-sm font-bold text-texto-suave uppercase">
            Próximos vencimentos
          </h3>
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {vencimentos.data.map((v) => {
              const situacao = (v.situacao ?? 'sem_data') as SituacaoVencimento
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{v.tipo?.nome}</strong>
                    {v.endereco?.apelido && ` · ${v.endereco.apelido}`} ·{' '}
                    {v.proxima_data ? formatarData(v.proxima_data) : 'sem data'}
                  </span>
                  <Etiqueta cor={COR_SITUACAO_VENCIMENTO[situacao]}>
                    {NOME_SITUACAO_VENCIMENTO[situacao]}
                  </Etiqueta>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {servicos.data?.length === 0 && <Vazio>Nenhum serviço registrado.</Vazio>}
      {!!servicos.data?.length && (
        <>
          <h3 className="mb-2 text-sm font-bold text-texto-suave uppercase">Histórico</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {servicos.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{s.tipo_servico}</strong> · {formatarData(s.data_execucao)}
                  <span className="text-texto-suave">
                    {[
                      s.endereco,
                      s.numero_certificado && `cert. ${s.numero_certificado}`,
                      s.vendedor,
                    ]
                      .filter(Boolean)
                      .map((t) => ` · ${t}`)
                      .join('')}
                  </span>
                </span>
                <Etiqueta cor={COR_STATUS_SERVICO[s.status]}>
                  {NOME_STATUS_SERVICO[s.status]}
                </Etiqueta>
              </li>
            ))}
          </ul>
        </>
      )}
    </Secao>
  )
}
