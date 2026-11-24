import { CalendarDays, Mail, Pencil, RefreshCw, Send, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarDataHora, hojeISO, somarMeses } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { useRotas } from '../os/api'
import {
  emailDoAviso,
  useApagarCronograma,
  useCronograma,
  useCronogramasDoMes,
  useEnviarCronograma,
  useMontarCronograma,
  useSalvarCronograma,
  useSalvarItem,
  useTrazerNovosDaRota,
  type Cronograma,
  type ItemCronograma,
  type ResultadoEnvio,
} from './api'
import {
  COR_SITUACAO,
  NOME_SITUACAO,
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
    () => new Map((doMes.data ?? []).map((c) => [c.rota_id, c])),
    [doMes.data],
  )

  function resumo(rota: string) {
    const c = porRota.get(rota)
    if (!c) return null
    const contagem = { total: 0, pendentes: 0, semEmail: 0 }
    for (const i of c.itens) {
      const s = situacaoDoItem(
        i,
        c,
        !!emailDoAviso({ ...i.cliente!, contatos: i.cliente?.contatos ?? [] }),
      )
      if (s === 'fora') continue
      contagem.total++
      if (precisaEnviar(s) || s === 'sem_datas') contagem.pendentes++
      if (s === 'sem_email') contagem.semEmail++
    }
    return contagem
  }

  const cronogramaId = rotaId ? (porRota.get(rotaId)?.id ?? null) : null
  const rotaEscolhida = rotas.data?.find((r) => r.id === rotaId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cronograma</h1>
          <p className="text-sm text-texto-suave">
            Datas do controle de pragas de cada rota no mês, e o aviso a cada cliente por e-mail.
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
          {rotas.isPending || doMes.isPending ? (
            <Carregando />
          ) : rotas.data?.length === 0 ? (
            <p className="p-2 text-sm text-texto-suave">
              Nenhuma rota cadastrada (Serviços › Ordens de serviço › Rotas).
            </p>
          ) : (
            rotas.data?.map((r) => {
              const s = resumo(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRotaId(r.id)}
                  className={cn(
                    'flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                    r.id === rotaId ? 'bg-lima-claro font-semibold' : 'hover:bg-fundo-suave',
                  )}
                >
                  <span>{r.nome}</span>
                  {!s ? (
                    <Etiqueta>Não montada</Etiqueta>
                  ) : s.pendentes ? (
                    <Etiqueta cor={s.semEmail ? 'perigo' : 'alerta'}>
                      {s.pendentes} pendente{s.pendentes > 1 ? 's' : ''}
                    </Etiqueta>
                  ) : (
                    <Etiqueta cor="verde">Avisada</Etiqueta>
                  )}
                </button>
              )
            })
          )}
        </Card>

        <div className="min-w-0">
          {!rotaEscolhida ? (
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
  const algumEnviado = c.itens.some((i) => i.enviado_em)
  const ativos = situacoes.filter((s) => s !== 'fora').length

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{c.rota?.nome}</h2>
            <p className="text-sm text-texto-suave">
              {nomeDoMes(c.mes)} · {ativos} unidade{ativos === 1 ? '' : 's'} no mês
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              onClick={() => salvar.mutate({ id: c.id, datas, horario: horario.trim() || null })}
            >
              {salvar.isPending ? 'Salvando…' : 'Salvar dias'}
            </Button>
          )}
        </div>
        {(mudouDias || mudouHorario) && algumEnviado && (
          <Aviso>Quem já recebeu o aviso vai aparecer como “Datas alteradas: reenviar”.</Aviso>
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
        {c.itens.length === 0 && (
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
            aoEditar={() => setEditando(i)}
          />
        ))}
      </Card>

      {editando && <EditarUnidade item={editando} crono={c} aoFechar={() => setEditando(null)} />}
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
  aoEditar,
}: {
  item: ItemCronograma
  crono: Cronograma
  situacao: Situacao
  aoEditar: () => void
}) {
  const perfil = usePerfil()
  const salvar = useSalvarItem()
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
    <div className={cn('flex flex-col gap-2 p-4', s === 'fora' && 'opacity-60')}>
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
      </div>
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
      {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
    </div>
  )
}

type ModoDias = 'rota' | 'propria' | `so${number}`

function EditarUnidade({
  item: i,
  crono: c,
  aoFechar,
}: {
  item: ItemCronograma
  crono: Cronograma
  aoFechar: () => void
}) {
  const salvar = useSalvarItem()
  const mes = c.mes.slice(0, 7)
  const visitasDaRota = [...c.datas].sort()
  const [incluido, setIncluido] = useState(i.incluido)
  const [modo, setModo] = useState<ModoDias>(
    i.datas ? 'propria' : i.so_visita ? `so${i.so_visita}` : 'rota',
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
            <Campo rotulo="Dias" htmlFor="modo-dias">
              <Select
                id="modo-dias"
                value={modo}
                onChange={(e) => setModo(e.target.value as ModoDias)}
              >
                <option value="rota">Os dias da rota ({textoDosDias(visitasDaRota) || '—'})</option>
                {visitasDaRota.map((d, n) => (
                  <option key={d} value={`so${n + 1}`}>
                    Só a {n + 1}ª visita ({diaCurto(d)})
                  </option>
                ))}
                <option value="propria">Dias próprios</option>
              </Select>
            </Campo>
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
        <div className="flex justify-end gap-2">
          <Button variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            disabled={
              salvar.isPending || (incluido && modo === 'propria' && proprias.invalidos.length > 0)
            }
            onClick={() =>
              salvar.mutate(
                {
                  id: i.id,
                  incluido,
                  datas: modo === 'propria' ? proprias.datas : null,
                  so_visita: modo.startsWith('so') ? Number(modo.slice(2)) : null,
                  horario: horario.trim() || null,
                  observacoes: obs.trim() || null,
                },
                { onSuccess: aoFechar },
              )
            }
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
  // Um e-mail por cliente (CNPJ), com as unidades dele.
  const porCliente = useMemo(() => {
    const m = new Map<string, ItemCronograma[]>()
    for (const i of itens) m.set(i.cliente_id, [...(m.get(i.cliente_id) ?? []), i])
    return [...m.entries()]
  }, [itens])
  const [marcados, setMarcados] = useState(() => new Set(porCliente.map(([id]) => id)))

  const escolhidos = itens.filter((i) => marcados.has(i.cliente_id)).map((i) => i.id)

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Enviar os avisos">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">
          Um e-mail para cada cliente, saindo de <strong>{UNIDADE.cronograma?.emailSac}</strong>{' '}
          (com cópia oculta para o SAC). A resposta do cliente vai para o SAC.
        </p>
        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {porCliente.map(([clienteId, unidades]) => {
            const cli = unidades[0].cliente
            return (
              <li key={clienteId} className="rounded-xl border border-borda p-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 accent-verde"
                    checked={marcados.has(clienteId)}
                    onChange={(e) => {
                      const novo = new Set(marcados)
                      if (e.target.checked) novo.add(clienteId)
                      else novo.delete(clienteId)
                      setMarcados(novo)
                    }}
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold">{nomeCliente(cli)}</span>
                    <span className="text-xs text-texto-suave">Para: {emailDoAviso(cli)}</span>
                    {unidades.map((u) => (
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
                  </span>
                </label>
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
              enviar.mutate({ cronogramaId: c.id, itemIds: escolhidos }, { onSuccess: aoEnviar })
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
