import { useQueryClient } from '@tanstack/react-query'
import { Camera, Images } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { comprimirSeForFoto } from '@/lib/arquivos'
import { mensagemDeErro } from '@/lib/erros'
import { estaOnline } from '@/lib/offline'

import { ListaArquivos } from '../../arquivos/ListaArquivos'
import { guardarArquivoDaOs, type CategoriaFotoOs } from '../api'
import { arquivoGuardado, useFila } from './fila'

/**
 * Fotos da OS na tela do operador. A foto fica no celular na hora (com ou sem
 * sinal) e sobe pela fila. As que já subiram aparecem logo abaixo.
 * A categoria separa as fotos gerais das de antes e depois do serviço.
 */
export function FotosOs({
  clienteId,
  osId,
  aberta,
  categoria = 'foto_os',
  rotuloBotao = 'Tirar foto',
  textoVazio = 'Nenhuma foto enviada ainda.',
}: {
  clienteId: string
  osId: string
  aberta: boolean
  categoria?: CategoriaFotoOs
  rotuloBotao?: string
  textoVazio?: string
}) {
  const fila = useFila()
  const [erro, setErro] = useState<string | null>(null)
  const pendentes = fila.itens.filter(
    (i) => i.tipo === 'arquivo' && i.osId === osId && i.registro.categoria === categoria,
  )

  // Quando uma foto sai da fila (subiu), a lista das já enviadas precisa se atualizar.
  const queryClient = useQueryClient()
  const antes = useRef(pendentes.length)
  useEffect(() => {
    if (pendentes.length < antes.current) {
      void queryClient.invalidateQueries({ queryKey: ['arquivos', clienteId, osId] })
    }
    antes.current = pendentes.length
  }, [pendentes.length, queryClient, clienteId, osId])

  async function adicionar(arquivos: File[]) {
    setErro(null)
    try {
      for (const original of arquivos) {
        const foto = await comprimirSeForFoto(original)
        await guardarArquivoDaOs(clienteId, osId, foto, {
          nome: foto.name || original.name,
          tipo: foto.type || original.type || 'image/jpeg',
          categoria,
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
        <div className="grid grid-cols-2 gap-2">
          <BotaoFoto camera rotulo={rotuloBotao} aoEscolher={adicionar} />
          <BotaoFoto rotulo="Galeria" aoEscolher={adicionar} />
        </div>
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
          categoria={categoria}
          filtrarPorCategoria
          miniaturas
          podeEnviar={false}
          textoVazio={pendentes.length ? '' : textoVazio}
        />
      )}
    </div>
  )
}

/**
 * Botão que abre a câmera (camera) ou a galeria do celular. Na galeria dá para
 * escolher várias fotos de uma vez.
 */
function BotaoFoto({
  camera,
  rotulo,
  aoEscolher,
}: {
  camera?: boolean
  rotulo: string
  aoEscolher: (arquivos: File[]) => Promise<void>
}) {
  const Icone = camera ? Camera : Images
  return (
    <label
      className={
        camera
          ? 'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white'
          : 'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-verde px-4 font-semibold text-verde'
      }
    >
      <Icone className="size-5" aria-hidden /> {rotulo}
      <input
        type="file"
        accept="image/*"
        capture={camera ? 'environment' : undefined}
        multiple
        className="sr-only"
        onChange={(e) => {
          // Copia antes de limpar o campo: limpar esvazia a lista de arquivos escolhidos.
          void aoEscolher([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
    </label>
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
