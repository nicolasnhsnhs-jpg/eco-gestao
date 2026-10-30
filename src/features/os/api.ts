import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database, Json, Tables, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import { enfileirar } from './offline/fila'

/*
 * Ordens de serviço.
 * Quem vê: o escritório (Admin, Financeiro, Recepção) vê todas; o vendedor, as dos
 * clientes dele; o operador, só as atribuídas a ele. Quem garante é o banco (RLS):
 * o operador só consegue gravar a execução, e só enquanto a OS está aberta.
 */

export type StatusOs = Database['public']['Enums']['status_os']
export type Execucao = Tables<'os_execucao'>
export type Veiculo = Tables<'veiculos'>

export const NOME_STATUS_OS: Record<StatusOs, string> = {
  rascunho: 'Rascunho',
  agendada: 'Agendada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  conferida: 'Conferida',
  cancelada: 'Cancelada',
}

export const COR_STATUS_OS = {
  rascunho: 'cinza',
  agendada: 'alerta',
  em_execucao: 'verde',
  concluida: 'verde',
  conferida: 'verde',
  cancelada: 'cinza',
} as const satisfies Record<StatusOs, string>

/** Execução ainda pode ser preenchida (mesma regra do banco). */
export const osAberta = (status: StatusOs) => status === 'agendada' || status === 'em_execucao'

/** Cópia dos dados do cliente gravada na OS (ver privado.ficha_cliente no banco). */
export type FichaCliente = {
  nome?: string
  nome_fantasia?: string | null
  razao_social?: string | null
  cpf_cnpj?: string | null
  telefone?: string | null
  whatsapp?: string | null
  email?: string | null
  unidade?: {
    apelido: string | null
    cep: string | null
    logradouro: string
    numero: string | null
    complemento: string | null
    bairro: string | null
    cidade: string
    uf: string
  } | null
  contatos?: { nome: string; cargo: string | null; telefone: string | null; email: string | null }[]
}

export const fichaDaOs = (ficha: Json) => (ficha ?? {}) as FichaCliente

