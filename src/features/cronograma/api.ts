import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import { unidadesDaRota, type ModeloDaRota } from './regras'

/*
 * Cronograma: as datas do mês de cada rota (cronograma_rotas) e de cada unidade dela
 * (cronograma_itens). O envio dos e-mails é da função "cronograma".
 */

const CAMPOS_ITEM_RESUMO =
  'id, incluido, datas, so_visita, horario, enviado_em, datas_enviadas, horario_enviado, aviso_manual_em, pede_confirmacao, resposta, conferir'

/** Os cronogramas montados no mês (com as unidades, para o resumo de cada rota). */
export function useCronogramasDoMes(mes: string) {
  return useQuery({
    queryKey: ['cronograma', 'mes', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cronograma_rotas')
        .select(
          `id, rota_id, mes, datas, horario,
           itens:cronograma_itens(${CAMPOS_ITEM_RESUMO}, cliente:clientes(email, contatos:contatos_cliente(email)))`,
        )
        .eq('mes', mes)
      if (error) throw error
      return data
    },
  })
}

export function useCronograma(id: string | null) {
  return useQuery({
    queryKey: ['cronograma', 'um', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cronograma_rotas')
        .select(
          `id, rota_id, mes, datas, horario, observacoes,
           rota:os_rotas(id, nome),
           itens:cronograma_itens(${CAMPOS_ITEM_RESUMO}, cliente_id, endereco_id, servicos, ordem,
             observacoes, enviado_para, sem_email_em, aviso_manual_obs, resposta_obs, resposta_em,
             cliente:clientes(id, nome, nome_fantasia, cpf_cnpj, email,
               contatos:contatos_cliente(email, principal)),
             endereco:enderecos(id, apelido, logradouro, numero, bairro, cidade, uf))`,
        )
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { ...data, itens: [...data.itens].sort((a, b) => a.ordem - b.ordem) }
    },
  })
}

export type Cronograma = NonNullable<ReturnType<typeof useCronograma>['data']>
export type ItemCronograma = Cronograma['itens'][number]

/** O e-mail para onde o aviso vai: o principal do cadastro; sem ele, o de um contato. */
export function emailDoAviso(
  cliente: {
    email: string | null
    contatos: { email: string | null; principal?: boolean }[]
  } | null,
): string | null {
  if (!cliente) return null
  if (cliente.email?.trim()) return cliente.email.trim()
  const contatos = [...cliente.contatos].sort(
    (a, b) => Number(b.principal ?? false) - Number(a.principal ?? false),
  )
  return contatos.find((c) => c.email?.trim())?.email?.trim() ?? null
}

/** As O.S salvas da rota, para virar as unidades do cronograma. */
async function unidadesAtuaisDaRota(rotaId: string) {
  const { data, error } = await supabase
    .from('os_rota_modelos')
    .select(
      'ordem, modelo:os_modelos(ativo, descricao, cliente:clientes(id), endereco:enderecos(id), tipo:tipos_servico(nome))',
    )
    .eq('rota_id', rotaId)
  if (error) throw error
  return unidadesDaRota(data as unknown as ModeloDaRota[])
}

/**
 * Monta a rota no mês: as unidades vêm das O.S salvas da rota. Do mês anterior
 * (se houver) vêm o turno/horário e o "só a Nª visita" de cada unidade.
 */
export function useMontarCronograma() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      rotaId: string
      mes: string
      datas: string[]
      mesAnterior: string
    }) => {
      const unidades = await unidadesAtuaisDaRota(v.rotaId)
      const { data: anterior } = await supabase
        .from('cronograma_rotas')
        .select('horario, itens:cronograma_itens(cliente_id, endereco_id, so_visita, horario)')
        .eq('rota_id', v.rotaId)
        .eq('mes', v.mesAnterior)
        .maybeSingle()

      const { data: crono, error } = await supabase
        .from('cronograma_rotas')
        .insert({
          rota_id: v.rotaId,
          mes: v.mes,
          datas: v.datas,
          horario: anterior?.horario ?? null,
        })
        .select('id')
        .single()
      if (error) {
        throw /uma_vez_por_mes/.test(error.message)
          ? new Error('Esta rota já foi montada neste mês. Atualize a página.')
          : error
      }
      if (unidades.length) {
        const doAnterior = new Map(
          (anterior?.itens ?? []).map((i) => [`${i.cliente_id}|${i.endereco_id ?? ''}`, i]),
        )
        const { error: e2 } = await supabase.from('cronograma_itens').insert(
          unidades.map((u) => {
            const a = doAnterior.get(`${u.cliente_id}|${u.endereco_id ?? ''}`)
            return {
              cronograma_id: crono.id,
              ...u,
              so_visita: a?.so_visita ?? null,
              horario: a?.horario ?? null,
            }
          }),
        )
        if (e2) {
          await supabase.from('cronograma_rotas').delete().eq('id', crono.id)
          throw e2
        }
      }
      return crono.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cronograma'] }),
  })
}

