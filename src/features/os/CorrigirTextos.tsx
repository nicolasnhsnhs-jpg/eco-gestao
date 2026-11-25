import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SpellCheck } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import type { Json } from '@/lib/database.types'
import { mensagemDeErro } from '@/lib/erros'
import { avisosOrtografia } from '@/lib/ortografia'
import { supabase } from '@/lib/supabase'

import type { OsCompleta } from './api'
import { usePontosOs } from './pragasApi'
import { textosDaOs, type TextoDaOs } from './textosDaOs'

/**
 * O escritório corrige o português do que o técnico escreveu, com a OS já concluída
 * (só texto: números, códigos, horários e assinaturas não mudam).
 */
export function CorrigirTextos({ os }: { os: OsCompleta }) {
  const pontos = usePontosOs(os.id)
  const [aberto, setAberto] = useState(false)
  const textos = textosDaOs(os.execucao, pontos.data ?? [])
  const comAviso = textos.filter((t) => avisosOrtografia(t.valor).length > 0).length

  if (!textos.length) return null
  return (
    <Card className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Textos do técnico</h2>
        {!aberto && (
          <Button variante="secundario" onClick={() => setAberto(true)}>
            <SpellCheck className="size-4" aria-hidden /> Corrigir português
          </Button>
        )}
      </div>
      {comAviso > 0 && (
        <Aviso tipo="info">
          {comAviso === 1 ? '1 texto' : `${comAviso} textos`} com possível erro de ortografia.
        </Aviso>
      )}
      {aberto && <Formulario osId={os.id} textos={textos} aoFechar={() => setAberto(false)} />}
    </Card>
  )
}

function Formulario({
  osId,
  textos,
  aoFechar,
}: {
  osId: string
  textos: TextoDaOs[]
  aoFechar: () => void
}) {
  const queryClient = useQueryClient()
  const [valores, setValores] = useState(() => new Map(textos.map((t) => [t.chave, t.valor])))
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const salvar = useMutation({
    mutationFn: async () => {
      const mudados = textos.filter((t) => (valores.get(t.chave) ?? '').trim() !== t.valor.trim())
      if (!mudados.length) return 0
      const execucao: Record<string, string> = {}
      const checklist: { caminho: string[]; valor: string }[] = []
      const pontos: { id: string; observacao: string }[] = []
      for (const t of mudados) {
        const valor = (valores.get(t.chave) ?? '').trim()
        if (t.onde.tipo === 'execucao') execucao[t.onde.campo] = valor
        else if (t.onde.tipo === 'checklist') checklist.push({ caminho: t.onde.caminho, valor })
        else pontos.push({ id: t.onde.id, observacao: valor })
      }
      const { data, error } = await supabase.rpc('os_corrigir_textos', {
        os: osId,
        execucao: execucao as Json,
        checklist: checklist as Json,
        pontos: pontos as Json,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os'] }),
  })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        setSucesso(null)
        salvar.mutate(undefined, {
          onSuccess: (n) =>
            setSucesso(
              n
                ? 'Textos corrigidos. Toque em "Baixar PDF" para o PDF salvo sair com o texto novo.'
                : 'Nada mudou.',
            ),
          onError: (e) => setErro(mensagemDeErro(e)),
        })
      }}
    >
      <p className="text-sm text-texto-suave">
        Só o texto muda: códigos, quantidades, horários e assinaturas ficam como o técnico
        registrou. A troca fica no histórico.
      </p>
      {textos.map((t) => (
        <Campo key={t.chave} rotulo={t.rotulo} htmlFor={`corrigir-${t.chave}`}>
          <Textarea
            id={`corrigir-${t.chave}`}
            rows={Math.min(6, Math.max(2, Math.ceil(t.valor.length / 70)))}
            className="min-h-0"
            value={valores.get(t.chave) ?? ''}
            onChange={(e) => setValores(new Map(valores).set(t.chave, e.target.value))}
          />
        </Campo>
      ))}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar correções'}
        </Button>
        <Button type="button" variante="secundario" onClick={aoFechar}>
          Fechar
        </Button>
      </div>
    </form>
  )
}
