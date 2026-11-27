import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import {
  lerConteudo,
  type ConteudoComunicacao,
  type TecnicoComunicacao,
} from './comunicacaoModelos'

/*
 * Comunicação de serviço (migration 20270206120000_comunicacoes_servico.sql).
 * O escritório emite e baixa o PDF; não tem assinatura nem envio automático.
 */

export function useComunicacoes() {
  return useQuery({
    queryKey: ['comunicacoes', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comunicacoes_servico')
        .select('*')
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(300)
      if (error) throw error
      return data
    },
  })
}

export function useComunicacao(id: string | undefined) {
  return useQuery({
    queryKey: ['comunicacoes', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comunicacoes_servico')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type Comunicacao = NonNullable<ReturnType<typeof useComunicacao>['data']>

export type DadosComunicacao = {
  modelo: string
  titulo: string
  clienteId: string
  enderecoId: string | null
  clienteNome: string
  data: string
  conteudo: ConteudoComunicacao
}

export function useSalvarComunicacao(id: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (d: DadosComunicacao) => {
      const campos = {
        modelo: d.modelo,
        titulo: d.titulo.trim(),
        endereco_id: d.enderecoId,
        cliente_nome: d.clienteNome.trim(),
        data: d.data,
        conteudo: d.conteudo as unknown as Json,
      }
      if (id) {
        const { error } = await supabase.from('comunicacoes_servico').update(campos).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from('comunicacoes_servico')
        .insert({ ...campos, cliente_id: d.clienteId })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comunicacoes'] }),
  })
}

export function useApagarComunicacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('comunicacoes_servico').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comunicacoes'] }),
  })
}

const chaveNome = (nome: string) =>
  nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Técnicos para escolher: os da agenda e os que já foram em outras comunicações,
 * com o RG e o CPF da última vez (não precisa digitar de novo).
 */
export function useTecnicosConhecidos() {
  return useQuery({
    queryKey: ['comunicacoes', 'tecnicos'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [agenda, anteriores] = await Promise.all([
        supabase.from('agenda_tecnicos').select('nome').eq('ativo', true).order('nome'),
        supabase
          .from('comunicacoes_servico')
          .select('conteudo')
          .order('criado_em', { ascending: false })
          .limit(200),
      ])
      if (agenda.error) throw agenda.error
      if (anteriores.error) throw anteriores.error
      const porNome = new Map<string, TecnicoComunicacao>()
      for (const c of anteriores.data)
        for (const t of lerConteudo(c.conteudo).tecnicos) {
          const k = chaveNome(t.nome)
          if (k && !porNome.has(k)) porNome.set(k, t)
        }
      for (const t of agenda.data) {
        const k = chaveNome(t.nome)
        if (k && !porNome.has(k)) porNome.set(k, { nome: t.nome.trim(), rg: '', cpf: '' })
      }
      return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome))
    },
  })
}

/** O técnico conhecido com esse nome (sem diferenciar acento e maiúsculas). */
export function tecnicoPeloNome(
  lista: readonly TecnicoComunicacao[] | undefined,
  nome: string,
): TecnicoComunicacao | undefined {
  const k = chaveNome(nome)
  return k ? lista?.find((t) => chaveNome(t.nome) === k) : undefined
}

/** Veículos da frota para sugerir ("ONIX · Placa JCI9E13"). */
export function useVeiculosComunicacao() {
  return useQuery({
    queryKey: ['comunicacoes', 'veiculos'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('descricao, placa')
        .eq('ativo', true)
        .order('descricao')
      if (error) throw error
      return data.map((v) =>
        [v.descricao.trim(), v.placa && `Placa ${v.placa}`].filter(Boolean).join(' · '),
      )
    },
  })
}
