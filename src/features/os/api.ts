import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import type { Database, Enums, Json, Tables, TablesUpdate } from '@/lib/database.types'
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
  tipo:tipos_servico(id, nome, formulario_os, fotos_antes_depois),
  veiculo:veiculos(id, placa, descricao, sigla),
  operadores:os_operadores(operador:perfis(id, nome))
`

export type FiltroOs = {
  de?: string
  ate?: string
  status?: StatusOs
  clienteId?: string
  /** true: só os testes de treinamento; false: só as OS de verdade; sem valor: todas. */
  treinamento?: boolean
}

export function useOrdensServico(filtro: FiltroOs) {
  return useQuery({
    queryKey: ['os', 'lista', filtro],
    queryFn: async () => {
      let consulta = supabase
        .from('ordens_servico')
        .select(
          `id, numero, status, data_agendada, hora_agendada, concluida_em, ficha_cliente, cliente_id, treinamento, ${RELACOES}`,
        )
        .order('data_agendada', { ascending: true })
        .order('hora_agendada', { ascending: true, nullsFirst: false })
        .limit(200)
      if (filtro.de) consulta = consulta.gte('data_agendada', filtro.de)
      if (filtro.ate) consulta = consulta.lte('data_agendada', filtro.ate)
      if (filtro.status) consulta = consulta.eq('status', filtro.status)
      if (filtro.clienteId) consulta = consulta.eq('cliente_id', filtro.clienteId)
      if (filtro.treinamento !== undefined)
        consulta = consulta.eq('treinamento', filtro.treinamento)
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
      let consulta = supabase
        .from('veiculos')
        .select('*')
        .order('sigla', { nullsFirst: false })
        .order('descricao')
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

export type CategoriaOs = Enums<'categoria_os'>

export const NOME_CATEGORIA_OS: Record<CategoriaOs, string> = {
  contrato: 'Contrato',
  avulsa: 'Avulsa',
}

export function useModelo(
  clienteId: string,
  enderecoId: string | null,
  tipoId: string,
  categoria: CategoriaOs | '',
) {
  return useQuery({
    queryKey: ['os', 'modelo', clienteId, enderecoId, tipoId, categoria],
    enabled: !!clienteId && !!tipoId && !!categoria,
    queryFn: async () => {
      let consulta = supabase
        .from('os_modelos')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('tipo_servico_id', tipoId)
        .eq('categoria', categoria as CategoriaOs)
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
  categoria: CategoriaOs
  clienteId: string
  enderecoId: string | null
  tipoId: string
  data: string
  hora: string | null
  operadores: string[]
  veiculoId: string | null
  descricao: string
  observacoesAdm: string
  /** Ocorrência que o técnico precisa confirmar que resolveu (vazio: nenhuma). */
  ocorrencia?: string
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
        .eq('categoria', d.categoria)
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
            categoria: d.categoria,
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
      if (d.ocorrencia) {
        const r = await supabase
          .from('ordens_servico')
          .update({ ocorrencia: d.ocorrencia })
          .eq('id', osId)
        if (r.error) throw r.error
      }
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

/**
 * O que o operador pode gravar na execução: a mesma lista do "grant update" do
 * banco (migrations 20261103120200_ordens_servico.sql, 20261217120000_os_sem_acompanhamento.sql e 20261220130000_os_ocorrencia.sql). Um campo fora dela faz o
 * banco recusar a gravação inteira ("permission denied for table os_execucao").
 */
export const CAMPOS_EDITAVEIS_EXECUCAO = [
  'data',
  'km_chegada',
  'veiculo_id',
  'hora_chegada',
  'hora_inicio',
  'hora_termino',
  'hora_saida',
  'resultado',
  'observacoes',
  'operador_nome',
  'responsavel_nome',
  'responsavel_setor',
  'sem_acompanhamento',
  'ocorrencia_resolvida',
  'assinatura_cliente_id',
  'assinatura_operador_id',
  'checklist',
] as const satisfies readonly (keyof CamposExecucao)[]

/** Deixa só os campos que o operador pode gravar (o rascunho pode ter outros). */
export function somenteEditaveis(campos: CamposExecucao): CamposExecucao {
  const limpo: Record<string, unknown> = {}
  for (const nome of CAMPOS_EDITAVEIS_EXECUCAO) {
    if (nome in campos) limpo[nome] = campos[nome]
  }
  return limpo as CamposExecucao
}

export async function gravarExecucao(osId: string, campos: CamposExecucao) {
  const dados = somenteEditaveis(campos)
  if (Object.keys(dados).length === 0) return
  const { error } = await supabase.from('os_execucao').update(dados).eq('os_id', osId)
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

/** Fotos da OS: gerais, ou de antes e depois (serviços de limpeza). */
export type CategoriaFotoOs = 'foto_os' | 'foto_antes' | 'foto_depois'

/** Foto ou assinatura da OS: fica no celular e sobe pela fila. Devolve o id. */
export async function guardarArquivoDaOs(
  clienteId: string,
  osId: string,
  arquivo: Blob,
  info: { nome: string; tipo: string; categoria: 'assinatura' | CategoriaFotoOs },
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

// -----------------------------------------------------------------------------
// Escritório: O.S de contrato (o modelo montado antes da primeira visita)
// -----------------------------------------------------------------------------

const RELACOES_MODELO = `
  cliente:clientes(id, nome, nome_fantasia, cpf_cnpj),
  endereco:enderecos(id, apelido, logradouro, numero, cidade, uf),
  tipo:tipos_servico(id, nome, formulario_os, fotos_antes_depois)
