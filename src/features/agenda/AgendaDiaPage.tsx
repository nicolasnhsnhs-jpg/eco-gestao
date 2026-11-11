import {
  ArrowDown,
  ArrowUp,
  BellRing,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImageDown,
  Plus,
  Star,
  Trash2,
  Tv,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ComponentProps } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_EDITAR_AGENDA, PAPEIS_GESTAO } from '@/lib/papeis'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import {
  useAgenda,
  useAgendaTempoReal,
  useApagarTecnico,
  useApagarVeiculo,
  useCadastroAgenda,
  useSalvarTecnico,
  useSalvarVeiculo,
  useApagarItem,
  useCopiarItens,
  useCriarDia,
  useConferirLembrete,
  useCriarItem,
  useDiasComAgenda,
  useLembretesAgenda,
  useSalvarDia,
  useSalvarItem,
  type Conexao,
  type Presente,
} from './api'
import {
  baixar,
  compartilharOuBaixar,
  copiarAgendaNoDrive,
  copiarImagem,
  gerarImagem,
} from './imagem'
import { QuadroAgenda, QuadroAjustado } from './QuadroAgenda'
import {
  alternarAvulso,
  conferirComCadastro,
  partesDaDescricao,
  escreverTecnicos,
  lerEscalas,
  lerTecnicos,
  veiculosSemSemParar,
  ordenarItens,
  almocoPadrao,
  NOME_ALMOCO,
  proximoAlmoco,
  type Almoco,
  type AgendaDia,
  type AgendaItem,
  type Escala,
  type Tecnico,
  type Veiculo,
} from './regras'

/*
 * Agenda do dia: quem tem a aba preenche, todos ao mesmo tempo, e a prévia de cima
 * mostra como o quadro está ficando. Pronta, vira imagem para o grupo dos operadores.
 */

/** Dia útil anterior (na segunda, volta para a sexta). */
function diaAnterior(data: string) {
  const semana = new Date(`${data}T12:00:00`).getDay()
  return somarDias(data, semana === 1 ? -3 : semana === 0 ? -2 : -1)
}

