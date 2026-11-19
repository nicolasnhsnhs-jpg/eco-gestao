import { useEffect, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import { useOcorrenciasAbertas, useSalvarOcorrenciasLocal, type ModeloCompleto } from './api'
import { CampoOcorrencias, type ItemOcorrencia } from './CampoOcorrencias'

/**
 * Na O.S salva, antes de agendar: as ocorrências em aberto do local. O ADM escreve
 * aqui e, ao agendar a visita (ou a rota), a OS já nasce com elas.
 */
export function OcorrenciasOsSalva({ modelo }: { modelo: ModeloCompleto }) {
  const abertas = useOcorrenciasAbertas(
    modelo.cliente_id,
    modelo.endereco_id,
    modelo.tipo_servico_id,
  )
  const salvar = useSalvarOcorrenciasLocal(modelo.id)
  const [itens, setItens] = useState<ItemOcorrencia[] | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  // Carrega da lista do banco (e de novo depois de salvar).
  useEffect(() => {
    if (abertas.data) setItens(abertas.data.map((o) => ({ id: o.id, texto: o.texto })))
  }, [abertas.data])

  async function enviar() {
    if (!itens) return
    setAviso(null)
    try {
      await salvar.mutateAsync(itens.map((o) => ({ id: o.id, texto: o.texto })))
      setAviso({
        tipo: 'sucesso',
        texto: 'Ocorrências salvas. A próxima visita agendada já vem com elas.',
      })
    } catch (err) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(err) })
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-titulo text-lg font-bold text-verde-escuro">
        Ocorrências para a próxima visita
      </h2>
      <p className="mb-3 text-sm text-texto-suave">
        Escreva antes de agendar: ao tocar em &quot;Agendar visita&quot; a OS já sai com elas (e as
        visitas já agendadas deste serviço também recebem).
      </p>
      {abertas.isPending && <Carregando />}
      {abertas.isError && <Aviso tipo="erro">{mensagemDeErro(abertas.error)}</Aviso>}
      {itens && (
        <div className="flex flex-col gap-3">
          <CampoOcorrencias itens={itens} aoMudar={setItens} prefixoId="mod-ocorrencia" />
          {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
          <Button className="self-start" disabled={salvar.isPending} onClick={() => void enviar()}>
            {salvar.isPending ? 'Salvando…' : 'Salvar ocorrências'}
          </Button>
        </div>
      )}
    </Card>
  )
}