`

/** Quantas O.S salvas a lista carrega de cada vez enquanto a pessoa rola a tela. */
export const MODELOS_POR_PAGINA = 20

/**
 * Uma página de O.S salvas: o banco filtra pela busca, ordena pelo nome e já conta
 * os pontos (baixar todos os pontos de todos os modelos deixava a lista lenta).
 */
async function paginaDeModelos(
  categoria: CategoriaOs,
  termo: string,
  pular: number,
  limite: number,
) {
  const ids = await supabase.rpc('buscar_modelos_os', {
    p_categoria: categoria,
    p_busca: termo,
    p_limite: limite,
    p_pular: pular,
  })
  if (ids.error) throw ids.error
  if (ids.data.length === 0) return []
  const { data, error } = await supabase
    .from('os_modelos')
    .select(`id, ativo, descricao, categoria, ${RELACOES_MODELO}`)
    .in(
      'id',
      ids.data.map((c) => c.modelo_id),
    )
  if (error) throw error
  const porId = new Map(data.map((m) => [m.id, m]))
  return ids.data.flatMap((c) => {
    const m = porId.get(c.modelo_id)
    if (!m) return []
    const contagem = {
      porta_iscas: c.porta_iscas,
      armadilhas: c.armadilhas,
      coifas: c.coifas,
      bebedouros: c.bebedouros,
    }
    return [{ ...m, contagem }]
  })
}

export type ModeloResumo = Awaited<ReturnType<typeof paginaDeModelos>>[number]

/** O.S salvas de uma categoria, aos pedaços de 20 (rolagem infinita), com busca no banco. */
export function useListaModelos(categoria: CategoriaOs, termo: string) {
  return useInfiniteQuery({
    queryKey: ['os', 'modelos', categoria, termo],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => paginaDeModelos(categoria, termo, pageParam, MODELOS_POR_PAGINA),
    getNextPageParam: (ultima, paginas) =>
      ultima.length < MODELOS_POR_PAGINA ? undefined : paginas.length * MODELOS_POR_PAGINA,
  })
}

/** Busca rápida (uma página só), para escolher uma O.S — ex.: adicionar na rota. */
export function useBuscaModelos(categoria: CategoriaOs, termo: string) {
  return useQuery({
    queryKey: ['os', 'modelos', 'busca', categoria, termo],
    enabled: termo.length > 0,
    queryFn: () => paginaDeModelos(categoria, termo, 0, 15),
  })
}

export function useModeloPorId(id: string) {
  return useQuery({
    queryKey: ['os', 'modelo', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_modelos')
        .select(`*, ${RELACOES_MODELO}`)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type ModeloCompleto = NonNullable<ReturnType<typeof useModeloPorId>['data']>

/** Cria o modelo do local (sem agendar visita) e devolve o id. */
export function useCriarModelo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (m: {
      categoria: CategoriaOs
      clienteId: string
      enderecoId: string | null
      tipoId: string
      descricao: string
    }) => {
      const { data, error } = await supabase
        .from('os_modelos')
        .insert({
          categoria: m.categoria,
          cliente_id: m.clienteId,
          endereco_id: m.enderecoId,
          tipo_servico_id: m.tipoId,
          descricao: m.descricao || null,
        })
        .select('id')
        .single()
      if (error) {
        throw /um_modelo_por_local/.test(error.message)
          ? new Error(
              `Este local já tem uma O.S ${m.categoria === 'contrato' ? 'de contrato' : 'avulsa'} para este serviço.`,
            )
          : error
      }
      return data.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

export function useSalvarModelo(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: TablesUpdate<'os_modelos'>) => {
      const { error } = await supabase.from('os_modelos').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

// -----------------------------------------------------------------------------
// Treinamento: cópias de uma OS para os técnicos aprenderem (nada vai para o cliente)
// -----------------------------------------------------------------------------

/** Uma cópia da OS escolhida para cada técnico, para hoje. Devolve quantas criou. */
export function useCriarTreinamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ origem, operadores }: { origem: string; operadores: string[] }) => {
      const { data, error } = await supabase.rpc('criar_treinamento_os', { origem, operadores })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

/** Apaga um teste (ou todos, sem id), com as fotos e assinaturas. */
export function useApagarTreinamentos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (os?: string) => {
      const { data, error } = await supabase.rpc('apagar_treinamentos_os', os ? { os } : {})
      if (error) throw error
      // O registro já saiu; se o Storage falhar, sobra só um arquivo órfão (sem acesso pela tela).
      if (data?.length) await supabase.storage.from('arquivos').remove(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

// -----------------------------------------------------------------------------
// Rotas: modelos de contrato agrupados (ex.: "Gravataí A") para agendar juntos
// -----------------------------------------------------------------------------

export function useRotas() {
  return useQuery({
    queryKey: ['os', 'rotas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_rotas')
        .select('id, nome, observacoes, ativo, itens:os_rota_modelos(id)')
        .eq('ativo', true)
      if (error) throw error
      // Ordem "natural": SUSEPE 2 antes de SUSEPE 10.
      return [...data].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' }),
      )
    },
  })
}

export function useRota(id: string) {
  return useQuery({
    queryKey: ['os', 'rota', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_rotas')
        .select(
          `id, nome, observacoes, ativo,
           itens:os_rota_modelos(id, ordem, modelo:os_modelos(id, ativo, descricao, categoria,
             operadores_padrao, veiculo_padrao_id, observacoes_adm_padrao, ${RELACOES_MODELO},
             pontos:pontos_controle(tipo, ativo)))`,
        )
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { ...data, itens: [...data.itens].sort((a, b) => a.ordem - b.ordem) }
    },
  })
}

export type RotaCompleta = NonNullable<ReturnType<typeof useRota>['data']>

export function useCriarRota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from('os_rotas').insert({ nome }).select('id').single()
      if (error) {
        throw /duplicate key/.test(error.message)
          ? new Error('Já existe uma rota com esse nome.')
          : error
      }
      return data.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os', 'rotas'] }),
  })
}

export function useSalvarRota(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: TablesUpdate<'os_rotas'>) => {
      const { error } = await supabase.from('os_rotas').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

export function usePorNaRota(rotaId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ modeloId, ordem }: { modeloId: string; ordem: number }) => {
      const { error } = await supabase
        .from('os_rota_modelos')
        .insert({ rota_id: rotaId, modelo_id: modeloId, ordem })
      if (error) {
        throw /modelo_uma_vez_na_rota/.test(error.message)
          ? new Error('Esta O.S já está na rota.')
          : error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

export function useTirarDaRota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('os_rota_modelos').delete().eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

/** Troca a ordem de dois itens da rota. */
export function useTrocarOrdemRota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (par: [{ id: string; ordem: number }, { id: string; ordem: number }]) => {
      const [a, b] = par
      const r1 = await supabase.from('os_rota_modelos').update({ ordem: b.ordem }).eq('id', a.id)
      if (r1.error) throw r1.error
      const r2 = await supabase.from('os_rota_modelos').update({ ordem: a.ordem }).eq('id', b.id)
      if (r2.error) throw r2.error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}

export type ItemAgendaRota = {
  modeloId: string
  observacoesAdm: string
}

/**
 * Agenda a rota: gera uma OS de cada modelo escolhido, no mesmo dia, com os
 * operadores e o veículo da rota (ou os de costume de cada modelo).
 * Continua mesmo se uma falhar e devolve quantas saíram e os erros.
 */
export function useAgendarRota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (d: {
      data: string
      operadores: string[]
      veiculoId: string | null
      itens: ItemAgendaRota[]
    }) => {
      const criadas: string[] = []
      const erros: string[] = []
      for (const item of d.itens) {
        const { data: osId, error } = await supabase.rpc('gerar_os_do_modelo', {
          modelo: item.modeloId,
          data: d.data,
          operadores: d.operadores.length ? d.operadores : undefined,
          veiculo: d.veiculoId ?? undefined,
          observacoes_adm: item.observacoesAdm || undefined,
        })
        if (error) erros.push(`${item.modeloId}: ${error.message}`)
        else criadas.push(osId)
      }
      return { criadas, erros }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })
}
