import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, formatarDataHora, hojeISO, somarDias } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { useAvisosNaoLidos } from '../avisos/api'
import { useAtendimentosRecentes } from '../clientes/api'
import { usePainel } from '../financeiro/api'
import { useMinhasComissoes } from '../financeiro/comissoesApi'
import { usePropostas } from '../propostas/api'
import { useServicos, useVencimentos } from '../servicos/api'

/** Tela inicial: o que cada perfil precisa ver primeiro ao entrar. */
export function InicioPage() {
  const perfil = usePerfil()
  const primeiroNome = perfil.nome.split(' ')[0]
  const acessoTotal = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const recepcao = perfil.papel === 'recepcao'

  return (
    <>
      <PageHeader titulo={`Olá, ${primeiroNome}!`} />
      <BuscaRapida />
      <div className="grid gap-5 lg:grid-cols-2">
        {acessoTotal && <ResumoFinanceiro />}
        {perfil.papel === 'vendedor' && <MinhaComissao />}
        <Avisos />
        <Vencimentos comLink={!recepcao} />
        {!recepcao && <Agenda />}
        {!recepcao && <PropostasAguardando />}
        <UltimosAtendimentos />
      </div>
    </>
  )
}

function BuscaRapida() {
  const navegar = useNavigate()
  return (
    <form
      className="relative mb-6"
      onSubmit={(e) => {
        e.preventDefault()
        const termo = new FormData(e.currentTarget).get('q')?.toString().trim()
        navegar(termo ? `/clientes?q=${encodeURIComponent(termo)}` : '/clientes')
      }}
    >
      <label htmlFor="busca-rapida" className="sr-only">
        Buscar cliente
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave"
        aria-hidden
      />
      <Input
        id="busca-rapida"
        name="q"
        type="search"
        placeholder="Buscar cliente por nome, CPF/CNPJ ou telefone"
        className="pl-10"
      />
    </form>
  )
}

function Bloco({
  titulo,
  link,
  textoLink = 'Ver tudo',
  carregando,
  children,
}: {
  titulo: string
  link?: string
  textoLink?: string
  carregando?: boolean
  children: ReactNode
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {link && (
          <Link to={link} className="text-sm font-semibold text-verde underline">
            {textoLink}
          </Link>
        )}
      </div>
      {carregando ? <Carregando /> : children}
    </Card>
  )
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-texto-suave">{children}</p>
}

function Numero({ rotulo, valor, perigo }: { rotulo: string; valor: string; perigo?: boolean }) {
  return (
    <div className={cn('rounded-xl p-3', perigo ? 'bg-red-50 text-perigo' : 'bg-fundo-suave')}>
      <p className="text-xs text-texto-suave">{rotulo}</p>
      <p className="font-titulo text-lg font-bold">{valor}</p>
    </div>
  )
}

function ResumoFinanceiro() {
  const painel = usePainel()
  const p = painel.data
  return (
    <Bloco
      titulo="Financeiro hoje"
      link="/financeiro"
      textoLink="Abrir painel"
      carregando={painel.isPending}
    >
      {p && (
        <div className="grid grid-cols-2 gap-2">
          <Numero rotulo="Saldo atual" valor={formatarReais(p.saldo_atual)} />
          <Numero rotulo="A receber hoje" valor={formatarReais(p.receber_hoje)} />
          <Numero
            rotulo="Recebimentos atrasados"
            valor={formatarReais(p.receber_atrasado)}
            perigo={p.receber_atrasado > 0}
          />
          <Numero
            rotulo="Pagamentos atrasados"
            valor={formatarReais(p.pagar_atrasado)}
            perigo={p.pagar_atrasado > 0}
          />
        </div>
      )}
    </Bloco>
  )
}

function MinhaComissao() {
  const comissoes = useMinhasComissoes()
  const mes = `${hojeISO().slice(0, 7)}-01`
  const lista = comissoes.data ?? []
  const soma = (l: typeof lista) => l.reduce((s, c) => s + Number(c.valor), 0)
  return (
    <Bloco titulo="Minha comissão" link="/comissoes" carregando={comissoes.isPending}>
      <div className="grid grid-cols-2 gap-2">
        <Numero
          rotulo="Vendas deste mês"
          valor={formatarReais(soma(lista.filter((c) => c.competencia === mes)))}
        />
        <Numero
          rotulo="Ainda não paga"
          valor={formatarReais(soma(lista.filter((c) => c.status === 'prevista')))}
        />
      </div>
    </Bloco>
  )
}

