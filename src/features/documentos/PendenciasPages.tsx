import { CheckCircle2, ChevronRight, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Assinatura } from '@/components/ui/Assinatura'
import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { usePerfil } from '../auth/useAuth'
import { participantesEmOrdem, useApr, useAssinarApr, useMinhasAprsPendentes } from './api'
import { AVISO_RECUSA, EMERGENCIA, lerEpis, lerEtapas, numeroApr } from './aprModelos'
import { ResumoEtapa } from './AprPages'

/** /pendencias: o que o técnico precisa assinar (por enquanto, as APRs). */
export function PendenciasPage() {
  const perfil = usePerfil()
  const pendentes = useMinhasAprsPendentes(perfil.id)

  return (
    <>
      <PageHeader titulo="Pendências" descricao="Documentos que você precisa assinar." />
      {pendentes.isPending && <Carregando />}
      {pendentes.isError && <Aviso tipo="erro">{mensagemDeErro(pendentes.error)}</Aviso>}
      {pendentes.isSuccess && pendentes.data.length === 0 && (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          <CheckCircle2 className="size-5 text-verde" aria-hidden /> Nada pendente. Tudo assinado!
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {pendentes.data?.map((a) => (
          <li key={a.id}>
            <Link
              to={`/pendencias/apr/${a.id}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-alerta/40 bg-white p-4 hover:bg-amber-50"
            >
              <ShieldAlert className="size-7 shrink-0 text-alerta" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-verde-escuro">
                  Assinar APR {numeroApr(a)}
                </span>
                <span className="block text-sm text-texto-suave">
                  {a.cliente_nome}
                  {a.local && ` · ${a.local}`} · {formatarData(a.data)}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** /pendencias/apr/:id: o técnico lê a APR e assina com o dedo. */
export function AssinarAprPage() {
  const { id } = useParams()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const apr = useApr(id)
  const assinar = useAssinarApr(
    { id: apr.data?.id ?? '', cliente_id: apr.data?.cliente_id ?? '' },
    perfil.id,
  )
  const [li, setLi] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (apr.isPending) return <Carregando />
  if (apr.isError) return <Aviso tipo="erro">{mensagemDeErro(apr.error)}</Aviso>
  if (!apr.data) return <Aviso tipo="erro">APR não encontrada.</Aviso>
  const a = apr.data
  const eu = a.participantes.find((p) => p.perfil_id === perfil.id)
  const etapas = lerEtapas(a.etapas)
  const epis = lerEpis(a.epis)

  async function confirmar(imagem: Blob) {
    setErro(null)
    try {
      await assinar.mutateAsync(imagem)
      navigate('/pendencias')
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <>
      <PageHeader
        titulo={`APR ${numeroApr(a)}`}
        descricao={`${a.cliente_nome}${a.local ? ` · ${a.local}` : ''} · ${formatarData(a.data)}`}
      />
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="font-titulo text-lg font-bold text-verde-escuro">{a.titulo}</h2>
          {a.descricao_atividade && <p className="mt-1 text-sm">{a.descricao_atividade}</p>}
          {a.endereco_texto && <p className="mt-1 text-sm text-texto-suave">{a.endereco_texto}</p>}
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">Leia cada etapa antes de assinar</h2>
          <ol className="flex flex-col gap-3">
            {etapas.map((e, i) => (
              <li key={i} className="rounded-xl border border-borda p-3 text-sm">
                <p className="font-semibold">
                  {i + 1}. {e.etapa}
                </p>
                <ResumoEtapa e={e} />
              </li>
            ))}
          </ol>
        </Card>

        {epis.length > 0 && (
          <Card>
            <h2 className="mb-2 font-bold">EPIs obrigatórios</h2>
            <ul className="list-disc pl-5 text-sm">
              {epis.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Card>
        )}
        {a.observacoes && (
          <Card>
            <h2 className="mb-1 font-bold">Observações</h2>
            <p className="text-sm whitespace-pre-line">{a.observacoes}</p>
          </Card>
        )}
        <div className="rounded-xl bg-amber-50 p-3 text-sm">
          <p className="font-bold text-alerta">Emergência: {EMERGENCIA.join(' · ')}</p>
          <p className="mt-1">{AVISO_RECUSA}</p>
        </div>

        <Card className="flex flex-col gap-3">
          <h2 className="font-bold">Quem assina</h2>
          <ul className="text-sm">
            {participantesEmOrdem(a).map((p) => (
              <li key={p.perfil_id}>
                {p.nome} · {p.assinada_em ? '✓ assinou' : 'falta assinar'}
              </li>
            ))}
          </ul>
          {a.status === 'cancelada' ? (
            <Aviso tipo="erro">Esta APR foi cancelada pelo escritório.</Aviso>
          ) : !eu ? (
            <Aviso tipo="erro">Você não está nesta APR.</Aviso>
          ) : eu.assinada_em ? (
            <Aviso tipo="sucesso">
              Você assinou em {new Date(eu.assinada_em).toLocaleString('pt-BR')}.
            </Aviso>
          ) : (
            <>
              <label className="flex items-start gap-3 rounded-xl border border-borda p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-verde"
                  checked={li}
                  onChange={(e) => setLi(e.target.checked)}
                />
                <span className="text-sm">
                  Li e entendi os perigos, os riscos e as medidas preventivas desta APR e vou
                  adotá-las na execução do serviço.
                </span>
              </label>
              {erro && <Aviso tipo="erro">{erro}</Aviso>}
              {li ? (
                <Assinatura aoConfirmar={confirmar} ocupado={assinar.isPending} />
              ) : (
                <p className="text-sm text-texto-suave">Marque acima para assinar.</p>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  )
}
