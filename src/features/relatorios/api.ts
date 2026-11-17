import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

import { fichaDaOs } from '../os/api'

import type { OsParaRelatorio } from './montarRelatorio'

/*
 * Relatório mensal: as OS feitas de um cliente num período e, das escolhidas,
 * tudo o que o técnico anotou (pontos, produtos, insetos e a equipe).
 */

export function useOsDoPeriodo(clienteId: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: ['relatorios', 'os', clienteId, de, ate],
    enabled: !!clienteId && !!de && !!ate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(
          'id, numero, status, data_agendada, endereco_id, ficha_cliente, tipo:tipos_servico(id, nome, formulario_os), execucao:os_execucao(data), operadores:os_operadores(operador:perfis(nome))',
        )
        .eq('cliente_id', clienteId!)
        .eq('treinamento', false)
        .in('status', ['concluida', 'conferida'])
        .gte('data_agendada', de)
        .lte('data_agendada', ate)
        .order('data_agendada')
        .limit(300)
      if (error) throw error
      return data.map((os) => ({
        id: os.id,
        numero: os.numero,
        data: os.execucao?.data ?? os.data_agendada,
        enderecoId: os.endereco_id,
        unidade: fichaDaOs(os.ficha_cliente).unidade?.apelido || null,
        endereco: fichaDaOs(os.ficha_cliente).unidade ?? null,
        tipoId: os.tipo?.id ?? '',
        tipoNome: os.tipo?.nome ?? 'Serviço',
        formulario: os.tipo?.formulario_os ?? 'generico',
        equipe: os.operadores.map((o) => o.operador?.nome).filter((n): n is string => !!n),
      }))
    },
  })
}

export type OsDoPeriodo = NonNullable<ReturnType<typeof useOsDoPeriodo>['data']>[number]

/** Tudo das OS escolhidas, no formato que o relatório usa. */
export async function buscarOsParaRelatorio(ids: string[]): Promise<OsParaRelatorio[]> {
  if (ids.length === 0) return []
  const [ordens, pontos, produtos, insetos] = await Promise.all([
    supabase
      .from('ordens_servico')
      .select(
        'id, numero, data_agendada, escopo, ficha_cliente, tipo:tipos_servico(nome, formulario_os), operadores:os_operadores(operador:perfis(nome)), execucao:os_execucao(data, checklist, resultado, observacoes, operador_nome)',
      )
      .in('id', ids),
    supabase.from('os_pontos').select('*').in('os_id', ids).order('numero'),
    supabase
      .from('os_produtos')
      .select(
        '*, produto:produtos_certificado(id, nome_comercial, principio_ativo, registro, lote, fabricacao, validade)',
      )
      .in('os_id', ids)
      .order('criado_em'),
    supabase.from('os_insetos').select('*').in('os_id', ids).order('criado_em'),
  ])
  for (const r of [ordens, pontos, produtos, insetos]) if (r.error) throw r.error

  return (ordens.data ?? []).map((os) => {
    const equipe = os.operadores.map((o) => o.operador?.nome).filter((n): n is string => !!n)
    const operadorNome = os.execucao?.operador_nome?.trim()
    return {
      id: os.id,
      numero: os.numero,
      data: os.execucao?.data ?? os.data_agendada,
      tipoNome: os.tipo?.nome ?? 'Serviço',
      formulario: os.tipo?.formulario_os ?? 'generico',
      escopo: os.escopo,
      checklist: os.execucao?.checklist ?? {},
      resultado: os.execucao?.resultado ?? null,
      observacoes: os.execucao?.observacoes ?? null,
      equipe: equipe.length ? equipe : operadorNome ? [operadorNome] : [],
      ficha: fichaDaOs(os.ficha_cliente),
      pontos: (pontos.data ?? []).filter((p) => p.os_id === os.id),
      produtos: (produtos.data ?? []).filter((p) => p.os_id === os.id),
      insetos: (insetos.data ?? []).filter((i) => i.os_id === os.id),
    }
  })
}
