import {
  CalendarDays,
  Eye,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarDataHora, hojeISO, somarMeses } from '@/lib/datas'
import { EMAIL_VALIDO, juntarEmails, separarEmails } from '@/lib/emails'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'
import { cn } from '@/lib/utils'

import {
  assuntoCronograma,
  gruposDeEmail,
  htmlCronograma,
  nomeDoMes as nomeDoMesEmail,
} from '../../../supabase/functions/_shared/emailCronograma'
import { usePerfil } from '../auth/useAuth'
import { useCliente } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import { useRotas } from '../os/api'
import {
  emailDoAviso,
  emailDoCadastro,
  useApagarCronograma,
  useCronograma,
  useCronogramasDoMes,
  useEnviarCronograma,
  useMontarCronograma,
  useSalvarCronograma,
  useAdicionarForaDeRota,
  useSalvarEmailCronograma,
  useSalvarItem,
  useTirarItem,
  useTrazerNovosDaRota,
  type Cronograma,
  type ItemCronograma,
  type ResultadoEnvio,
} from './api'
import {
  COR_SITUACAO,
  NOME_SITUACAO,
  pendente,
  datasDaUnidade,
  diaCurto,
  diasDoTexto,
  fimDeSemana,
  horarioDaUnidade,
  precisaEnviar,
  situacaoDoItem,
  textoDosDias,
  type Situacao,
} from './regras'

/*
 * Serviços > Cronograma: a logística monta as datas do mês de cada rota de controle
 * de pragas e o SAC avisa cada cliente por e-mail (um por CNPJ, com as datas de cada
 * unidade). Quem não tem e-mail fica "pendente de envio" para o SAC avisar à mão.
 */

