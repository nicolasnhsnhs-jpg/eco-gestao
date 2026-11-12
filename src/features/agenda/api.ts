import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import { compararVeiculos } from './regras'
import type { AgendaDia, AgendaItem, Escala, Tecnico, Veiculo } from './regras'

/*
 * Agenda do dia: um registro por dia (agenda_dias) e as linhas (agenda_itens).
 * Todo mundo que tem a aba Agenda mexe ao mesmo tempo: cada campo é gravado sozinho
 * e as mudanças dos outros chegam pelo Realtime (useAgendaTempoReal).
 */

export type Agenda = { dia: AgendaDia | null; itens: AgendaItem[] }

const chave = (data: string) => ['agenda', data] as const

export function useAgenda(data: string) {
  return useQuery({
    queryKey: chave(data),
    queryFn: async (): Promise<Agenda> => {
      const [dia, itens] = await Promise.all([
        supabase.from('agenda_dias').select('*').eq('data', data).maybeSingle(),
        supabase.from('agenda_itens').select('*').eq('data', data),
      ])
      if (dia.error) throw dia.error
      if (itens.error) throw itens.error
      return { dia: dia.data, itens: itens.data }
    },
  })
}

// -----------------------------------------------------------------------------
// Cadastro de técnicos e veículos (o mesmo para todos os dias)
// -----------------------------------------------------------------------------

export type Cadastro = { tecnicos: Tecnico[]; veiculos: Veiculo[] }
const CHAVE_CADASTRO = ['agenda-cadastro'] as const

export function useCadastroAgenda() {
  return useQuery({
    queryKey: CHAVE_CADASTRO,
    queryFn: async (): Promise<Cadastro> => {
      const [tecnicos, veiculos] = await Promise.all([
        supabase.from('agenda_tecnicos').select('*').order('numero'),
        supabase.from('agenda_veiculos').select('*').order('codigo'),
      ])
      if (tecnicos.error) throw tecnicos.error
      if (veiculos.error) throw veiculos.error
      // Veículos pela numeração do código (ON4, GO6, ON7, CM8...).
      const porCodigo = [...veiculos.data].sort((a, b) => compararVeiculos(a.codigo, b.codigo))
      return { tecnicos: tecnicos.data, veiculos: porCodigo }
    },
    staleTime: 5 * 60_000,
  })
}

function useMudarCadastro<T>(fazer: (v: T) => PromiseLike<{ error: unknown }>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: T) => {
      const { error } = await fazer(v)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_CADASTRO }),
  })
}

export const useSalvarTecnico = () =>
  useMudarCadastro((t: Pick<Tecnico, 'numero' | 'nome' | 'cnh' | 'ativo'>) =>
    supabase.from('agenda_tecnicos').upsert(t, { onConflict: 'numero' }),
  )
export const useApagarTecnico = () =>
  useMudarCadastro((numero: number) =>
    supabase.from('agenda_tecnicos').delete().eq('numero', numero),
  )
export const useSalvarVeiculo = () =>
  useMudarCadastro((v: Pick<Veiculo, 'codigo' | 'placa' | 'tem_sem_parar' | 'ativo'>) =>
    supabase.from('agenda_veiculos').upsert(v, { onConflict: 'codigo' }),
  )
export const useApagarVeiculo = () =>
  useMudarCadastro((codigo: string) =>
    supabase.from('agenda_veiculos').delete().eq('codigo', codigo),
  )

/**
 * Dias entre "de" e "ate" que já têm agenda começada, com quantas linhas preenchidas.
 * Serve para a faixa dos próximos dias (dá para deixar a semana que vem pronta).
 */
export function useDiasComAgenda(de: string, ate: string) {
  return useQuery({
    queryKey: ['agenda-faixa', de, ate],
    queryFn: async () => {
      const [dias, itens] = await Promise.all([
        supabase.from('agenda_dias').select('data').gte('data', de).lte('data', ate),
        supabase
          .from('agenda_itens')
          .select('data')
          .gte('data', de)
          .lte('data', ate)
          .neq('descricao', ''),
      ])
      if (dias.error) throw dias.error
      if (itens.error) throw itens.error
      const contagem = new Map<string, number>(dias.data.map((d) => [d.data, 0]))
      for (const i of itens.data) contagem.set(i.data, (contagem.get(i.data) ?? 0) + 1)
      return contagem
    },
  })
}

/** Cria o dia copiando escalas, veículos e mensagem do último dia que já existe. */
export function useCriarDia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: string) => {
      const { data: base, error: e1 } = await supabase
        .from('agenda_dias')
        .select('mensagem, escalas')
        .lt('data', data)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (e1) throw e1
      const padrao = {
        escalas: [
          { inicio: '06:30', fim: '16h', tecnicos: [] },
          { inicio: '07:30', fim: '17h', tecnicos: [] },
        ] satisfies Escala[],
      }
      // Se duas pessoas criarem juntas, a segunda só pega o que já existe.
      const { error } = await supabase
        .from('agenda_dias')
        .upsert({ data, ...(base ?? padrao) }, { onConflict: 'data', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: (_r, data) => {
      void qc.invalidateQueries({ queryKey: chave(data) })
      void qc.invalidateQueries({ queryKey: ['agenda-faixa'] })
    },
  })
}

