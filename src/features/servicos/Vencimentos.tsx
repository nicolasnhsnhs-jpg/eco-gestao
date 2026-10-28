import { CalendarPlus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import {
  COR_SITUACAO_VENCIMENTO,
  NOME_SITUACAO_VENCIMENTO,
  useAjustarVencimento,
  type SituacaoVencimento,
  type Vencimento,
} from './api'

function textoPrazo(v: Vencimento): string {
  const dias = v.dias_para_vencer
  if (dias == null) return ''
  if (dias < 0) return `venceu há ${-dias} dia(s)`
  if (dias === 0) return 'vence hoje'
  return `em ${dias} dia(s)`
}

/** Lista de vencimentos (página de vencimentos e ficha do cliente). */
export function ListaVencimentos({
  vencimentos,
  mostrarCliente,
}: {
  vencimentos: Vencimento[]
  mostrarCliente?: boolean
}) {
  const [ajustando, setAjustando] = useState<Vencimento | null>(null)

  return (
    <>
      <ul className="divide-y divide-borda">
        {vencimentos.map((v) => {
          const situacao = (v.situacao ?? 'sem_data') as SituacaoVencimento
          const agendar = new URLSearchParams({
            status: 'agendado',
            cliente: v.cliente_id!,
            cliente_nome: v.cliente?.nome_fantasia || v.cliente?.nome || '',
            tipo: v.tipo_servico_id!,
            ...(v.endereco_id ? { endereco: v.endereco_id } : {}),
          })
          return (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {v.tipo?.nome}
                  {mostrarCliente && (
                    <>
                      {' · '}
                      <Link to={`/clientes/${v.cliente_id}`} className="text-verde underline">
                        {v.cliente?.nome_fantasia || v.cliente?.nome}
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-sm text-texto-suave">
                  {[
                    v.endereco?.apelido || v.endereco?.cidade,
                    v.proxima_data && `próximo: ${formatarData(v.proxima_data)} (${textoPrazo(v)})`,
                    `a cada ${v.periodicidade_meses} meses`,
                    v.tipo?.tipo_vencimento === 'recomendacao' ? 'recomendação' : 'certificado',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Etiqueta cor={COR_SITUACAO_VENCIMENTO[situacao]}>
                {NOME_SITUACAO_VENCIMENTO[situacao]}
              </Etiqueta>
              <Link
                to={`/servicos/novo?${agendar}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-verde hover:bg-lima-claro"
                title="Agendar o próximo serviço"
              >
                <CalendarPlus className="size-4" aria-hidden /> Agendar
              </Link>
              <BotaoIcone rotulo="Ajustar periodicidade e aviso" onClick={() => setAjustando(v)}>
                <Settings2 className="size-4" />
              </BotaoIcone>
            </li>
          )
        })}
      </ul>
      <Modal aberto={!!ajustando} aoFechar={() => setAjustando(null)} titulo="Ajustar vencimento">
        {ajustando && <FormAjuste vencimento={ajustando} aoTerminar={() => setAjustando(null)} />}
      </Modal>
    </>
  )
}

function FormAjuste({
  vencimento,
  aoTerminar,
}: {
  vencimento: Vencimento
  aoTerminar: () => void
}) {
  const ajustar = useAjustarVencimento()
  const [periodicidade, setPeriodicidade] = useState(String(vencimento.periodicidade_meses ?? ''))
  const [antecedencia, setAntecedencia] = useState(String(vencimento.antecedencia_aviso_dias ?? ''))
  const [ativo, setAtivo] = useState(!!vencimento.ativo)
  const valido =
    /^\d+$/.test(periodicidade) &&
    +periodicidade >= 1 &&
    +periodicidade <= 60 &&
    /^\d+$/.test(antecedencia) &&
    +antecedencia <= 180

  async function salvar() {
    try {
      await ajustar.mutateAsync({
        id: vencimento.id!,
        dados: {
          periodicidade_meses: Number(periodicidade),
          antecedencia_aviso_dias: Number(antecedencia),
          ativo,
        },
      })
      aoTerminar()
    } catch {
      // Mostrado abaixo pelo estado da mutação.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        <strong>{vencimento.tipo?.nome}</strong> ·{' '}
        {vencimento.cliente?.nome_fantasia || vencimento.cliente?.nome}
        {vencimento.endereco?.apelido && ` · ${vencimento.endereco.apelido}`}
      </p>
      {ajustar.isError && <Aviso tipo="erro">{mensagemDeErro(ajustar.error)}</Aviso>}
      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo="Repetir a cada (meses)"
          htmlFor="aj-periodo"
          dica="Só para este cliente/local."
        >
          <Input
            id="aj-periodo"
            inputMode="numeric"
            value={periodicidade}
            onChange={(e) => setPeriodicidade(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Avisar quantos dias antes" htmlFor="aj-antes">
          <Input
            id="aj-antes"
            inputMode="numeric"
            value={antecedencia}
            onChange={(e) => setAntecedencia(e.target.value)}
          />
        </Campo>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-verde"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        Acompanhar este vencimento (desmarque se o cliente não quer mais o serviço)
      </label>
      <Button disabled={!valido || ajustar.isPending} onClick={() => void salvar()}>
        {ajustar.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </div>
  )
}