const NOME_MES = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function nomeDoMes(mes: string): string {
  const t = NOME_MES.format(new Date(`${mes}T12:00:00Z`))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Na lista de rotas, o "Fora de rota" do mês (cronograma sem rota). */
const FORA = 'fora-de-rota'

const primeiroDoMes = (iso: string) => `${iso.slice(0, 7)}-01`

function nomeCliente(c: { nome: string; nome_fantasia: string | null } | null) {
  return c?.nome_fantasia || c?.nome || 'Cliente'
}

function localCurto(e: ItemCronograma['endereco']) {
  if (!e) return 'Endereço principal'
  const rua = `${e.logradouro}, ${e.numero || 's/n'} · ${e.cidade}`
  return e.apelido?.trim() ? `${e.apelido.trim()} · ${rua}` : rua
}

function situacao(i: ItemCronograma, c: Pick<Cronograma, 'datas' | 'horario'>): Situacao {
  return situacaoDoItem(i, c, !!emailDoAviso(i.cliente))
}

/** Os dias como etiquetas (sábado e domingo em destaque). */
function Dias({ datas }: { datas: readonly string[] }) {
  if (datas.length === 0) return <span className="text-sm text-texto-suave">sem datas</span>
  return (
    <span className="flex flex-wrap gap-1">
      {datas.map((d) => (
        <span
          key={d}
          className={cn(
            'rounded-md border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap',
            fimDeSemana(d)
              ? 'border-alerta/40 bg-amber-50 text-alerta'
              : 'border-borda bg-fundo-suave text-texto',
          )}
        >
          {diaCurto(d)}
        </span>
      ))}
    </span>
  )
}

export function CronogramaPage() {
  // A logística costuma montar o mês que vem.
  const [mes, setMes] = useState(() => primeiroDoMes(somarMeses(primeiroDoMes(hojeISO()), 1)))
  const [rotaId, setRotaId] = useState<string | null>(null)
  const rotas = useRotas()
  const doMes = useCronogramasDoMes(mes)

  const porRota = useMemo(
    () => new Map((doMes.data ?? []).map((c) => [c.rota_id ?? FORA, c])),
    [doMes.data],
  )

  function resumo(rota: string) {
    const c = porRota.get(rota)
    if (!c) return null
    const contagem = { total: 0, pendentes: 0, semEmail: 0, conferir: 0 }
    for (const i of c.itens) {
      const s = situacaoDoItem(
        i,
        c,
        !!emailDoAviso({ ...i.cliente!, contatos: i.cliente?.contatos ?? [] }),
      )
      if (s === 'fora') continue
      contagem.total++
      if (pendente(s)) contagem.pendentes++
      if (s === 'sem_email') contagem.semEmail++
      if (s === 'conferir') contagem.conferir++
    }
    return contagem
  }

  const cronogramaId = rotaId ? (porRota.get(rotaId)?.id ?? null) : null
  const rotaEscolhida = rotas.data?.find((r) => r.id === rotaId) ?? null

  function itemDaLista(id: string, nome: string, dica?: string) {
    const s = resumo(id)
    return (
      <button
        key={id}
        type="button"
        onClick={() => setRotaId(id)}
        className={cn(
          'flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
          id === rotaId ? 'bg-lima-claro font-semibold' : 'hover:bg-fundo-suave',
        )}
      >
        <span className="flex flex-col">
          <span>{nome}</span>
          {dica && <span className="text-xs font-normal text-texto-suave">{dica}</span>}
        </span>
        {!s ? (
          <Etiqueta>{id === FORA ? 'Vazio' : 'Não montada'}</Etiqueta>
        ) : s.conferir ? (
          <Etiqueta cor="amarelo">{s.conferir} a conferir</Etiqueta>
        ) : s.pendentes ? (
          <Etiqueta cor={s.semEmail ? 'perigo' : 'alerta'}>
            {s.pendentes} pendente{s.pendentes > 1 ? 's' : ''}
          </Etiqueta>
        ) : (
          <Etiqueta cor="verde">Em dia</Etiqueta>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cronograma</h1>
          <p className="text-sm text-texto-suave">
            Datas do mês de cada rota de controle de pragas e dos serviços de contrato fora de rota
            (coifa, reservatório…), e o e-mail a cada cliente pelo SAC.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variante="fantasma"
            className="min-h-10"
            onClick={() => setMes(primeiroDoMes(somarMeses(mes, -1)))}
          >
            ‹
          </Button>
          <Input
            type="month"
            aria-label="Mês"
            value={mes.slice(0, 7)}
            onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)}
            className="min-h-10 w-auto"
          />
          <Button
            variante="fantasma"
            className="min-h-10"
            onClick={() => setMes(primeiroDoMes(somarMeses(mes, 1)))}
          >
            ›
          </Button>
        </div>
      </div>

      {!UNIDADE.cronograma && (
        <Aviso>
          O envio dos avisos por e-mail ainda não foi configurado nesta unidade (falta definir o
          e-mail do SAC). As datas podem ser montadas normalmente.
        </Aviso>
      )}
      {(rotas.isError || doMes.isError) && (
        <Aviso tipo="erro">{mensagemDeErro(rotas.error ?? doMes.error)}</Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
        <Card className="flex flex-col gap-1 p-2 lg:max-h-[75vh] lg:overflow-y-auto">
          <p className="px-2 py-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">
            Rotas · {nomeDoMes(mes)}
          </p>
          {!rotas.isPending &&
            !doMes.isPending &&
            itemDaLista(FORA, 'Fora de rota', 'Coifa, reservatório, sucção… (pede confirmação)')}
          {rotas.isPending || doMes.isPending ? (
            <Carregando />
          ) : rotas.data?.length === 0 ? (
            <p className="p-2 text-sm text-texto-suave">
              Nenhuma rota cadastrada (Serviços › Ordens de serviço › Rotas).
            </p>
          ) : (
            rotas.data?.map((r) => itemDaLista(r.id, r.nome))
          )}
        </Card>

        <div className="min-w-0">
          {rotaId === FORA ? (
            cronogramaId ? (
              <DetalheCronograma key={cronogramaId} id={cronogramaId} />
            ) : (
              <Card className="flex flex-col gap-4 p-4">
                <div>
                  <h2 className="text-lg font-bold">Fora de rota</h2>
                  <p className="text-sm text-texto-suave">
                    Serviços de contrato com espaçamento maior (coifa, reservatório, sucção,
                    bebedouro…) em {nomeDoMes(mes).toLowerCase()}. O e-mail pergunta ao cliente se a
                    data serve.
                  </p>
                </div>
                <AdicionarForaDeRota key={mes} cronogramaId={null} mes={mes} />
              </Card>
            )
          ) : !rotaEscolhida ? (
            <Card className="p-6 text-sm text-texto-suave">
              Escolha uma rota para montar ou conferir as datas de {nomeDoMes(mes).toLowerCase()}.
            </Card>
          ) : cronogramaId ? (
            <DetalheCronograma key={cronogramaId} id={cronogramaId} />
          ) : (
            <MontarRota key={`${rotaEscolhida.id}|${mes}`} rota={rotaEscolhida} mes={mes} />
          )}
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Montar a rota no mês
// -----------------------------------------------------------------------------

function MontarRota({ rota, mes }: { rota: { id: string; nome: string }; mes: string }) {
  const [texto, setTexto] = useState('')
  const montar = useMontarCronograma()
  const { datas, invalidos } = diasDoTexto(texto, mes.slice(0, 7))

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-lg font-bold">{rota.nome}</h2>
        <p className="text-sm text-texto-suave">
          Ainda não montada em {nomeDoMes(mes).toLowerCase()}. Os clientes vêm das O.S salvas da
          rota; o turno e o “só a 1ª visita” de cada um vêm do mês anterior.
        </p>
      </div>
      <Campo
        rotulo="Dias de atendimento da rota"
        htmlFor="dias-rota"
        dica="Como na planilha: 10 e 25 · 3, 9, 16, 23, 30"
        erro={invalidos.length ? `O mês não tem: ${invalidos.join(', ')}` : undefined}
      >
        <Input
          id="dias-rota"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="10 e 25"
          inputMode="text"
        />
      </Campo>
      <Dias datas={datas} />
      {montar.isError && <Aviso tipo="erro">{mensagemDeErro(montar.error)}</Aviso>}
      <div>
        <Button
          disabled={montar.isPending || invalidos.length > 0}
          onClick={() =>
            montar.mutate({
              rotaId: rota.id,
              mes,
              datas,
              mesAnterior: primeiroDoMes(somarMeses(mes, -1)),
            })
          }
        >
          <CalendarDays className="size-4" aria-hidden />
          {montar.isPending ? 'Montando…' : 'Montar a rota'}
        </Button>
      </div>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// A rota montada: dias, unidades e envio
// -----------------------------------------------------------------------------

function DetalheCronograma({ id }: { id: string }) {
  const crono = useCronograma(id)
  const salvar = useSalvarCronograma()
  const trazer = useTrazerNovosDaRota()
  const apagar = useApagarCronograma()
  const [texto, setTexto] = useState('')
  const [horario, setHorario] = useState('')
  const [editando, setEditando] = useState<ItemCronograma | null>(null)
  const [enviarAberto, setEnviarAberto] = useState(false)
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const c = crono.data
  useEffect(() => {
    if (!c) return
    setTexto(textoDosDias(c.datas))
    setHorario(c.horario ?? '')
    // Só quando troca de cronograma (não a cada gravação).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id])

  if (crono.isPending) return <Carregando />
  if (crono.isError) return <Aviso tipo="erro">{mensagemDeErro(crono.error)}</Aviso>
  if (!c) return <Aviso tipo="erro">Cronograma não encontrado.</Aviso>

  const mes = c.mes.slice(0, 7)
  const { datas, invalidos } = diasDoTexto(texto, mes)
  const mudouDias = datas.join() !== [...c.datas].sort().join()
  const mudouHorario = horario.trim() !== (c.horario ?? '')
  const situacoes = c.itens.map((i) => situacao(i, c))
  const aEnviar = c.itens.filter((_, n) => precisaEnviar(situacoes[n]))
  const semEmail = c.itens.filter((_, n) => situacoes[n] === 'sem_email')
  const aConferir = situacoes.filter((s) => s === 'conferir').length
  const algumEnviado = c.itens.some((i) => i.enviado_em)
  const ativos = situacoes.filter((s) => s !== 'fora').length
  const foraDeRota = !c.rota_id

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{c.rota?.nome ?? 'Fora de rota'}</h2>
            <p className="text-sm text-texto-suave">
              {nomeDoMes(c.mes)} · {ativos} unidade{ativos === 1 ? '' : 's'} no mês
            </p>
            {aConferir > 0 && (
              <p className="mt-1 inline-block rounded-md bg-yellow-300 px-2 py-1 text-sm font-semibold text-yellow-950">
                ⚠ {aConferir} unidade{aConferir > 1 ? 's' : ''} para conferir: não{' '}
                {aConferir > 1 ? 'serão enviadas' : 'será enviada'} até marcar “Conferido”
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!foraDeRota && (
              <Button
                variante="secundario"
                className="min-h-10"
                disabled={trazer.isPending}
                onClick={() =>
                  trazer.mutate(c, {
                    onSuccess: (n) =>
                      setAviso(
                        n
                          ? `${n} unidade${n > 1 ? 's' : ''} nova${n > 1 ? 's' : ''} da rota entrou no mês.`
                          : 'Nenhuma unidade nova na rota.',
                      ),
                  })
                }
              >
                <RefreshCw className="size-4" aria-hidden />
                Trazer novos da rota
              </Button>
            )}
            {!algumEnviado && (
              <Button
                variante="fantasma"
                className="min-h-10 text-perigo"
                disabled={apagar.isPending}
                onClick={() => {
                  if (confirm('Apagar este mês da rota? As datas digitadas serão perdidas.'))
                    apagar.mutate(c.id)
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Apagar mês
              </Button>
            )}
          </div>
        </div>

        {foraDeRota ? (
          <AdicionarForaDeRota cronogramaId={c.id} mes={c.mes} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                rotulo="Dias da rota"
                htmlFor="dias-rota"
                dica="Ex.: 10 e 25. Vale para todos, menos quem tem dias próprios."
                erro={invalidos.length ? `O mês não tem: ${invalidos.join(', ')}` : undefined}
              >
                <Input id="dias-rota" value={texto} onChange={(e) => setTexto(e.target.value)} />
              </Campo>
              <Campo
                rotulo="Turno ou horário (opcional)"
                htmlFor="horario-rota"
                dica="Vazio: horário comercial (o normal)."
              >
                <Input
                  id="horario-rota"
                  value={horario}
                  maxLength={80}
                  placeholder="Ex.: Manhã"
                  onChange={(e) => setHorario(e.target.value)}
                />
              </Campo>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Dias datas={datas} />
              {(mudouDias || mudouHorario) && (
                <Button
                  className="min-h-10"
                  disabled={salvar.isPending || invalidos.length > 0}
                  onClick={() =>
                    salvar.mutate({ id: c.id, datas, horario: horario.trim() || null })
                  }
                >
                  {salvar.isPending ? 'Salvando…' : 'Salvar dias'}
                </Button>
              )}
            </div>
            {(mudouDias || mudouHorario) && algumEnviado && (
              <Aviso>Quem já recebeu o aviso vai aparecer como “Datas alteradas: reenviar”.</Aviso>
            )}
          </>
        )}
        {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
        {trazer.isError && <Aviso tipo="erro">{mensagemDeErro(trazer.error)}</Aviso>}
        {apagar.isError && <Aviso tipo="erro">{mensagemDeErro(apagar.error)}</Aviso>}
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <p className="font-semibold">
            {aEnviar.length
              ? `${aEnviar.length} unidade${aEnviar.length > 1 ? 's' : ''} a avisar`
              : 'Nenhum aviso pendente por e-mail'}
          </p>
          {semEmail.length > 0 && (
            <p className="text-perigo">
              {semEmail.length} sem e-mail cadastrado: avise por WhatsApp ou telefone e marque
              abaixo.
            </p>
          )}
        </div>
        <Button
          disabled={!UNIDADE.cronograma || aEnviar.length === 0 || mudouDias || mudouHorario}
          onClick={() => {
            setResultado(null)
            setEnviarAberto(true)
          }}
        >
          <Send className="size-4" aria-hidden />
          Enviar e-mails
        </Button>
      </Card>
      {resultado && <ResumoEnvio r={resultado} />}

      <Card className="divide-y divide-borda">
        {c.itens.length === 0 && foraDeRota && (
          <p className="p-4 text-sm text-texto-suave">Nenhum cliente fora de rota neste mês.</p>
        )}
        {c.itens.length === 0 && !foraDeRota && (
          <p className="p-4 text-sm text-texto-suave">
            A rota não tem O.S salvas ativas. Inclua os clientes na rota (Ordens de serviço › Rotas)
            e toque em “Trazer novos da rota”.
          </p>
        )}
        {c.itens.map((i, n) => (
          <LinhaUnidade
            key={i.id}
            item={i}
            crono={c}
            situacao={situacoes[n]}
            foraDeRota={foraDeRota}
            aoEditar={() => setEditando(i)}
          />
        ))}
      </Card>

      {editando && (
        <EditarUnidade
          item={editando}
          crono={c}
          foraDeRota={foraDeRota}
          aoFechar={() => setEditando(null)}
        />
      )}
      {enviarAberto && (
        <PreviaEnvio
          crono={c}
          itens={aEnviar}
          aoFechar={() => setEnviarAberto(false)}
          aoEnviar={(r) => {
            setResultado(r)
            setEnviarAberto(false)
          }}
        />
      )}
    </div>
  )
}

function LinhaUnidade({
  item: i,
  crono: c,
  situacao: s,
  foraDeRota,
  aoEditar,
}: {
  item: ItemCronograma
  crono: Cronograma
  situacao: Situacao
  foraDeRota: boolean
  aoEditar: () => void
}) {
  const perfil = usePerfil()
  const salvar = useSalvarItem()
  const tirar = useTirarItem()

  function marcarResposta(resposta: 'confirmado' | 'outra_data' | null) {
    const obs =
      resposta === 'outra_data'
        ? prompt('Qual data o cliente pediu? (depois mude os dias e reenvie)')
        : resposta === 'confirmado'
          ? ''
          : null
    if (obs === null && resposta) return
    salvar.mutate({
      id: i.id,
      resposta,
      resposta_obs: obs?.trim().slice(0, 300) || null,
      resposta_em: resposta ? new Date().toISOString() : null,
    })
  }
  const email = emailDoAviso(i.cliente)
  const datas = datasDaUnidade(i, c.datas)
  const horario = horarioDaUnidade(i, c.horario)

  function marcarManual() {
    const obs = prompt('Como o cliente foi avisado? (ex.: WhatsApp com a Maria)')
    if (obs === null) return
    salvar.mutate({
      id: i.id,
      aviso_manual_em: new Date().toISOString(),
      aviso_manual_por: perfil.id,
      aviso_manual_obs: obs.trim().slice(0, 300) || null,
    })
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-4',
        s === 'fora' && 'opacity-60',
        s === 'conferir' && 'border-l-8 border-yellow-400 bg-yellow-100',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{nomeCliente(i.cliente)}</p>
          <p className="text-sm text-texto-suave">{localCurto(i.endereco)}</p>
          {i.servicos.length > 0 && (
            <p className="text-xs text-texto-suave">{i.servicos.join(' · ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Etiqueta cor={COR_SITUACAO[s]}>{NOME_SITUACAO[s]}</Etiqueta>
          <Button variante="fantasma" className="min-h-9 px-2" onClick={aoEditar}>
            <Pencil className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Editar</span>
          </Button>
        </div>
      </div>
      {s !== 'fora' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Dias datas={datas} />
          {i.datas ? (
            <span className="text-xs text-texto-suave">dias próprios</span>
          ) : i.so_visita ? (
            <span className="text-xs text-texto-suave">só a {i.so_visita}ª visita da rota</span>
          ) : null}
          {horario && <span className="text-texto-suave">🕘 {horario}</span>}
          {i.observacoes && <span className="text-texto-suave">“{i.observacoes}”</span>}
        </div>
      )}
      {s === 'conferir' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-yellow-300 px-3 py-2 text-sm font-semibold text-yellow-950">
          <span className="flex-1">
            ⚠ {i.conferir} · Não será enviado até conferir: veja os dias e o endereço (pelo CNPJ).
          </span>
          <Button
            variante="secundario"
            className="min-h-9"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate({ id: i.id, conferir: null })}
          >
            Conferido
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
        {email ? (
          <span>
            <Mail className="mr-1 inline size-3.5" aria-hidden />
            {email}
          </span>
        ) : (
          <span className="font-semibold text-perigo">Sem e-mail principal no cadastro</span>
        )}
        {i.enviado_em && (
          <span>
            Enviado em {formatarDataHora(i.enviado_em)} para {i.enviado_para}
          </span>
        )}
        {i.aviso_manual_em && (
          <span>
            Avisado à mão em {formatarDataHora(i.aviso_manual_em)}
            {i.aviso_manual_obs ? ` (${i.aviso_manual_obs})` : ''}
          </span>
        )}
        {i.resposta_em && (
          <span>
            Resposta marcada em {formatarDataHora(i.resposta_em)}
            {i.resposta_obs ? `: ${i.resposta_obs}` : ''}
          </span>
        )}
      </div>
      {(s === 'aguardando' || s === 'confirmado' || s === 'outra_data') && (
        <div className="flex flex-wrap gap-2">
          {s === 'aguardando' ? (
            <>
              <Button
                variante="secundario"
                className="min-h-9"
                disabled={salvar.isPending}
                onClick={() => marcarResposta('confirmado')}
              >
                Cliente confirmou
              </Button>
              <Button
                variante="secundario"
                className="min-h-9"
                disabled={salvar.isPending}
                onClick={() => marcarResposta('outra_data')}
              >
                Pediu outra data
              </Button>
            </>
          ) : (
            <Button
              variante="fantasma"
              className="min-h-9"
              disabled={salvar.isPending}
              onClick={() => marcarResposta(null)}
            >
              <Undo2 className="size-4" aria-hidden />
              Desfazer resposta
            </Button>
          )}
        </div>
      )}
      {(s === 'sem_email' || s === 'manual' || (s === 'alterado' && !email)) && (
        <div className="flex flex-wrap gap-2">
          {i.aviso_manual_em ? (
            <Button
              variante="fantasma"
              className="min-h-9"
              disabled={salvar.isPending}
              onClick={() =>
                salvar.mutate({
                  id: i.id,
                  aviso_manual_em: null,
                  aviso_manual_por: null,
                  aviso_manual_obs: null,
                })
              }
            >
              <Undo2 className="size-4" aria-hidden />
              Desfazer aviso à mão
            </Button>
          ) : (
            <Button
              variante="secundario"
              className="min-h-9"
              disabled={salvar.isPending}
              onClick={marcarManual}
            >
              Avisei por WhatsApp/telefone
            </Button>
          )}
        </div>
      )}
      {foraDeRota && !i.enviado_em && !i.aviso_manual_em && (
        <div>
          <Button
            variante="fantasma"
            className="min-h-9 text-perigo"
            disabled={tirar.isPending}
            onClick={() => {
              if (confirm(`Tirar ${nomeCliente(i.cliente)} deste mês?`)) tirar.mutate(i.id)
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Tirar do mês
          </Button>
        </div>
      )}
      {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
      {tirar.isError && <Aviso tipo="erro">{mensagemDeErro(tirar.error)}</Aviso>}
    </div>
  )
}

type ModoDias = 'rota' | 'propria' | `so${number}`

function EditarUnidade({
  item: i,
  crono: c,
  foraDeRota,
  aoFechar,
}: {
  item: ItemCronograma
  crono: Cronograma
  foraDeRota: boolean
  aoFechar: () => void
}) {
  const salvar = useSalvarItem()
  const salvarEmail = useSalvarEmailCronograma()
  const doCadastro = emailDoCadastro(i.cliente)
  const [emails, setEmails] = useState(() => separarEmails(emailDoAviso(i.cliente)))
  const [novoEmail, setNovoEmail] = useState('')
  const novoValido = EMAIL_VALIDO.test(novoEmail.trim())
  const [servico, setServico] = useState(i.servicos.join(', '))
  const [pedeConfirmacao, setPedeConfirmacao] = useState(i.pede_confirmacao)
  const mes = c.mes.slice(0, 7)
  const visitasDaRota = [...c.datas].sort()
  const [incluido, setIncluido] = useState(i.incluido)
  const [modo, setModo] = useState<ModoDias>(
    i.datas || foraDeRota ? 'propria' : i.so_visita ? `so${i.so_visita}` : 'rota',
  )
  const [texto, setTexto] = useState(textoDosDias(i.datas ?? []))
  const [horario, setHorario] = useState(i.horario ?? '')
  const [obs, setObs] = useState(i.observacoes ?? '')
  const proprias = diasDoTexto(texto, mes)

  const previa =
    modo === 'propria'
      ? proprias.datas
      : datasDaUnidade(
          { datas: null, so_visita: modo === 'rota' ? null : Number(modo.slice(2)) },
          c.datas,
        )

  return (
    <Modal aberto aoFechar={aoFechar} titulo={nomeCliente(i.cliente)}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">{localCurto(i.endereco)}</p>
        <div className="flex flex-col gap-2 rounded-lg border border-borda p-3">
          <p className="text-sm font-semibold">E-mail do aviso</p>
          {emails.length === 0 ? (
            <p className="text-sm font-semibold text-perigo">
              Nenhum e-mail: fica “Pendente de envio” para avisar por WhatsApp/telefone.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {emails.map((e) => (
                <li
                  key={e}
                  className="flex items-center gap-1 rounded-full bg-fundo-suave py-1 pr-1 pl-3 text-sm"
                >
                  <Mail className="size-3.5 text-texto-suave" aria-hidden />
                  {e}
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-full hover:bg-borda"
                    aria-label={`Tirar ${e}`}
                    onClick={() => setEmails(emails.filter((x) => x !== e))}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault()
              const e = novoEmail.trim().toLowerCase()
              if (!EMAIL_VALIDO.test(e)) return
              if (!emails.includes(e)) setEmails([...emails, e])
              setNovoEmail('')
            }}
          >
            <Input
              type="email"
              aria-label="Acrescentar e-mail"
              placeholder="Acrescentar ou trocar: nome@empresa.com.br"
              value={novoEmail}
              onChange={(ev) => setNovoEmail(ev.target.value)}
            />
            <Button type="submit" variante="secundario" disabled={!novoValido}>
              <Plus className="size-4" aria-hidden />
              Adicionar
            </Button>
          </form>
          <p className="text-xs text-texto-suave">
            Fica salvo no cliente e vale para os próximos meses (e outras rotas). Para trocar, tire
            o atual no × e adicione o novo. O e-mail principal do cadastro
            {doCadastro ? ` (${doCadastro})` : ''} não muda.
            {juntarEmails(emails) !== juntarEmails(separarEmails(doCadastro)) && doCadastro && (
              <>
                {' '}
                <button
                  type="button"
                  className="font-semibold text-verde underline"
                  onClick={() => setEmails(separarEmails(doCadastro))}
                >
                  Voltar ao do cadastro
                </button>
              </>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={incluido}
            onChange={(e) => setIncluido(e.target.checked)}
          />
          Atende neste mês
        </label>
        {incluido && (
          <>
            {foraDeRota && (
              <>
                <Campo rotulo="Serviço" htmlFor="servico-unidade">
                  <Input
                    id="servico-unidade"
                    value={servico}
                    maxLength={120}
                    onChange={(e) => setServico(e.target.value)}
                  />
                </Campo>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-verde"
                    checked={pedeConfirmacao}
                    onChange={(e) => setPedeConfirmacao(e.target.checked)}
                  />
                  Perguntar ao cliente se a data serve
                </label>
              </>
            )}
            {!foraDeRota && (
              <Campo rotulo="Dias" htmlFor="modo-dias">
                <Select
                  id="modo-dias"
                  value={modo}
                  onChange={(e) => setModo(e.target.value as ModoDias)}
                >
                  <option value="rota">
                    Os dias da rota ({textoDosDias(visitasDaRota) || '—'})
                  </option>
                  {visitasDaRota.map((d, n) => (
                    <option key={d} value={`so${n + 1}`}>
                      Só a {n + 1}ª visita ({diaCurto(d)})
                    </option>
                  ))}
                  <option value="propria">Dias próprios</option>
                </Select>
              </Campo>
            )}
            {modo === 'propria' && (
              <Campo
                rotulo="Dias próprios"
                htmlFor="dias-proprios"
                dica="Ex.: 27 · 3, 9, 16, 23, 30"
                erro={
                  proprias.invalidos.length
                    ? `O mês não tem: ${proprias.invalidos.join(', ')}`
                    : undefined
                }
              >
                <Input
                  id="dias-proprios"
                  data-autofocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </Campo>
            )}
            <Dias datas={previa} />
            <Campo
              rotulo="Turno ou horário (opcional)"
              htmlFor="horario-unidade"
              dica={
                c.horario
                  ? `Vazio: o da rota (${c.horario}).`
                  : 'Vazio: horário comercial (o normal).'
              }
            >
              <Input
                id="horario-unidade"
                value={horario}
                maxLength={80}
                placeholder="Ex.: Às 9h"
                onChange={(e) => setHorario(e.target.value)}
              />
            </Campo>
            <Campo
              rotulo="Observação para o cliente (opcional)"
              htmlFor="obs-unidade"
              dica="Vai no e-mail. Ex.: o atendimento será entre os dias 25 e 27."
            >
              <Input
                id="obs-unidade"
                value={obs}
                maxLength={500}
                onChange={(e) => setObs(e.target.value)}
              />
            </Campo>
          </>
        )}
        {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
        {salvarEmail.isError && <Aviso tipo="erro">{mensagemDeErro(salvarEmail.error)}</Aviso>}
        <div className="flex justify-end gap-2">
          <Button variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            disabled={
              salvar.isPending ||
              salvarEmail.isPending ||
              (incluido && modo === 'propria' && proprias.invalidos.length > 0)
            }
            onClick={async () => {
              const juntos = juntarEmails(emails)
              const valor = juntos === juntarEmails(separarEmails(doCadastro)) ? null : juntos
              if (valor !== (i.cliente?.email_cronograma?.trim() || null) && i.cliente) {
                try {
                  await salvarEmail.mutateAsync({ clienteId: i.cliente.id, emails: valor })
                } catch {
                  return
                }
              }
              salvar.mutate(
                {
                  id: i.id,
                  incluido,
                  datas: modo === 'propria' ? proprias.datas : null,
                  so_visita: modo.startsWith('so') ? Number(modo.slice(2)) : null,
                  horario: horario.trim() || null,
                  observacoes: obs.trim() || null,
                  conferir: null,
                  ...(foraDeRota
                    ? {
                        servicos: servico.trim() ? [servico.trim()] : [],
                        pede_confirmacao: pedeConfirmacao,
                      }
                    : {}),
                },
                { onSuccess: aoFechar },
              )
            }}
          >
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Prévia e envio
// -----------------------------------------------------------------------------

function PreviaEnvio({
  crono: c,
  itens,
  aoFechar,
  aoEnviar,
}: {
  crono: Cronograma
  itens: ItemCronograma[]
  aoFechar: () => void
  aoEnviar: (r: ResultadoEnvio) => void
}) {
  const enviar = useEnviarCronograma()
  // Os mesmos e-mails que a função vai mandar: um por cliente (CNPJ).
  const grupos = useMemo(() => gruposDeEmail(itens, c), [itens, c])
  const chave = (g: (typeof grupos)[number]) => `${g.clienteId}|${g.confirmar}`
  const [marcados, setMarcados] = useState(() => new Set(grupos.map(chave)))
  const [vendo, setVendo] = useState<string | null>(null)

  const escolhidos = grupos.filter((g) => marcados.has(chave(g))).flatMap((g) => g.itens)
  const emailSac = UNIDADE.cronograma?.emailSac ?? ''
  const dadosDe = (g: (typeof grupos)[number]) => ({
    site: window.location.origin,
    empresa: UNIDADE.nome,
    cliente: g.nomeCliente,
    mes: nomeDoMesEmail(c.mes),
    emailSac,
    unidades: g.unidades,
    confirmar: g.confirmar,
  })

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Enviar os e-mails">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">
          Um e-mail para cada cliente, saindo de <strong>{emailSac}</strong> (com cópia oculta para
          o SAC). A resposta do cliente vai para o SAC. Toque em “Ver e-mail” para ver exatamente o
          que o cliente recebe.
        </p>
        <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
          {grupos.map((g) => {
            const k = chave(g)
            const cli = g.itens[0].cliente
            return (
              <li key={k} className="rounded-xl border border-borda p-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Enviar para ${g.nomeCliente}`}
                    className="mt-1 size-5 accent-verde"
                    checked={marcados.has(k)}
                    onChange={(e) => {
                      const novo = new Set(marcados)
                      if (e.target.checked) novo.add(k)
                      else novo.delete(k)
                      setMarcados(novo)
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{g.nomeCliente}</span>
                      <span className="flex items-center gap-2">
                        <Etiqueta cor={g.confirmar ? 'alerta' : 'verde'}>
                          {g.confirmar ? 'Pergunta se a data serve' : 'Só avisa'}
                        </Etiqueta>
                        <Button
                          variante="fantasma"
                          className="min-h-8 px-2 text-sm"
                          onClick={() => setVendo(vendo === k ? null : k)}
                        >
                          <Eye className="size-4" aria-hidden />
                          {vendo === k ? 'Fechar' : 'Ver e-mail'}
                        </Button>
                      </span>
                    </div>
                    <span className="text-xs text-texto-suave">Para: {emailDoAviso(cli)}</span>
                    <span className="text-xs text-texto-suave">
                      Assunto: {assuntoCronograma(dadosDe(g))}
                    </span>
                    {g.itens.map((u) => (
                      <span key={u.id} className="flex flex-col gap-1 text-sm">
                        <span className="text-texto-suave">{localCurto(u.endereco)}</span>
                        <Dias datas={datasDaUnidade(u, c.datas)} />
                        {situacao(u, c) === 'alterado' && (
                          <span className="text-xs font-semibold text-perigo">
                            Reenvio: as datas mudaram
                          </span>
                        )}
                      </span>
                    ))}
                    {vendo === k && (
                      <iframe
                        title={`E-mail para ${g.nomeCliente}`}
                        srcDoc={htmlCronograma(dadosDe(g))}
                        sandbox=""
                        className="mt-2 h-[560px] w-full rounded-lg border border-borda bg-white"
                      />
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {enviar.isError && <Aviso tipo="erro">{mensagemDeErro(enviar.error)}</Aviso>}
        <div className="flex justify-end gap-2">
          <Button variante="fantasma" onClick={aoFechar} disabled={enviar.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={enviar.isPending || escolhidos.length === 0}
            onClick={() =>
              enviar.mutate(
                { cronogramaId: c.id, itemIds: escolhidos.map((i) => i.id) },
                { onSuccess: aoEnviar },
              )
            }
          >
            <Send className="size-4" aria-hidden />
            {enviar.isPending
              ? 'Enviando…'
              : `Enviar ${marcados.size} e-mail${marcados.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Põe um cliente avulso (coifa, reservatório…) no "Fora de rota" do mês. */
function AdicionarForaDeRota({ cronogramaId, mes }: { cronogramaId: string | null; mes: string }) {
  const [aberto, setAberto] = useState(!cronogramaId)
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null)
  const [enderecoEscolhido, setEnderecoId] = useState('')
  const [servico, setServico] = useState('')
  const [texto, setTexto] = useState('')
  const [horario, setHorario] = useState('')
  const [obs, setObs] = useState('')
  const [pedeConfirmacao, setPedeConfirmacao] = useState(true)
  const [ok, setOk] = useState<string | null>(null)
  const ficha = useCliente(cliente?.id ?? '')
  const tipos = useTiposServico()
  const adicionar = useAdicionarForaDeRota()
  const { datas, invalidos } = diasDoTexto(texto, mes.slice(0, 7))
  const enderecos = (cliente && ficha.data?.enderecos.filter((e) => e.ativo)) || []
  // Sem escolha, o endereço principal (vem primeiro).
  const enderecoId = enderecos.some((e) => e.id === enderecoEscolhido)
    ? enderecoEscolhido
    : (enderecos[0]?.id ?? '')

  if (!aberto)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variante="secundario" className="min-h-10" onClick={() => setAberto(true)}>
          <Plus className="size-4" aria-hidden />
          Adicionar cliente
        </Button>
        {ok && <span className="text-sm text-verde-escuro">{ok}</span>}
      </div>
    )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda bg-fundo-suave p-3">
      <Campo rotulo="Cliente" htmlFor="cliente-fora">
        <ClienteSeletor id="cliente-fora" valor={cliente} aoMudar={setCliente} />
      </Campo>
      {cliente && enderecos.length > 1 && (
        <Campo rotulo="Unidade (endereço)" htmlFor="endereco-fora">
          <Select
            id="endereco-fora"
            value={enderecoId}
            onChange={(e) => setEnderecoId(e.target.value)}
          >
            {enderecos.map((e) => (
              <option key={e.id} value={e.id}>
                {localCurto(e)}
              </option>
            ))}
          </Select>
        </Campo>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Serviço" htmlFor="servico-fora">
          <Select
            id="servico-fora"
            value={servico}
            onChange={(e) => {
              setServico(e.target.value)
              setPedeConfirmacao(!/praga/i.test(e.target.value))
            }}
          >
            <option value="">Escolha…</option>
            {tipos.data
              ?.filter((t) => t.ativo)
              .map((t) => (
                <option key={t.id} value={t.nome}>
                  {t.nome}
                </option>
              ))}
          </Select>
        </Campo>
        <Campo
          rotulo="Dia(s)"
          htmlFor="dias-fora"
          dica="Ex.: 15"
          erro={invalidos.length ? `O mês não tem: ${invalidos.join(', ')}` : undefined}
        >
          <Input id="dias-fora" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        <Campo rotulo="Turno ou horário (opcional)" htmlFor="horario-fora">
          <Input
            id="horario-fora"
            value={horario}
            maxLength={80}
            placeholder="Ex.: Após as 15h"
            onChange={(e) => setHorario(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Observação para o cliente (opcional)" htmlFor="obs-fora">
          <Input
            id="obs-fora"
            value={obs}
            maxLength={500}
            onChange={(e) => setObs(e.target.value)}
          />
        </Campo>
      </div>
      <Dias datas={datas} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-verde"
          checked={pedeConfirmacao}
          onChange={(e) => setPedeConfirmacao(e.target.checked)}
        />
        Perguntar ao cliente se a data serve (serviço de contrato)
      </label>
      {adicionar.isError && <Aviso tipo="erro">{mensagemDeErro(adicionar.error)}</Aviso>}
      <div className="flex flex-wrap justify-end gap-2">
        {cronogramaId && (
          <Button variante="fantasma" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        )}
        <Button
          disabled={
            adicionar.isPending ||
            !cliente ||
            !servico ||
            datas.length === 0 ||
            invalidos.length > 0
          }
          onClick={() =>
            adicionar.mutate(
              {
                cronogramaId,
                mes,
                clienteId: cliente!.id,
                enderecoId: enderecoId || null,
                servico,
                datas,
                horario: horario.trim() || null,
                observacoes: obs.trim() || null,
                pedeConfirmacao,
              },
              {
                onSuccess: () => {
                  setOk(`${cliente!.nome} entrou no mês.`)
                  setCliente(null)
                  setTexto('')
                  setHorario('')
                  setObs('')
                  setAberto(false)
                },
              },
            )
          }
        >
          {adicionar.isPending ? 'Adicionando…' : 'Adicionar'}
        </Button>
      </div>
    </div>
  )
}

function ResumoEnvio({ r }: { r: ResultadoEnvio }) {
  return (
    <div className="flex flex-col gap-2">
      {r.enviados.length > 0 && (
        <Aviso tipo="sucesso">
          {r.enviados.length} e-mail{r.enviados.length > 1 ? 's' : ''} enviado
          {r.enviados.length > 1 ? 's' : ''} pelo {r.de}.
        </Aviso>
      )}
      {r.semEmail.length > 0 && (
        <Aviso tipo="erro">Sem e-mail (pendente de envio): {r.semEmail.join(', ')}.</Aviso>
      )}
      {r.falhas.length > 0 && (
        <Aviso tipo="erro">
          Não enviados: {r.falhas.map((f) => `${f.cliente} (${f.erro})`).join('; ')}.
        </Aviso>
      )}
    </div>
  )
}