/*
 * Gravações de uma mesma linha (ou do mesmo dia) vão uma de cada vez, na ordem em
 * que foram feitas. Sem isso, preenchendo vários campos rápido, uma gravação mais
 * antiga podia chegar ao banco depois da nova e desfazer o que acabou de ser escrito.
 */
const filas = new Map<string, Promise<unknown>>()

function emFila<T>(chaveFila: string, fazer: () => Promise<T>): Promise<T> {
  const antes = filas.get(chaveFila) ?? Promise.resolve()
  const agora = antes.then(fazer, fazer)
  filas.set(chaveFila, agora)
  const limpar = () => {
    if (filas.get(chaveFila) === agora) filas.delete(chaveFila)
  }
  agora.then(limpar, limpar)
  return agora
}

export function useSalvarDia(data: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: TablesUpdate<'agenda_dias'>) =>
      emFila(`dia:${data}`, async () => {
        const { error } = await supabase.from('agenda_dias').update(patch).eq('data', data)
        if (error) throw error
      }),
    onMutate: async (patch) => {
      // Uma recarga já a caminho traria o dia de antes desta mudança: cancela.
      await qc.cancelQueries({ queryKey: chave(data) })
      qc.setQueryData<Agenda>(chave(data), (a) =>
        a?.dia ? { ...a, dia: { ...a.dia, ...patch } as AgendaDia } : a,
      )
    },
    onError: () => qc.invalidateQueries({ queryKey: chave(data) }),
  })
}

export function useCriarItem(data: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (novo: { hora: string; ordem: number; almoco: string }) => {
      const { data: linha, error } = await supabase
        .from('agenda_itens')
        .insert({ data, ...novo })
        .select('*')
        .single()
      if (error) throw error
      return linha
    },
    onSuccess: (linha) => {
      void qc.invalidateQueries({ queryKey: ['agenda-faixa'] })
      qc.setQueryData<Agenda>(chave(data), (a) =>
        a && !a.itens.some((i) => i.id === linha.id) ? { ...a, itens: [...a.itens, linha] } : a,
      )
    },
  })
}

export function useSalvarItem(data: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<'agenda_itens'> }) =>
      emFila(`linha:${id}`, async () => {
        const { error } = await supabase.from('agenda_itens').update(patch).eq('id', id)
        if (error) throw error
      }),
    // A tela muda na hora; o banco confirma depois.
    onMutate: async ({ id, patch }) => {
      // Uma recarga já a caminho traria a linha de antes desta mudança: cancela.
      await qc.cancelQueries({ queryKey: chave(data) })
      qc.setQueryData<Agenda>(chave(data), (a) =>
        a
          ? {
              ...a,
              itens: a.itens.map((i) => (i.id === id ? ({ ...i, ...patch } as AgendaItem) : i)),
            }
          : a,
      )
    },
    onError: () => qc.invalidateQueries({ queryKey: chave(data) }),
  })
}

/**
 * Salva um campo calculado a partir da linha como ela está agora (e não como estava
 * quando a tela foi desenhada). Para as listas por cliente (horários, observações):
 * preenchendo vários clientes seguidos, um não apaga o outro.
 */
export function useSalvarItemAtual(data: string) {
  const qc = useQueryClient()
  const salvar = useSalvarItem(data)
  const salvarAtual = (id: string, montar: (atual: AgendaItem) => TablesUpdate<'agenda_itens'>) => {
    const atual = qc.getQueryData<Agenda>(chave(data))?.itens.find((i) => i.id === id)
    if (atual) salvar.mutate({ id, patch: montar(atual) })
  }
  return { ...salvar, salvarAtual }
}

/** O mesmo para o dia (falta e folga). */
export function useSalvarDiaAtual(data: string) {
  const qc = useQueryClient()
  const salvar = useSalvarDia(data)
  const salvarAtual = (montar: (atual: AgendaDia) => TablesUpdate<'agenda_dias'>) => {
    const atual = qc.getQueryData<Agenda>(chave(data))?.dia
    if (atual) salvar.mutate(montar(atual))
  }
  return { ...salvar, salvarAtual }
}

export function useApagarItem(data: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agenda_itens').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) => {
      qc.setQueryData<Agenda>(chave(data), (a) =>
        a ? { ...a, itens: a.itens.filter((i) => i.id !== id) } : a,
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['agenda-faixa'] }),
    onError: () => qc.invalidateQueries({ queryKey: chave(data) }),
  })
}