function Avisos() {
  const naoLidos = useAvisosNaoLidos()
  const total = naoLidos.data ?? 0
  return (
    <Bloco titulo="Avisos" link="/avisos" textoLink="Abrir" carregando={naoLidos.isPending}>
      <p className={cn('text-sm', total > 0 ? 'font-semibold text-perigo' : 'text-texto-suave')}>
        {total > 0 ? `${total} aviso(s) não lido(s).` : 'Nenhum aviso novo.'}
      </p>
    </Bloco>
  )
}

function Vencimentos({ comLink }: { comLink: boolean }) {
  const vencimentos = useVencimentos({ ateDias: 30 })
  const lista = (vencimentos.data ?? []).slice(0, 6)
  return (
    <Bloco
      titulo="Vencendo nos próximos 30 dias"
      link={comLink ? '/servicos/vencimentos' : undefined}
      carregando={vencimentos.isPending}
    >
      {lista.length === 0 && <Vazio>Nenhum serviço vencendo.</Vazio>}
      <ul className="flex flex-col gap-2 text-sm">
        {lista.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2">
            <Link to={`/clientes/${v.cliente_id}`} className="min-w-0 truncate hover:underline">
              <strong>{v.tipo?.nome}</strong> · {v.cliente?.nome_fantasia || v.cliente?.nome}
            </Link>
            <span
              className={cn(
                'shrink-0',
                (v.dias_para_vencer ?? 0) < 0 ? 'font-semibold text-perigo' : 'text-texto-suave',
              )}
            >
              {formatarData(v.proxima_data)}
            </span>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

function Agenda() {
  const hoje = hojeISO()
  const agenda = useServicos({ status: 'agendado', ate: somarDias(hoje, 14) })
  const lista = (agenda.data ?? []).slice(0, 6)
  return (
    <Bloco titulo="Agenda dos próximos 14 dias" link="/servicos" carregando={agenda.isPending}>
      {lista.length === 0 && <Vazio>Nenhum serviço agendado.</Vazio>}
      <ul className="flex flex-col gap-2 text-sm">
        {lista.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2">
            <Link to={`/servicos/${s.id}`} className="min-w-0 truncate hover:underline">
              <strong>{s.tipo?.nome}</strong> · {s.cliente?.nome_fantasia || s.cliente?.nome}
            </Link>
            <span
              className={cn(
                'shrink-0',
                s.data_execucao < hoje ? 'font-semibold text-perigo' : 'text-texto-suave',
              )}
            >
              {formatarData(s.data_execucao)}
            </span>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

function PropostasAguardando() {
  const propostas = usePropostas()
  const aguardando = (propostas.data ?? []).filter((p) => p.status === 'enviada').slice(0, 6)
  return (
    <Bloco
      titulo="Propostas aguardando resposta"
      link="/propostas?situacao=enviada"
      carregando={propostas.isPending}
    >
      {aguardando.length === 0 && <Vazio>Nenhuma proposta aguardando.</Vazio>}
      <ul className="flex flex-col gap-2 text-sm">
        {aguardando.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2">
            <Link to={`/propostas/${p.id}`} className="min-w-0 truncate hover:underline">
              <strong>{p.numero}</strong> · {p.cliente?.nome_fantasia || p.cliente?.nome}
            </Link>
            <span className="shrink-0 text-texto-suave">
              {p.dias_sem_resposta ? `há ${p.dias_sem_resposta} dia(s)` : 'hoje'}
            </span>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

function UltimosAtendimentos() {
  const atendimentos = useAtendimentosRecentes(8)
  const lista = atendimentos.data ?? []
  return (
    <Bloco titulo="Últimos atendimentos" carregando={atendimentos.isPending}>
      {lista.length === 0 && <Vazio>Nenhum atendimento registrado.</Vazio>}
      <ul className="flex flex-col gap-2 text-sm">
        {lista.map((a) => (
          <li key={a.id}>
            <Link to={`/clientes/${a.cliente_id}`} className="hover:underline">
              <strong>{a.cliente?.nome_fantasia || a.cliente?.nome}</strong>
            </Link>
            <span className="text-texto-suave">
              {' '}
              · {a.usuario?.nome} · {formatarDataHora(a.data_hora)}
            </span>
            <p className="truncate text-texto-suave">{a.resumo}</p>
          </li>
        ))}
      </ul>
    </Bloco>
  )
}
