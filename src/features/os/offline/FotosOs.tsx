import { Camera } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { comprimirSeForFoto } from '@/lib/arquivos'
import { mensagemDeErro } from '@/lib/erros'
import { estaOnline } from '@/lib/offline'

import { ListaArquivos } from '../../arquivos/ListaArquivos'
import { guardarArquivoDaOs } from '../api'
import { arquivoGuardado, useFila } from './fila'

/**
 * Fotos da OS na tela do operador. A foto fica no celular na hora (com ou sem
 * sinal) e sobe pela fila. As que já subiram aparecem logo abaixo.
 */
export function FotosOs({
  clienteId,
  osId,
  aberta,
}: {
  clienteId: string
  osId: string
  aberta: boolean
}) {
  const fila = useFila()
  const [erro, setErro] = useState<string | null>(null)
  const pendentes = fila.itens.filter(
    (i) => i.tipo === 'arquivo' && i.osId === osId && i.registro.categoria === 'foto_os',
  )

  async function adicionar(arquivos: FileList | null) {
    setErro(null)
    try {
      for (const original of arquivos ?? []) {
        const foto = await comprimirSeForFoto(original)
        await guardarArquivoDaOs(clienteId, osId, foto, {
          nome: foto.name || original.name,
          tipo: foto.type || original.type || 'image/jpeg',
          categoria: 'foto_os',
        })
      }
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {aberta && (
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white">
          <Camera className="size-5" aria-hidden /> Tirar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => {
              void adicionar(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}
      {pendentes.length > 0 && (
        <>
          <p className="text-sm text-texto-suave">
            {pendentes.length} foto(s) no celular, esperando envio
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {pendentes.map(
              (i) => i.tipo === 'arquivo' && <Miniatura key={i.registro.id} id={i.registro.id} />,
            )}
          </ul>
        </>
      )}
      {estaOnline() && (
        <ListaArquivos
          clienteId={clienteId}
          osId={osId}
          categoria="foto_os"
          filtrarPorCategoria
          miniaturas
          podeEnviar={false}
          textoVazio={pendentes.length ? '' : 'Nenhuma foto enviada ainda.'}
        />
      )}
    </div>
  )
}

function Miniatura({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let link: string | null = null
    void arquivoGuardado(id).then((blob) => {
      if (!blob) return
      link = URL.createObjectURL(blob)
      setUrl(link)
    })
    return () => {
      if (link) URL.revokeObjectURL(link)
    }
  }, [id])
  return (
    <li className="aspect-square overflow-hidden rounded-xl border border-borda bg-fundo-suave">
      {url && <img src={url} alt="Foto guardada no celular" className="size-full object-cover" />}
    </li>
  )
}