/** Traz as unidades que entraram na rota depois de montar o mês. */
export function useTrazerNovosDaRota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (c: Cronograma) => {
      if (!c.rota_id) return 0
      const unidades = await unidadesAtuaisDaRota(c.rota_id)
      const ja = new Set(c.itens.map((i) => `${i.cliente_id}|${i.endereco_id ?? ''}`))
      const ultimaOrdem = c.itens.reduce((m, i) => Math.max(m, i.ordem), -1)
      const novas = unidades.filter((u) => !ja.has(`${u.cliente_id}|${u.endereco_id ?? ''}`))
      if (novas.length) {
        const { error } = await supabase
          .from('cronograma_itens')
          .insert(novas.map((u, n) => ({ cronograma_id: c.id, ...u, ordem: ultimaOrdem + 1 + n })))
        if (error) throw error
      }
      return novas.length
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cronograma'] }),
  })
}

export function useSalvarCronograma() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }: { id: string } & TablesUpdate<'cronograma_rotas'>) => {
      const { error } = await supabase.from('cronograma_rotas').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cronograma'] }),
  })
}

/** Apaga o mês da rota (só enquanto nenhum aviso foi enviado; a tela confere). */
export function useApagarCronograma() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cronograma_rotas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cronograma'] }),
  })
}

/**
 * Põe um cliente no "Fora de rota" do mês (serviço de contrato avulso: coifa,
 * reservatório…), criando o "Fora de rota" do mês se ainda não existir.
 */
export function useAdicionarForaDeRota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      cronogramaId: string | null
      mes: string
      clienteId: string
      enderecoId: string | null
      servico: string
      datas: string[]
      horario: string | null
      observacoes: string | null
      pedeConfirmacao: boolean
    }) => {
      let id = v.cronogramaId
      if (!id) {
        const { data, error } = await supabase
          .from('cronograma_rotas')
          .insert({ rota_id: null, mes: v.mes })
          .select('id')
          .single()
        if (error) {
          if (!/uma_vez_por_mes/.test(error.message)) throw error
          const { data: ja, error: e2 } = await supabase
            .from('cronograma_rotas')
            .select('id')
            .is('rota_id', null)
            .eq('mes', v.mes)
            .single()
          if (e2) throw e2
          id = ja.id
        } else id = data.id
      }
      const { count } = await supabase
        .from('cronograma_itens')
        .select('id', { count: 'exact', head: true })
        .eq('cronograma_id', id)
      const { error } = await supabase.from('cronograma_itens').insert({
        cronograma_id: id,
        cliente_id: v.clienteId,
        endereco_id: v.enderecoId,
        servicos: [v.servico],
        ordem: count ?? 0,
        datas: v.datas,
        horario: v.horario,
        observacoes: v.observacoes,
        pede_confirmacao: v.pedeConfirmacao,
      })
      if (error) {
        throw /unidade_uma_vez/.test(error.message)
          ? new Error('Este cliente (neste endereço) já está no mês. Edite a linha dele.')
          : error
      }
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cronograma'] }),
  })
}

export function useTirarItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cronograma_itens').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cronograma'] }),
  })
}

export type CamposItem = Pick<
  TablesUpdate<'cronograma_itens'>,
  | 'datas'
  | 'so_visita'
  | 'incluido'
  | 'horario'
  | 'observacoes'
  | 'servicos'
  | 'pede_confirmacao'
  | 'resposta'
  | 'resposta_obs'
  | 'resposta_em'
  | 'aviso_manual_em'
  | 'aviso_manual_por'
  | 'aviso_manual_obs'
  | 'conferir'
>

export function useSalvarItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }: { id: string } & CamposItem) => {
      const { error } = await supabase.from('cronograma_itens').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cronograma'] }),
  })
}

export type ResultadoEnvio = {
  de: string
  enviados: { cliente: string; para: string[] }[]
  semEmail: string[]
  falhas: { cliente: string; erro: string }[]
}

export function useEnviarCronograma() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: { cronogramaId: string; itemIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke('cronograma', {
        body: { acao: 'enviar', ...v },
      })
      if (error) {
        const corpo =
          error instanceof FunctionsHttpError
            ? ((await error.context.json().catch(() => null)) as { erro?: string } | null)
            : null
        throw new Error(corpo?.erro ?? 'Não foi possível falar com o servidor de e-mail.')
      }
      return data as ResultadoEnvio
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma'] })
      queryClient.invalidateQueries({ queryKey: ['emails-enviados'] })
    },
  })
}
