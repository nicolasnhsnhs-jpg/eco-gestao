import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Textarea } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import type { OsCompleta } from './api'

/**
 * Descrição e observações do ADM de uma O.S já começada ou concluída (o "Editar
 * OS" só vale antes de começar). Ex.: reservatório de 10m³ que era 28m³. Pode
 * valer também para as próximas visitas (O.S salva).
 */
export function CorrigirDescricao({
  os,
  aberto,
  aoFechar,
}: {
  os: OsCompleta
  aberto: boolean
  aoFechar: () => void
}) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={`Editar descrição · ${os.numero}`}>
      <Formulario os={os} aoFechar={aoFechar} />
    </Modal>
  )
}

function Formulario({ os, aoFechar }: { os: OsCompleta; aoFechar: () => void }) {
  const queryClient = useQueryClient()
  const [descricao, setDescricao] = useState(os.descricao ?? '')
  const [observacoes, setObservacoes] = useState(os.observacoes_adm ?? '')
  const [paraProximas, setParaProximas] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('os_corrigir_descricao', {
        os: os.id,
        descricao: descricao.trim(),
        observacoes: observacoes.trim(),
        para_proximas: paraProximas && !!os.modelo_id,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      aoFechar()
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        if (descricao.trim().length < 3) {
          setErro('Descreva o serviço.')
          return
        }
        salvar.mutate()
      }}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo rotulo="Descrição do serviço" htmlFor="cd-descricao" obrigatorio>
        <Textarea
          id="cd-descricao"
          rows={6}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </Campo>
      <Campo rotulo="Observações do ADM" htmlFor="cd-observacoes">
        <Textarea
          id="cd-observacoes"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </Campo>
      {os.modelo_id && (
        <label className="flex items-center gap-3 rounded-xl border border-borda p-3">
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={paraProximas}
            onChange={(e) => setParaProximas(e.target.checked)}
          />
          <span className="text-sm">
            <strong>Vale também para as próximas visitas</strong>
            <br />
            <span className="text-texto-suave">Muda a O.S salva deste local.</span>
          </span>
        </label>
      )}
      <p className="text-sm text-texto-suave">
        Não mexe no que o técnico preencheu. Fica registrado na auditoria.
      </p>
      <div className="flex justify-end gap-2">
        <Button variante="fantasma" type="button" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
