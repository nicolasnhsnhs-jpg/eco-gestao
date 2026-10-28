import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { formatarData, hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

// -----------------------------------------------------------------------------
// Configurações gerais
// -----------------------------------------------------------------------------

function useConfiguracoes() {
  return useQuery({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*')
      if (error) throw error
      return Object.fromEntries(data.map((c) => [c.chave, c.valor])) as Record<string, string>
    },
  })
}

export function SecaoConfiguracoes() {
  const configuracoes = useConfiguracoes()
  const queryClient = useQueryClient()
  const [valores, setValores] = useState<Record<string, string>>({})
  const salvar = useMutation({
    mutationFn: async (dados: Record<string, string>) => {
      for (const [chave, valor] of Object.entries(dados)) {
        const { error } = await supabase.from('configuracoes').update({ valor }).eq('chave', chave)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setValores({})
      void queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
    },
  })

  const valor = (chave: string) => valores[chave] ?? configuracoes.data?.[chave] ?? ''

  return (
    <Card>
      <h2 className="mb-4 text-lg font-bold">Configurações</h2>
      {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
      {salvar.isSuccess && <Aviso tipo="sucesso">Configurações salvas.</Aviso>}
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Mensalidades dos contratos vencem no dia útil nº"
          htmlFor="cfg-dia"
          dica="Ex.: 1 = primeiro dia útil; 5 = quinto. Vale para os contratos sem dia próprio."
        >
          <Input
            id="cfg-dia"
            inputMode="numeric"
            value={valor('contrato_dia_util_cobranca')}
            onChange={(e) => setValores({ ...valores, contrato_dia_util_cobranca: e.target.value })}
          />
        </Campo>
        <Campo
          rotulo="Comissão padrão dos vendedores (%)"
          htmlFor="cfg-comissao"
          dica="Vendedor com % próprio (em Usuários) usa o dele."
        >
          <Input
            id="cfg-comissao"
            inputMode="decimal"
            value={valor('comissao_percentual_padrao')}
            onChange={(e) =>
              setValores({
                ...valores,
                comissao_percentual_padrao: e.target.value.replace(',', '.'),
              })
            }
          />
        </Campo>
      </div>
      <p className="mt-3 text-sm text-texto-suave">
        Mudanças valem para as próximas mensalidades e comissões; as já criadas não mudam.
      </p>
      <Button
        className="mt-4"
        disabled={Object.keys(valores).length === 0 || salvar.isPending}
        onClick={() => salvar.mutate(valores)}
      >
        {salvar.isPending ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Feriados
// -----------------------------------------------------------------------------

const NOME_ABRANGENCIA = { estadual: 'SC', municipal: 'Palhoça', outro: 'Outro' } as const
type Abrangencia = keyof typeof NOME_ABRANGENCIA

export function SecaoFeriados() {
  const ano = Number(hojeISO().slice(0, 4))
  const queryClient = useQueryClient()
  const nacionais = useQuery({
    queryKey: ['feriados', 'nacionais', ano],
    staleTime: Infinity,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.rpc('feriados_nacionais', { ano }),
        supabase.rpc('feriados_nacionais', { ano: ano + 1 }),
      ])
      if (a.error) throw a.error
      if (b.error) throw b.error
      return [...a.data, ...b.data]
    },
  })
  const locais = useQuery({
    queryKey: ['feriados', 'locais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feriados')
        .select('*')
        .gte('data', `${ano}-01-01`)
        .order('data')
      if (error) throw error
      return data
    },
  })
  const atualizar = () => void queryClient.invalidateQueries({ queryKey: ['feriados'] })
  const adicionar = useMutation({
    mutationFn: async (dados: { data: string; descricao: string; abrangencia: Abrangencia }) => {
      const { error } = await supabase.from('feriados').insert(dados)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feriados').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
  const [novo, setNovo] = useState({
    data: '',
    descricao: '',
    abrangencia: 'municipal' as Abrangencia,
  })

  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">Feriados</h2>
      <p className="mb-4 text-sm text-texto-suave">
        Usados para calcular os dias úteis. Os nacionais (inclusive Carnaval, Sexta-feira Santa e
        Corpus Christi) já vêm prontos, para qualquer ano. Cadastre aqui os de SC e de Palhoça,
        conferidos com a contabilidade.
      </p>
      {(adicionar.isError || remover.isError) && (
        <Aviso tipo="erro">{mensagemDeErro(adicionar.error ?? remover.error)}</Aviso>
      )}

      <form
        className="mb-4 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          if (!novo.data || novo.descricao.trim().length < 2) return
          adicionar.mutate({ ...novo, descricao: novo.descricao.trim() })
          setNovo({ ...novo, data: '', descricao: '' })
        }}
      >
        <Input
          type="date"
          aria-label="Data do feriado"
          value={novo.data}
          onChange={(e) => setNovo({ ...novo, data: e.target.value })}
        />
        <Input
          aria-label="Nome do feriado"
          placeholder="Ex.: Aniversário de Palhoça"
          value={novo.descricao}
          onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
        />
        <Select
          aria-label="Abrangência"
          value={novo.abrangencia}
          onChange={(e) => setNovo({ ...novo, abrangencia: e.target.value as Abrangencia })}
        >
          {Object.entries(NOME_ABRANGENCIA).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Select>
        <Button type="submit" variante="secundario" disabled={adicionar.isPending}>
          Adicionar
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-texto-suave uppercase">
            SC, Palhoça e outros
          </h3>
          {locais.data?.length === 0 && (
            <p className="text-sm text-texto-suave">Nenhum cadastrado ainda.</p>
          )}
          <ul className="flex flex-col gap-1 text-sm">
            {locais.data?.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0 font-semibold">{formatarData(f.data)}</span>
                <span className="flex-1">
                  {f.descricao}{' '}
                  <span className="text-texto-suave">({NOME_ABRANGENCIA[f.abrangencia]})</span>
                </span>
                <BotaoIcone rotulo={`Remover ${f.descricao}`} onClick={() => remover.mutate(f.id)}>
                  <Trash2 className="size-4" />
                </BotaoIcone>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-texto-suave uppercase">
            Nacionais ({ano} e {ano + 1})
          </h3>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
            {nacionais.data?.map((f) => (
              <li key={f.data} className="flex gap-2">
                <span className="w-24 shrink-0 font-semibold">{formatarData(f.data)}</span>
                <span>{f.descricao}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