/** Copia as linhas de outro dia (ex.: rotas que se repetem), com as marcas zeradas. */
export function useCopiarItens(data: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deData: string) => {
      const { data: origem, error: e1 } = await supabase
        .from('agenda_itens')
        .select(
          'ordem, hora, descricao, periodo, nota, nota_parte, avulso_partes, horario_cliente, chegada, chegada_parte, tecnicos, veiculo, almoco',
        )
        .eq('data', deData)
      if (e1) throw e1
      // Viagens já trazem a linha sozinhas para este dia: não duplica.
      const { data: jaTem, error: e2 } = await supabase
        .from('agenda_itens')
        .select('descricao')
        .eq('data', data)
      if (e2) throw e2
      const existentes = new Set(jaTem.map((j) => j.descricao.trim().toLowerCase()))
      const novas = origem.filter((o) => !existentes.has(o.descricao.trim().toLowerCase()))
      if (!novas.length) return 0
      const { error } = await supabase
        .from('agenda_itens')
        .insert(novas.map((o) => ({ ...o, data })))
      if (error) throw error
      return origem.length
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chave(data) })
      void qc.invalidateQueries({ queryKey: ['agenda-faixa'] })
    },
  })
}

export type Presente = { id: string; nome: string }
export type Conexao = 'conectando' | 'conectado' | 'caiu'

/**
 * Tempo real da agenda: qualquer mudança nas duas tabelas recarrega o dia aberto,
 * e a "presença" mostra quem mais está com a agenda aberta agora.
 */
export function useAgendaTempoReal(data: string, meuId: string, meuNome: string) {
  const qc = useQueryClient()
  const [presentes, setPresentes] = useState<Presente[]>([])
  const [conexao, setConexao] = useState<Conexao>('conectando')

  useEffect(() => {
    // Espera as gravações desta tela terminarem: recarregar no meio traria de volta
    // um estado antigo (e o próximo campo salvo partiria dele).
    const recarregar = async () => {
      while (filas.size) await Promise.allSettled([...filas.values()])
      return Promise.all([
        qc.invalidateQueries({ queryKey: chave(data) }),
        qc.invalidateQueries({ queryKey: ['agenda-faixa'] }),
      ])
    }
    const eu: Presente = { id: meuId, nome: meuNome }
    const canal = supabase.channel(`agenda-${data}`, { config: { presence: { key: meuId } } })
    canal
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_itens' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_dias' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_tecnicos' }, () =>
        qc.invalidateQueries({ queryKey: CHAVE_CADASTRO }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_veiculos' }, () =>
        qc.invalidateQueries({ queryKey: CHAVE_CADASTRO }),
      )
      .on('presence', { event: 'sync' }, () => {
        const estado = canal.presenceState<Presente>()
        const lista = Object.values(estado)
          .map((v) => v[0])
          .filter((p): p is Presente & { presence_ref: string } => !!p && p.id !== eu.id)
        setPresentes(lista.map(({ id, nome }) => ({ id, nome })))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConexao('conectado')
          void canal.track(eu)
          // Ao (re)conectar, busca o que mudou enquanto estava fora.
          void recarregar()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConexao('caiu')
        }
      })
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [data, meuId, meuNome, qc])

  return { presentes, conexao }
}

/**
 * Avisos do dia: propostas aprovadas com execução marcada neste dia que ainda não
 * foram conferidas na agenda (o vendedor marcou, falta lançar técnico, carro, horário).
 */
export function useLembretesAgenda(data: string) {
  return useQuery({
    queryKey: ['agenda', 'lembretes', data],
    queryFn: async () => {
      const { data: lista, error } = await supabase.rpc('lembretes_agenda', { dia: data })
      if (error) throw error
      return lista
    },
  })
}

export type LembreteAgenda = NonNullable<ReturnType<typeof useLembretesAgenda>['data']>[number]

/** Tira o aviso depois de conferir (volta se o vendedor mudar a data ou o horário). */
export function useConferirLembrete(data: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (proposta: string) => {
      const { error } = await supabase.rpc('conferir_lembrete_agenda', { proposta })
      if (error) throw error
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['agenda', 'lembretes', data] }),
  })
}

/** Os dias de um mês ("2026-11"), com escala, falta e folga: base do resumo de presença. */
export function useDiasDoMes(mes: string) {
  return useQuery({
    queryKey: ['agenda-mes', mes],
    queryFn: async () => {
      const [ano, m] = mes.split('-').map(Number)
      const ultimo = new Date(ano, m, 0).getDate()
      const { data, error } = await supabase
        .from('agenda_dias')
        .select('data, escalas, faltas, folgas')
        .gte('data', `${mes}-01`)
        .lte('data', `${mes}-${String(ultimo).padStart(2, '0')}`)
        .order('data')
      if (error) throw error
      return data
    },
    // Mês aberto na tela: confere de novo de tempos em tempos.
    refetchInterval: 60_000,
  })
}