export function AgendaDiaPage() {
  const perfil = usePerfil()
  const [params, setParams] = useSearchParams()
  const data = params.get('data') || hojeISO()
  const irPara = (d: string) => setParams(d === hojeISO() ? {} : { data: d }, { replace: true })

  const agenda = useAgenda(data)
  const { presentes, conexao } = useAgendaTempoReal(data, perfil.id, perfil.nome)
  const [mostrarPrevia, setMostrarPrevia] = useState(true)
  const podeEditar = PAPEIS_EDITAR_AGENDA.includes(perfil.papel)
  const podeConferir = podeEditar && PAPEIS_GESTAO.includes(perfil.papel)
  const cadastro = useCadastroAgenda()
  const tecnicos = cadastro.data?.tecnicos ?? []
  const veiculos = cadastro.data?.veiculos ?? []

  const rolarAte = (id: string) => {
    const el = document.getElementById(`agenda-item-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.querySelector<HTMLInputElement>('input[name="descricao"]')?.focus({ preventScroll: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-2xl font-bold">Agenda do dia</h1>
          <div className="flex items-center gap-1 rounded-xl border border-borda bg-white p-1">
            <button
              type="button"
              aria-label="Dia anterior"
              onClick={() => irPara(somarDias(data, -1))}
              className="grid size-9 place-items-center rounded-lg hover:bg-lima-claro"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <Input
              type="date"
              aria-label="Data da agenda"
              value={data}
              onChange={(e) => e.target.value && irPara(e.target.value)}
              className="min-h-9 w-auto border-0 px-2 focus:ring-0"
            />
            <button
              type="button"
              aria-label="Próximo dia"
              onClick={() => irPara(somarDias(data, 1))}
              className="grid size-9 place-items-center rounded-lg hover:bg-lima-claro"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
          {data !== hojeISO() && (
            <Button variante="fantasma" className="min-h-9" onClick={() => irPara(hojeISO())}>
              Hoje
            </Button>
          )}
        </div>
        <QuemEsta presentes={presentes} conexao={conexao} />
      </div>

      <ProximosDias data={data} irPara={irPara} />

      <LembretesPropostas data={data} podeConferir={podeEditar} />

      {agenda.isPending && <Carregando />}
      {agenda.isError && <Aviso tipo="erro">{mensagemDeErro(agenda.error)}</Aviso>}

      {!podeEditar && (
        <Aviso tipo="info">
          Você só consulta a agenda: as mudanças aparecem aqui ao vivo, mas não dá para alterar.
        </Aviso>
      )}

      {agenda.data && !agenda.data.dia && podeEditar && <CriarDia data={data} />}
      {agenda.data && !agenda.data.dia && !podeEditar && (
        <Card className="p-6 text-center text-texto-suave">Este dia ainda não tem agenda.</Card>
      )}

      {agenda.data?.dia && (
        <>
          <Card className="flex flex-col gap-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-texto-suave">
                {podeEditar ? 'Prévia do quadro. Clique numa linha para editar.' : 'Quadro do dia.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variante="fantasma" onClick={() => setMostrarPrevia((v) => !v)}>
                  {mostrarPrevia ? (
                    <EyeOff className="size-5" aria-hidden />
                  ) : (
                    <Eye className="size-5" aria-hidden />
                  )}
                  {mostrarPrevia ? 'Esconder prévia' : 'Mostrar prévia'}
                </Button>
                <Link
                  to={`/agenda-tv${data === hojeISO() ? '' : `?data=${data}`}`}
                  target="_blank"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
                >
                  <Tv className="size-5" aria-hidden /> Abrir na TV
                </Link>
                <ExportarImagem
                  dia={agenda.data.dia}
                  itens={agenda.data.itens}
                  veiculos={veiculos}
                />
              </div>
            </div>
            {mostrarPrevia && (
              <div className="overflow-hidden rounded-xl border border-borda">
                <QuadroAjustado ajuste="largura">
                  {(k) => (
                    <QuadroAgenda
                      dia={agenda.data.dia!}
                      itens={agenda.data.itens}
                      veiculos={veiculos}
                      modo="tela"
                      onClicarItem={podeEditar ? rolarAte : undefined}
                      style={{ transform: `scale(${k})` }}
                    />
                  )}
                </QuadroAjustado>
              </div>
            )}
          </Card>

          {podeEditar && (
            <>
              <Linhas
                data={data}
                itens={agenda.data.itens}
                tecnicos={tecnicos}
                veiculos={veiculos}
                podeConferir={podeConferir}
              />
              <DadosDoDia dia={agenda.data.dia} tecnicos={tecnicos} />
            </>
          )}
        </>
      )}

      {cadastro.data && (
        <CadastroEquipe tecnicos={tecnicos} veiculos={veiculos} podeEditar={podeConferir} />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Avisos das propostas aprovadas com execução marcada neste dia
// -----------------------------------------------------------------------------

function LembretesPropostas({ data, podeConferir }: { data: string; podeConferir: boolean }) {
  const lembretes = useLembretesAgenda(data)
  const conferir = useConferirLembrete(data)
  const lista = lembretes.data ?? []
  if (lista.length === 0) return null

  return (
    <Card className="flex flex-col gap-3 border-alerta/40 bg-amber-50 p-4">
      <p className="flex items-center gap-2 font-bold text-texto">
        <BellRing className="size-5 text-alerta" aria-hidden />
        {lista.length === 1
          ? '1 serviço de proposta aprovada marcado para este dia'
          : `${lista.length} serviços de propostas aprovadas marcados para este dia`}
      </p>
      <p className="-mt-2 text-sm text-texto-suave">
        O vendedor já combinou com o cliente. Lance na agenda com técnico, carro e horário
        {podeConferir && ' e depois tire o aviso'}.
      </p>
      <ul className="flex flex-col gap-2">
        {lista.map((l) => (
          <li
            key={l.proposta_id}
            className="flex flex-wrap items-start gap-3 rounded-xl border border-borda bg-white p-3"
          >
            <span className="w-14 shrink-0 pt-0.5 font-bold text-verde-escuro">
              {l.hora ? l.hora.slice(0, 5) : '—'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {l.cliente}{' '}
                <Link
                  to={`/propostas/${l.proposta_id}`}
                  className="text-sm font-normal text-verde underline"
                >
                  proposta {l.numero}
                </Link>
              </p>
              {l.servicos && <p className="text-sm">{l.servicos}</p>}
              <p className="text-sm text-texto-suave">
                {[l.endereco, l.vendedor && `Vendedor: ${l.vendedor}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            {podeConferir && (
              <Button
                variante="secundario"
                className="min-h-9"
                disabled={conferir.isPending}
                onClick={() => conferir.mutate(l.proposta_id)}
              >
                <Check className="size-4" aria-hidden /> Já lancei, tirar aviso
              </Button>
            )}
          </li>
        ))}
      </ul>
      {conferir.isError && <Aviso tipo="erro">{mensagemDeErro(conferir.error)}</Aviso>}
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Faixa dos próximos dias (para ir deixando a semana que vem pronta)
// -----------------------------------------------------------------------------

const DIAS_NA_FAIXA = 15