export function enderecoDaFicha(ficha: FichaCliente) {
  const u = ficha.unidade
  if (!u) return ''
  return [
    [u.logradouro, u.numero].filter(Boolean).join(', '),
    u.complemento,
    u.bairro,
    `${u.cidade}/${u.uf}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

const RELACOES = `
  tipo:tipos_servico(id, nome, formulario_os),
  veiculo:veiculos(id, placa, descricao),
  operadores:os_operadores(operador:perfis(id, nome))
`

export type FiltroOs = { de?: string; ate?: string; status?: StatusOs; clienteId?: string }

export function useOrdensServico(filtro: FiltroOs) {
  return useQuery({
    queryKey: ['os', 'lista', filtro],
    queryFn: async () => {
      let consulta = supabase
        .from('ordens_servico')
        .select(
          `id, numero, status, data_agendada, hora_agendada, ficha_cliente, cliente_id, ${RELACOES}`,
        )
        .order('data_agendada', { ascending: true })
        .order('hora_agendada', { ascending: true, nullsFirst: false })
        .limit(200)
      if (filtro.de) consulta = consulta.gte('data_agendada', filtro.de)
      if (filtro.ate) consulta = consulta.lte('data_agendada', filtro.ate)
      if (filtro.status) consulta = consulta.eq('status', filtro.status)
      if (filtro.clienteId) consulta = consulta.eq('cliente_id', filtro.clienteId)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export type OsResumo = NonNullable<ReturnType<typeof useOrdensServico>['data']>[number]

/** Consulta de uma OS completa (usada na tela e para guardar no celular). */
export const consultaOs = (id: string) =>
  queryOptions({
    queryKey: ['os', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`*, ${RELACOES}, execucao:os_execucao(*)`)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

export function useOrdemServico(id: string | undefined) {
  return useQuery({ ...consultaOs(id ?? ''), enabled: !!id })
}

export type OsCompleta = NonNullable<ReturnType<typeof useOrdemServico>['data']>

export function usePendencias(id: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['os', id, 'pendencias'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pendencias_os', { os: id })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Operadores ativos (para designar na OS). */
export function useOperadores() {
  return useQuery({
    queryKey: ['equipe', 'operadores'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome')
        .eq('papel', 'operador')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

export const consultaVeiculos = (incluirInativos = false) =>
  queryOptions({
    queryKey: ['veiculos', incluirInativos],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let consulta = supabase.from('veiculos').select('*').order('descricao')
      if (!incluirInativos) consulta = consulta.eq('ativo', true)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })

export function useVeiculos(incluirInativos = false) {
  return useQuery(consultaVeiculos(incluirInativos))
}

export function useSalvarVeiculo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id?: string; placa: string; descricao: string; ativo: boolean }) => {
      const { error } = v.id
        ? await supabase.from('veiculos').update(v).eq('id', v.id)
        : await supabase.from('veiculos').insert(v)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['veiculos'] }),
  })
}

// -----------------------------------------------------------------------------
// Escritório: modelo + agendamento
// -----------------------------------------------------------------------------

export function useModelo(clienteId: string, enderecoId: string | null, tipoId: string) {
  return useQuery({
    queryKey: ['os', 'modelo', clienteId, enderecoId, tipoId],
    enabled: !!clienteId && !!tipoId,
    queryFn: async () => {
      let consulta = supabase
        .from('os_modelos')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('tipo_servico_id', tipoId)
      consulta = enderecoId
        ? consulta.eq('endereco_id', enderecoId)
        : consulta.is('endereco_id', null)
      const { data, error } = await consulta.maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type DadosAgendamento = {
  clienteId: string
  enderecoId: string | null
  tipoId: string
  data: string
  hora: string | null
  operadores: string[]
  veiculoId: string | null
  descricao: string
  observacoesAdm: string
  /** Gravar operadores, veículo e observações como padrão das próximas visitas. */
  salvarComoPadrao: boolean
}

/** Cria (ou atualiza) o modelo do cliente/unidade/tipo e gera a OS a partir dele. */
export function useAgendarOs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (d: DadosAgendamento) => {
      const { data: existente, error: erroBusca } = await (
        d.enderecoId
          ? supabase.from('os_modelos').select('id').eq('endereco_id', d.enderecoId)
          : supabase.from('os_modelos').select('id').is('endereco_id', null)
      )
        .eq('cliente_id', d.clienteId)
        .eq('tipo_servico_id', d.tipoId)
        .maybeSingle()
      if (erroBusca) throw erroBusca

      const padroes = d.salvarComoPadrao
        ? {
            operadores_padrao: d.operadores,
            veiculo_padrao_id: d.veiculoId,
            observacoes_adm_padrao: d.observacoesAdm || null,
          }
        : {}
      const modelo = { descricao: d.descricao || null, ...padroes }

      let modeloId = existente?.id
      if (modeloId) {
        const { error } = await supabase.from('os_modelos').update(modelo).eq('id', modeloId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('os_modelos')
          .insert({
            cliente_id: d.clienteId,
            endereco_id: d.enderecoId,
            tipo_servico_id: d.tipoId,
            ...modelo,
          })
          .select('id')
          .single()
        if (error) throw error
        modeloId = data.id
      }

      const { data: osId, error } = await supabase.rpc('gerar_os_do_modelo', {
        modelo: modeloId,
        data: d.data,
        hora: d.hora ?? undefined,
        operadores: d.operadores,
        veiculo: d.veiculoId ?? undefined,
        observacoes_adm: d.observacoesAdm || undefined,
      })
      if (error) throw error
      return osId
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

export function useAtualizarOs(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      dados,
      operadores,
    }: {
      dados: TablesUpdate<'ordens_servico'>
      operadores?: string[]
    }) => {
      const { error } = await supabase.from('ordens_servico').update(dados).eq('id', id)
      if (error) throw error
      if (operadores) {
        const { data: atuais, error: erroAtuais } = await supabase
          .from('os_operadores')
          .select('operador_id')
          .eq('os_id', id)
        if (erroAtuais) throw erroAtuais
        const ids = atuais.map((a) => a.operador_id)
        const sair = ids.filter((o) => !operadores.includes(o))
        const entrar = operadores.filter((o) => !ids.includes(o))
        if (sair.length) {
          const r = await supabase
            .from('os_operadores')
            .delete()
            .eq('os_id', id)
            .in('operador_id', sair)
          if (r.error) throw r.error
        }
        if (entrar.length) {
          const r = await supabase
            .from('os_operadores')
            .insert(entrar.map((operador_id) => ({ os_id: id, operador_id })))
          if (r.error) throw r.error
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

export function useReabrirOs(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.rpc('reabrir_os', { os: id, motivo })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

// -----------------------------------------------------------------------------
// Operador: execução
// -----------------------------------------------------------------------------

export type CamposExecucao = Omit<
  TablesUpdate<'os_execucao'>,
  'os_id' | 'criado_em' | 'criado_por' | 'atualizado_em' | 'atualizado_por'
>

export async function gravarExecucao(osId: string, campos: CamposExecucao) {
  const { error } = await supabase.from('os_execucao').update(campos).eq('os_id', osId)
  if (error) throw error
}

/** Muda o status da OS na tela (e no celular) antes de o banco confirmar. */
function useMudarStatusLocal() {
  const queryClient = useQueryClient()
  return (id: string, status: StatusOs) => {
    queryClient.setQueryData<OsCompleta | null>(['os', id], (os) => (os ? { ...os, status } : os))
    queryClient.setQueriesData<OsResumo[]>({ queryKey: ['os', 'lista'] }, (lista) =>
      lista?.map((os) => (os.id === id ? { ...os, status } : os)),
    )
  }
}

/** Iniciar a execução. Funciona sem internet (vai pela fila). */
export function useIniciarOs(id: string) {
  const mudarStatus = useMudarStatusLocal()
  return useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      mudarStatus(id, 'em_execucao')
      await enfileirar({ tipo: 'iniciar', osId: id })
    },
  })
}

/**
 * Concluir. Funciona sem internet: a OS trava no celular na hora e a conclusão
 * vai pela fila, sempre depois de tudo o que foi anotado nela. A tela confere as
 * pendências antes (pendenciasLocais); o banco confere de novo ao receber.
 */
export function useConcluirOs(id: string) {
  const mudarStatus = useMudarStatusLocal()
  return useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      mudarStatus(id, 'concluida')
      await enfileirar({ tipo: 'concluir', osId: id })
    },
  })
}

/**
 * Guarda uma assinatura (PNG) no celular e põe o envio na fila. Devolve o id do
 * arquivo na hora (com ou sem internet), que é gravado na execução.
 */
export async function enviarAssinatura(
  clienteId: string,
  osId: string,
  imagem: Blob,
  quem: 'cliente' | 'operador',
) {
  return guardarArquivoDaOs(clienteId, osId, imagem, {
    nome: `assinatura-${quem}.png`,
    tipo: 'image/png',
    categoria: 'assinatura',
  })
}

/** Foto ou assinatura da OS: fica no celular e sobe pela fila. Devolve o id. */
export async function guardarArquivoDaOs(
  clienteId: string,
  osId: string,
  arquivo: Blob,
  info: { nome: string; tipo: string; categoria: 'assinatura' | 'foto_os' },
) {
  const id = crypto.randomUUID()
  const nomeLimpo = info.nome.replace(/[^\w.-]+/g, '-').slice(-80)
  await enfileirar(
    {
      tipo: 'arquivo',
      osId,
      registro: {
        id,
        caminho_storage: `clientes/${clienteId}/os/${osId}/${id}-${nomeLimpo}`,
        nome_original: info.nome,
        tipo_mime: info.tipo,
        tamanho_bytes: arquivo.size,
        categoria: info.categoria,
        cliente_id: clienteId,
        os_id: osId,
      },
    },
    arquivo,
  )
  return id
}

// -----------------------------------------------------------------------------
// Escritório: conferência interna e faturamento (o operador não enxerga)
// -----------------------------------------------------------------------------

export type Conferencia = Tables<'os_conferencia'>

export function useConferencia(osId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['os', osId, 'conferencia'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_conferencia')
        .select('*')
        .eq('os_id', osId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSalvarConferencia(osId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      dados: Omit<
        TablesUpdate<'os_conferencia'>,
        'os_id' | 'lancamento_id' | 'criado_em' | 'criado_por' | 'atualizado_em' | 'atualizado_por'
      >,
    ) => {
      const { error } = await supabase.from('os_conferencia').update(dados).eq('os_id', osId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os', osId] }),
  })
}

export function useConferirOs(osId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('conferir_os', { os: osId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

/** Cria a conta a receber no financeiro e liga à OS (só Admin e Financeiro). */
export function useFaturarOs(osId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (d: { valor: number; vencimento: string; numeroNf: string }) => {
      const { data, error } = await supabase.rpc('faturar_os', {
        os: osId,
        valor: d.valor,
        vencimento: d.vencimento,
        numero_nf: d.numeroNf || undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['os'] })
      void queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
    },
  })
}