function ProximosDias({ data, irPara }: { data: string; irPara: (d: string) => void }) {
  const hoje = hojeISO()
  const ate = somarDias(hoje, DIAS_NA_FAIXA - 1)
  const preenchidos = useDiasComAgenda(hoje, ate)
  const dias = Array.from({ length: DIAS_NA_FAIXA }, (_, i) => somarDias(hoje, i))
  const selecionado = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selecionado.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [data])

  return (
    <nav aria-label="Próximos dias" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {dias.map((d) => {
        const dt = new Date(`${d}T12:00:00`)
        const semana = dt.getDay()
        const linhas = preenchidos.data?.get(d)
        const comecada = linhas !== undefined
        const ativo = d === data
        return (
          <button
            key={d}
            ref={ativo ? selecionado : undefined}
            type="button"
            onClick={() => irPara(d)}
            aria-current={ativo ? 'date' : undefined}
            className={cn(
              'flex min-w-[4.6rem] shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 text-center',
              ativo
                ? 'border-verde bg-verde text-white'
                : comecada
                  ? 'border-lima bg-lima-claro text-verde-escuro hover:border-verde'
                  : 'border-borda bg-white text-texto-suave hover:bg-fundo-suave',
              semana === 0 && !ativo && 'opacity-60',
            )}
          >
            <span className="text-[11px] font-bold tracking-wider uppercase">
              {d === hoje
                ? 'Hoje'
                : dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
            </span>
            <span className="text-base leading-tight font-extrabold">
              {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
            <span className={cn('text-[11px] font-semibold', ativo ? 'text-white/85' : '')}>
              {!comecada ? '—' : linhas === 1 ? '1 linha' : `${linhas} linhas`}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// -----------------------------------------------------------------------------
// Quem está com a agenda aberta
// -----------------------------------------------------------------------------

function QuemEsta({ presentes, conexao }: { presentes: Presente[]; conexao: Conexao }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {presentes.length > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-2">
            {presentes.slice(0, 5).map((p) => (
              <span
                key={p.id}
                title={p.nome}
                className="grid size-8 place-items-center rounded-full border-2 border-white bg-verde text-xs font-bold text-white"
              >
                {p.nome
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </span>
            ))}
          </div>
          <span className="text-texto-suave">
            {presentes.length === 1
              ? `${presentes[0].nome.split(' ')[0]} também está aqui`
              : `${presentes.length} pessoas também estão aqui`}
          </span>
        </div>
      )}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold',
          conexao === 'conectado' && 'bg-lima-claro text-verde-escuro',
          conexao === 'conectando' && 'bg-fundo-suave text-texto-suave',
          conexao === 'caiu' && 'bg-red-50 text-perigo',
        )}
      >
        {conexao === 'caiu' ? (
          <WifiOff className="size-4" aria-hidden />
        ) : (
          <Wifi className="size-4" aria-hidden />
        )}
        {conexao === 'conectado'
          ? 'Ao vivo'
          : conexao === 'conectando'
            ? 'Conectando…'
            : 'Sem conexão ao vivo'}
      </span>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Dia ainda não criado
// -----------------------------------------------------------------------------

function CriarDia({ data }: { data: string }) {
  const criar = useCriarDia()
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <CalendarPlus className="size-10 text-verde" aria-hidden />
      <div>
        <p className="text-lg font-bold">A agenda de {formatarData(data)} ainda não foi começada</p>
        <p className="text-sm text-texto-suave">
          A escala, os veículos sem Sem Parar e a mensagem vêm do último dia preenchido.
        </p>
      </div>
      {criar.isError && <Aviso tipo="erro">{mensagemDeErro(criar.error)}</Aviso>}
      <Button onClick={() => criar.mutate(data)} disabled={criar.isPending}>
        <Plus className="size-5" aria-hidden /> Começar a agenda
      </Button>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Exportar em imagem
// -----------------------------------------------------------------------------

function ExportarImagem({
  dia,
  itens,
  veiculos,
}: {
  dia: AgendaDia
  itens: AgendaItem[]
  veiculos: Veiculo[]
}) {
  const quadro = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<'' | 'gerando' | 'copiada' | 'pronta' | 'erro'>('')
  const [erro, setErro] = useState('')

  async function gerar(acao: 'compartilhar' | 'copiar' | 'baixar') {
    if (!quadro.current) return
    setEstado('gerando')
    try {
      const blob = await gerarImagem(quadro.current)
      copiarAgendaNoDrive(blob, dia.data)
      if (acao === 'copiar') {
        if (await copiarImagem(blob)) {
          setEstado('copiada')
          return
        }
        baixar(blob, dia.data)
      } else if (acao === 'baixar') {
        baixar(blob, dia.data)
      } else {
        await compartilharOuBaixar(blob, dia.data)
      }
      setEstado('pronta')
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEstado('erro')
    }
  }

  useEffect(() => {
    if (estado !== 'copiada' && estado !== 'pronta') return
    const t = setTimeout(() => setEstado(''), 3000)
    return () => clearTimeout(t)
  }, [estado])

  return (
    <>
      <div className="flex gap-1">
        <Button onClick={() => gerar('compartilhar')} disabled={estado === 'gerando'}>
          <ImageDown className="size-5" aria-hidden />
          {estado === 'gerando'
            ? 'Gerando…'
            : estado === 'pronta'
              ? 'Imagem pronta'
              : 'Gerar imagem'}
        </Button>
        <Button
          variante="secundario"
          aria-label="Copiar imagem (para colar no WhatsApp Web)"
          title="Copiar imagem (para colar no WhatsApp Web)"
          onClick={() => gerar('copiar')}
          disabled={estado === 'gerando'}
        >
          <Copy className="size-5" aria-hidden />
          {estado === 'copiada' && 'Copiada!'}
        </Button>
        <Button
          variante="secundario"
          aria-label="Baixar imagem"
          title="Baixar imagem"
          onClick={() => gerar('baixar')}
          disabled={estado === 'gerando'}
        >
          <Download className="size-5" aria-hidden />
        </Button>
      </div>
      {estado === 'erro' && <Aviso tipo="erro">{erro}</Aviso>}
      {/* O quadro em tamanho real, fora da tela, só para virar imagem (sem R e F). */}
      <div aria-hidden style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
        <QuadroAgenda ref={quadro} dia={dia} itens={itens} veiculos={veiculos} modo="imagem" />
      </div>
    </>
  )
}

// -----------------------------------------------------------------------------
// Campo que grava sozinho (cada campo vai para o banco separado, para duas
// pessoas poderem mexer em linhas e campos diferentes ao mesmo tempo)
// -----------------------------------------------------------------------------

type CampoProps = {
  valor: string
  onSalvar: (v: string) => void
  multilinha?: boolean
} & Omit<ComponentProps<'input'>, 'value' | 'onChange'>

function CampoAuto({ valor, onSalvar, multilinha, className, ...props }: CampoProps) {
  const [rascunho, setRascunho] = useState(valor)
  const focado = useRef(false)
  const enviado = useRef(valor)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Mudou por outra pessoa: atualiza, menos enquanto eu estiver digitando nele.
  useEffect(() => {
    enviado.current = valor
    if (!focado.current) setRascunho(valor)
  }, [valor])

  useEffect(() => () => clearTimeout(timer.current), [])

  const salvar = (v: string) => {
    clearTimeout(timer.current)
    if (v === enviado.current) return
    enviado.current = v
    onSalvar(v)
  }

  const comum = {
    value: rascunho,
    onFocus: () => {
      focado.current = true
    },
    onBlur: () => {
      focado.current = false
      salvar(rascunho)
    },
  }

  if (multilinha) {
    return (
      <Textarea
        {...comum}
        name={props.name}
        placeholder={props.placeholder}
        aria-label={props['aria-label']}
        className={className}
        onChange={(e) => {
          const v = e.target.value
          setRascunho(v)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => salvar(v), 700)
        }}
      />
    )
  }
  return (
    <Input
      {...props}
      {...comum}
      className={className}
      onChange={(e) => {
        const v = e.target.value
        setRascunho(v)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => salvar(v), 700)
      }}
    />
  )
}

// -----------------------------------------------------------------------------
// Linhas da agenda
// -----------------------------------------------------------------------------

function Linhas({
  data,
  itens,
  tecnicos,
  veiculos,
  podeConferir,
}: {
  data: string
  itens: AgendaItem[]
  tecnicos: Tecnico[]
  veiculos: Veiculo[]
  podeConferir: boolean
}) {
  const criar = useCriarItem(data)
  const salvar = useSalvarItem(data)
  const apagar = useApagarItem(data)
  const copiar = useCopiarItens(data)
  const [copiarDe, setCopiarDe] = useState<string | null>(null)
  const lista = ordenarItens(itens)
  const semParar = new Set(veiculosSemSemParar(veiculos))
  const nomeDoTecnico = new Map(tecnicos.map((t) => [t.numero, t.nome]))
  const placaDoVeiculo = new Map(veiculos.map((v) => [v.codigo, v.placa]))

  const adicionar = () => {
    const ultima = lista.at(-1)
    const hora = ultima?.hora ?? '07:30'
    criar.mutate(
      { hora, ordem: Math.max(0, ...lista.map((i) => i.ordem)) + 1, almoco: almocoPadrao(hora) },
      {
        onSuccess: (linha) =>
          setTimeout(
            () =>
              document
                .querySelector<HTMLInputElement>(`#agenda-item-${linha.id} input[name="descricao"]`)
                ?.focus(),
            50,
          ),
      },
    )
  }

  /** Troca a linha de lugar com a vizinha do mesmo horário. */
  const mover = (item: AgendaItem, direcao: -1 | 1) => {
    const grupo = lista.filter((i) => i.hora === item.hora)
    const i = grupo.findIndex((g) => g.id === item.id)
    const j = i + direcao
    if (j < 0 || j >= grupo.length) return
    const nova = [...grupo]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    nova.forEach((g, ordem) => {
      if (g.ordem !== ordem) salvar.mutate({ id: g.id, patch: { ordem } })
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Serviços do dia</h2>
        <div className="flex flex-wrap items-center gap-2">
          {copiarDe === null ? (
            <Button variante="secundario" onClick={() => setCopiarDe(diaAnterior(data))}>
              <Copy className="size-5" aria-hidden /> Copiar de outro dia
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-white p-1 pl-3">
              <span className="text-sm font-semibold">Copiar as linhas de</span>
              <Input
                type="date"
                aria-label="Dia de onde copiar"
                value={copiarDe}
                onChange={(e) => setCopiarDe(e.target.value)}
                className="min-h-9 w-auto"
              />
              <Button
                className="min-h-9"
                disabled={!copiarDe || copiar.isPending}
                onClick={() => {
                  if (!copiarDe) return
                  const ja = lista.filter((i) => i.descricao.trim()).length
                  if (
                    ja > 0 &&
                    !confirm(
                      `Este dia já tem ${ja} ${ja === 1 ? 'linha' : 'linhas'}. As de ${formatarData(copiarDe)} vão ser somadas a elas. Copiar mesmo assim?`,
                    )
                  )
                    return
                  copiar.mutate(copiarDe, {
                    onSuccess: (n) => {
                      if (n === 0) alert(`Não tem linhas na agenda de ${formatarData(copiarDe)}.`)
                      setCopiarDe(null)
                    },
                  })
                }}
              >
                {copiar.isPending ? 'Copiando…' : 'Copiar'}
              </Button>
              <Button variante="fantasma" className="min-h-9" onClick={() => setCopiarDe(null)}>
                Cancelar
              </Button>
            </div>
          )}
          <Button onClick={adicionar} disabled={criar.isPending}>
            <Plus className="size-5" aria-hidden /> Adicionar linha
          </Button>
        </div>
      </div>

      {(criar.isError || salvar.isError || apagar.isError || copiar.isError) && (
        <Aviso tipo="erro">
          {mensagemDeErro(criar.error ?? salvar.error ?? apagar.error ?? copiar.error)}
        </Aviso>
      )}

      {lista.length === 0 && (
        <Card className="text-sm text-texto-suave">
          Nenhuma linha ainda. Use “Adicionar linha” ou copie de outro dia.
        </Card>
      )}

      {/* Sugestões do campo Veículo, a partir do cadastro. */}
      <datalist id="agenda-veiculos">
        {veiculos
          .filter((v) => v.ativo)
          .map((v) => (
            <option key={v.codigo} value={v.codigo}>
              {v.placa}
            </option>
          ))}
      </datalist>

      <ul className="flex flex-col gap-2">
        {lista.map((item) => {
          const grupo = lista.filter((i) => i.hora === item.hora)
          const pos = grupo.findIndex((g) => g.id === item.id)
          const conferencia = conferirComCadastro(item, tecnicos, veiculos)
          const codigo = item.veiculo.trim().toUpperCase()
          const salvarCampo = (patch: Parameters<typeof salvar.mutate>[0]['patch']) =>
            salvar.mutate({ id: item.id, patch })
          return (
            <li
              key={item.id}
              id={`agenda-item-${item.id}`}
              className="flex scroll-mt-24 flex-col gap-2 rounded-2xl border border-borda bg-white p-3 focus-within:border-verde focus-within:ring-2 focus-within:ring-lima/40"
            >
              <div className="grid grid-cols-[6.5rem_1fr] gap-2 md:grid-cols-[6.5rem_1fr_9rem_7rem]">
                <CampoAuto
                  type="time"
                  aria-label="Hora"
                  valor={item.hora}
                  onSalvar={(v) => v && salvarCampo({ hora: v })}
                />
                <CampoAuto
                  name="descricao"
                  aria-label="Empresa e serviço"
                  placeholder="Empresa: serviço   (várias: GHC: LR / IBIS: CI aptos)"
                  valor={item.descricao}
                  onSalvar={(v) => salvarCampo({ descricao: v })}
                  className="font-semibold"
                />
                <CampoAuto
                  aria-label="Técnicos"
                  placeholder="Técnicos: 3, 4"
                  valor={escreverTecnicos(item.tecnicos)}
                  onSalvar={(v) => salvarCampo({ tecnicos: lerTecnicos(v) })}
                />
                <div className="relative">
                  <CampoAuto
                    aria-label="Veículo"
                    placeholder="Veículo"
                    list="agenda-veiculos"
                    valor={item.veiculo}
                    onSalvar={(v) => salvarCampo({ veiculo: v.trim().toUpperCase() })}
                    className="uppercase"
                  />
                  {semParar.has(codigo) && (
                    <span
                      title="Este veículo não tem Sem Parar"
                      className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-amber-400 text-xs font-bold"
                    >
                      !
                    </span>
                  )}
                </div>
              </div>

              {/* Quem são os técnicos e a placa, conferindo com o cadastro. */}
              {(item.tecnicos.length > 0 || codigo) && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texto-suave">
                  {item.tecnicos.map((n) => (
                    <span
                      key={n}
                      className={cn(
                        conferencia.tecnicosDesconhecidos.includes(n) &&
                          'font-semibold text-perigo',
                      )}
                    >
                      <strong>{n}</strong>{' '}
                      {conferencia.tecnicosDesconhecidos.includes(n)
                        ? 'não está no cadastro'
                        : (nomeDoTecnico.get(n) ?? '')}
                    </span>
                  ))}
                  {codigo && (
                    <span
                      className={cn(
                        'ml-auto',
                        conferencia.veiculoDesconhecido && 'font-semibold text-perigo',
                      )}
                    >
                      {conferencia.veiculoDesconhecido
                        ? `Veículo ${codigo} não está no cadastro`
                        : placaDoVeiculo.get(codigo) &&
                          `${codigo} · placa ${placaDoVeiculo.get(codigo)}`}
                    </span>
                  )}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <CampoAuto
                  aria-label="Período"
                  placeholder="Período (ex.: 09/11 a 12/11)"
                  valor={item.periodo}
                  onSalvar={(v) => salvarCampo({ periodo: v })}
                  className="min-h-9 w-52 text-sm"
                />
                <CampoAuto
                  aria-label="Observação da linha"
                  placeholder="Observação em vermelho (ex.: Luciano irá junto)"
                  valor={item.nota}
                  onSalvar={(v) => salvarCampo({ nota: v })}
                  className="min-h-9 min-w-48 flex-1 text-sm"
                />
                <AvulsoPorCliente
                  descricao={item.descricao}
                  marcados={item.avulso_partes}
                  onMudar={(avulso_partes) => salvarCampo({ avulso_partes })}
                />
                <label
                  className="inline-flex items-center gap-1 text-sm text-texto-suave"
                  title="Horário marcado com o cliente. Também brilha se for escrito no texto (ex.: às 9h)"
                >
                  <Star className="size-4 text-amber-500" aria-hidden />
                  <CampoAuto
                    aria-label="Horário do cliente"
                    placeholder="Horário do cliente"
                    valor={item.chegada}
                    onSalvar={(v) => salvarCampo({ chegada: v, horario_cliente: v.trim() !== '' })}
                    className="min-h-9 w-40 text-sm"
                  />
                </label>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    title={`${NOME_ALMOCO[item.almoco as Almoco] ?? ''} (clique para mudar)`}
                    aria-label={NOME_ALMOCO[item.almoco as Almoco] ?? 'Almoço'}
                    onClick={() => salvarCampo({ almoco: proximoAlmoco(item.almoco) })}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1.5 rounded-lg border-2 px-2.5 text-sm font-semibold',
                      item.almoco === 'volta' && 'border-green-700 bg-green-500 text-white',
                      item.almoco === 'fica' && 'border-red-700 bg-red-600 text-white',
                      item.almoco === 'nao_se_aplica' && 'border-borda text-texto-suave',
                    )}
                  >
                    <UtensilsCrossed className="size-4" aria-hidden />
                    {item.almoco === 'volta' ? 'Volta' : item.almoco === 'fica' ? 'Não volta' : '–'}
                  </button>
                  <Conferencia
                    letra="R"
                    titulo="Realizado"
                    ligado={item.realizado}
                    pode={podeConferir}
                    onClick={() => salvarCampo({ realizado: !item.realizado })}
                  />
                  <Conferencia
                    letra="F"
                    titulo="Faturado"
                    ligado={item.faturado}
                    pode={podeConferir}
                    onClick={() => salvarCampo({ faturado: !item.faturado })}
                  />
                  <span className="mx-1 h-6 w-px bg-borda" />
                  <IconeAcao rotulo="Subir" desligado={pos <= 0} onClick={() => mover(item, -1)}>
                    <ArrowUp className="size-4" aria-hidden />
                  </IconeAcao>
                  <IconeAcao
                    rotulo="Descer"
                    desligado={pos >= grupo.length - 1}
                    onClick={() => mover(item, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </IconeAcao>
                  <IconeAcao
                    rotulo="Apagar linha"
                    perigo
                    onClick={() => {
                      if (confirm(`Apagar a linha "${item.descricao || 'sem descrição'}"?`))
                        apagar.mutate(item.id)
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconeAcao>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Um botão de avulso para cada cliente da linha (separados por " / "). */
function AvulsoPorCliente({
  descricao,
  marcados,
  onMudar,
}: {
  descricao: string
  marcados: number[]
  onMudar: (v: number[]) => void
}) {
  const clientes = partesDaDescricao(descricao)
  if (clientes.length <= 1) {
    return (
      <Alternar ligado={marcados.includes(0)} onClick={() => onMudar(alternarAvulso(marcados, 0))}>
        Avulso
      </Alternar>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-sm font-semibold text-texto-suave">Avulso:</span>
      {clientes.map(([nome], i) => (
        <Alternar
          key={i}
          ligado={marcados.includes(i)}
          onClick={() => onMudar(alternarAvulso(marcados, i))}
          titulo={`Marcar ${nome} como atendimento avulso`}
        >
          {nome || `Cliente ${i + 1}`}
        </Alternar>
      ))}
    </span>
  )
}

function Alternar({
  ligado,
  onClick,
  children,
  titulo,
}: {
  ligado: boolean
  onClick: () => void
  children: React.ReactNode
  titulo?: string
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-pressed={ligado}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold',
        ligado
          ? 'border-lime-500 bg-lime-300 text-verde-escuro'
          : 'border-borda bg-white text-texto-suave hover:bg-fundo-suave',
      )}
    >
      {children}
    </button>
  )
}

function Conferencia({
  letra,
  titulo,
  ligado,
  pode,
  onClick,
}: {
  letra: string
  titulo: string
  ligado: boolean
  pode: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={`${titulo}${pode ? '' : ' (só o ADM marca)'}`}
      aria-label={titulo}
      aria-pressed={ligado}
      disabled={!pode}
      onClick={onClick}
      className={cn(
        'grid size-9 place-items-center rounded-lg border-2 text-sm font-extrabold disabled:cursor-not-allowed',
        ligado
          ? 'border-green-700 bg-green-500 text-white'
          : 'border-dashed border-borda text-texto-suave',
      )}
    >
      {letra}
    </button>
  )
}

function IconeAcao({
  rotulo,
  onClick,
  children,
  desligado,
  perigo,
}: {
  rotulo: string
  onClick: () => void
  children: React.ReactNode
  desligado?: boolean
  perigo?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={desligado}
      onClick={onClick}
      className={cn(
        'grid size-9 place-items-center rounded-lg text-texto-suave disabled:opacity-30',
        perigo
          ? 'hover:bg-red-50 hover:text-perigo'
          : 'hover:bg-lima-claro hover:text-verde-escuro',
      )}
    >
      {children}
    </button>
  )
}

// -----------------------------------------------------------------------------
// Escala, veículos, observações e mensagem
// -----------------------------------------------------------------------------

function DadosDoDia({ dia, tecnicos }: { dia: AgendaDia; tecnicos: Tecnico[] }) {
  const ativos = tecnicos.filter((t) => t.ativo)
  const salvar = useSalvarDia(dia.data)
  const escalas = lerEscalas(dia.escalas)
  const salvarEscalas = (nova: Escala[]) => salvar.mutate({ escalas: nova })

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Escala operacional</h2>
        {escalas.map((e, i) => (
          <div key={i} className="grid grid-cols-[5.5rem_auto_5rem_1fr_auto] items-center gap-2">
            <CampoAuto
              aria-label="Início"
              placeholder="06:30"
              valor={e.inicio}
              onSalvar={(v) =>
                salvarEscalas(escalas.map((x, j) => (j === i ? { ...x, inicio: v } : x)))
              }
            />
            <span className="text-sm text-texto-suave">às</span>
            <CampoAuto
              aria-label="Fim"
              placeholder="16h"
              valor={e.fim}
              onSalvar={(v) =>
                salvarEscalas(escalas.map((x, j) => (j === i ? { ...x, fim: v } : x)))
              }
            />
            <CampoAuto
              aria-label="Técnicos da escala"
              placeholder="Técnicos: 5, 7, 9"
              valor={escreverTecnicos(e.tecnicos)}
              onSalvar={(v) =>
                salvarEscalas(
                  escalas.map((x, j) => (j === i ? { ...x, tecnicos: lerTecnicos(v) } : x)),
                )
              }
            />
            <IconeAcao
              rotulo="Tirar escala"
              perigo
              onClick={() => salvarEscalas(escalas.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </IconeAcao>
          </div>
        ))}
        <Button
          variante="secundario"
          className="self-start"
          onClick={() => salvarEscalas([...escalas, { inicio: '', fim: '', tecnicos: [] }])}
        >
          <Plus className="size-5" aria-hidden /> Escala
        </Button>
        <p className="text-sm text-texto-suave">
          A cor de cada técnico no quadro segue a escala dele.
        </p>
        {(() => {
          const naEscala = new Set(escalas.flatMap((e) => e.tecnicos))
          const fora = ativos.filter((t) => !naEscala.has(t.numero))
          return fora.length > 0 ? (
            <p className="text-sm text-alerta">
              Fora das escalas: {fora.map((t) => `${t.numero} ${t.nome}`).join(', ')}
            </p>
          ) : null
        })()}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold">Observações (uma por linha)</label>
          <CampoAuto
            multilinha
            aria-label="Observações"
            placeholder="Ex.: Reunião às 17h com toda a equipe"
            valor={dia.observacoes}
            onSalvar={(v) => salvar.mutate({ observacoes: v })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold">Mensagem</label>
          <CampoAuto
            aria-label="Mensagem"
            placeholder="Excelente semana!"
            valor={dia.mensagem}
            onSalvar={(v) => salvar.mutate({ mensagem: v })}
          />
        </div>
        {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
      </Card>
    </section>
  )
}

// -----------------------------------------------------------------------------
// Cadastro de técnicos e veículos (o mesmo para todos os dias)
// -----------------------------------------------------------------------------

function CadastroEquipe({
  tecnicos,
  veiculos,
  podeEditar,
}: {
  tecnicos: Tecnico[]
  veiculos: Veiculo[]
  podeEditar: boolean
}) {
  const salvarTecnico = useSalvarTecnico()
  const apagarTecnico = useApagarTecnico()
  const salvarVeiculo = useSalvarVeiculo()
  const apagarVeiculo = useApagarVeiculo()
  const [novoTec, setNovoTec] = useState({ numero: '', nome: '', cnh: '' })
  const [novoVeic, setNovoVeic] = useState({ codigo: '', placa: '' })
  const erro =
    salvarTecnico.error ?? apagarTecnico.error ?? salvarVeiculo.error ?? apagarVeiculo.error

  const ativosTec = tecnicos.filter((t) => t.ativo).length
  const ativosVeic = veiculos.filter((v) => v.ativo).length

  return (
    <details
      className="group rounded-2xl border border-borda bg-white"
      open={tecnicos.length === 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
        <span>
          <span className="text-lg font-bold">Técnicos e veículos</span>
          <span className="ml-2 text-sm text-texto-suave">
            {ativosTec} técnicos · {ativosVeic} veículos
          </span>
        </span>
        <ChevronRight className="size-5 transition-transform group-open:rotate-90" aria-hidden />
      </summary>

      <div className="grid gap-4 border-t border-borda p-4 lg:grid-cols-2">
        {!podeEditar && (
          <p className="text-sm text-texto-suave lg:col-span-2">
            Só o ADM, o financeiro e o administrador mudam este cadastro.
          </p>
        )}
        {erro && (
          <div className="lg:col-span-2">
            <Aviso tipo="erro">{mensagemDeErro(erro)}</Aviso>
          </div>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="font-bold">Técnicos</h3>
          <div className="grid grid-cols-[3.5rem_1fr_4.5rem_auto] items-center gap-x-2 gap-y-1.5 text-sm">
            <span className="font-semibold text-texto-suave">Nº</span>
            <span className="font-semibold text-texto-suave">Nome</span>
            <span className="font-semibold text-texto-suave">CNH</span>
            <span />
            {tecnicos.map((t) => (
              <Fragment key={t.numero}>
                <strong className={cn('text-base', !t.ativo && 'text-texto-suave line-through')}>
                  {String(t.numero).padStart(2, '0')}
                </strong>
                <CampoAuto
                  aria-label={'Nome do técnico ' + t.numero}
                  valor={t.nome}
                  disabled={!podeEditar}
                  onSalvar={(v) => v.trim() && salvarTecnico.mutate({ ...t, nome: v.trim() })}
                  className="min-h-9"
                />
                <CampoAuto
                  aria-label={'CNH do técnico ' + t.numero}
                  valor={t.cnh}
                  disabled={!podeEditar}
                  onSalvar={(v) => salvarTecnico.mutate({ ...t, cnh: v.trim().toUpperCase() })}
                  className="min-h-9 uppercase"
                />
                <div className="flex gap-1">
                  <Alternar
                    ligado={t.ativo}
                    titulo={
                      t.ativo ? 'Ativo (clique para desativar)' : 'Inativo (clique para ativar)'
                    }
                    onClick={() => podeEditar && salvarTecnico.mutate({ ...t, ativo: !t.ativo })}
                  >
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </Alternar>
                  {podeEditar && (
                    <IconeAcao
                      rotulo={'Apagar técnico ' + t.numero}
                      perigo
                      onClick={() => {
                        if (confirm('Apagar ' + t.numero + ' ' + t.nome + ' do cadastro?'))
                          apagarTecnico.mutate(t.numero)
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </IconeAcao>
                  )}
                </div>
              </Fragment>
            ))}
          </div>
          {podeEditar && (
            <form
              className="mt-1 grid grid-cols-[3.5rem_1fr_4.5rem_auto] gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const numero = Number(novoTec.numero)
                if (!numero || !novoTec.nome.trim()) return
                if (tecnicos.some((t) => t.numero === numero)) {
                  alert('O número ' + numero + ' já está no cadastro.')
                  return
                }
                salvarTecnico.mutate(
                  {
                    numero,
                    nome: novoTec.nome.trim(),
                    cnh: novoTec.cnh.trim().toUpperCase(),
                    ativo: true,
                  },
                  { onSuccess: () => setNovoTec({ numero: '', nome: '', cnh: '' }) },
                )
              }}
            >
              <Input
                aria-label="Número do técnico novo"
                placeholder="Nº"
                inputMode="numeric"
                value={novoTec.numero}
                onChange={(e) =>
                  setNovoTec({ ...novoTec, numero: e.target.value.replace(/\D/g, '') })
                }
                className="min-h-9"
              />
              <Input
                aria-label="Nome do técnico novo"
                placeholder="Nome"
                value={novoTec.nome}
                onChange={(e) => setNovoTec({ ...novoTec, nome: e.target.value })}
                className="min-h-9"
              />
              <Input
                aria-label="CNH do técnico novo"
                placeholder="CNH"
                value={novoTec.cnh}
                onChange={(e) => setNovoTec({ ...novoTec, cnh: e.target.value })}
                className="min-h-9 uppercase"
              />
              <Button type="submit" className="min-h-9" disabled={salvarTecnico.isPending}>
                <Plus className="size-4" aria-hidden /> Técnico
              </Button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-bold">Veículos</h3>
          <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-2 gap-y-1.5 text-sm">
            <span className="font-semibold text-texto-suave">Código</span>
            <span className="font-semibold text-texto-suave">Placa</span>
            <span />
            {veiculos.map((v) => (
              <Fragment key={v.codigo}>
                <strong className={cn('text-base', !v.ativo && 'text-texto-suave line-through')}>
                  {v.codigo}
                </strong>
                <CampoAuto
                  aria-label={'Placa do veículo ' + v.codigo}
                  valor={v.placa}
                  disabled={!podeEditar}
                  onSalvar={(p) => salvarVeiculo.mutate({ ...v, placa: p.trim().toUpperCase() })}
                  className="min-h-9 uppercase"
                />
                <div className="flex gap-1">
                  <Alternar
                    ligado={!v.tem_sem_parar}
                    titulo="Ligado quando o veículo NÃO tem Sem Parar"
                    onClick={() =>
                      podeEditar && salvarVeiculo.mutate({ ...v, tem_sem_parar: !v.tem_sem_parar })
                    }
                  >
                    {v.tem_sem_parar ? 'Tem Sem Parar' : 'Sem Sem Parar'}
                  </Alternar>
                  <Alternar
                    ligado={v.ativo}
                    titulo={
                      v.ativo ? 'Ativo (clique para desativar)' : 'Inativo (clique para ativar)'
                    }
                    onClick={() => podeEditar && salvarVeiculo.mutate({ ...v, ativo: !v.ativo })}
                  >
                    {v.ativo ? 'Ativo' : 'Inativo'}
                  </Alternar>
                  {podeEditar && (
                    <IconeAcao
                      rotulo={'Apagar veículo ' + v.codigo}
                      perigo
                      onClick={() => {
                        if (confirm('Apagar o veículo ' + v.codigo + ' do cadastro?'))
                          apagarVeiculo.mutate(v.codigo)
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </IconeAcao>
                  )}
                </div>
              </Fragment>
            ))}
          </div>
          {podeEditar && (
            <form
              className="mt-1 grid grid-cols-[4.5rem_1fr_auto] gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const codigo = novoVeic.codigo.trim().toUpperCase()
                if (!codigo) return
                if (veiculos.some((v) => v.codigo === codigo)) {
                  alert('O veículo ' + codigo + ' já está no cadastro.')
                  return
                }
                salvarVeiculo.mutate(
                  {
                    codigo,
                    placa: novoVeic.placa.trim().toUpperCase(),
                    tem_sem_parar: true,
                    ativo: true,
                  },
                  { onSuccess: () => setNovoVeic({ codigo: '', placa: '' }) },
                )
              }}
            >
              <Input
                aria-label="Código do veículo novo"
                placeholder="Código"
                value={novoVeic.codigo}
                onChange={(e) => setNovoVeic({ ...novoVeic, codigo: e.target.value })}
                className="min-h-9 uppercase"
              />
              <Input
                aria-label="Placa do veículo novo"
                placeholder="Placa"
                value={novoVeic.placa}
                onChange={(e) => setNovoVeic({ ...novoVeic, placa: e.target.value })}
                className="min-h-9 uppercase"
              />
              <Button type="submit" className="min-h-9" disabled={salvarVeiculo.isPending}>
                <Plus className="size-4" aria-hidden /> Veículo
              </Button>
            </form>
          )}
        </section>
      </div>
    </details>
  )
}
