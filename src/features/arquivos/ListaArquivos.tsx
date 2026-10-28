import { FileImage, FileSpreadsheet, FileText, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { ACCEPT, formatarTamanho } from '@/lib/arquivos'
import { formatarDataHora } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import { useEquipe } from '../clientes/api'
import {
  abrirArquivo,
  useArquivos,
  useEnviarArquivos,
  useRemoverArquivo,
  type Arquivo,
  type CategoriaArquivo,
  type Vinculo,
} from './api'

type Props = Vinculo & {
  /** Categoria gravada nos arquivos enviados por aqui. */
  categoria: CategoriaArquivo
  podeEnviar?: boolean
  textoVazio?: string
}

function IconeArquivo({ tipo }: { tipo: string | null }) {
  const Icone = tipo?.startsWith('image/')
    ? FileImage
    : tipo?.includes('sheet') || tipo?.includes('excel')
      ? FileSpreadsheet
      : FileText
  return <Icone className="size-6 shrink-0 text-verde" aria-hidden />
}

/** Lista de arquivos com envio (computador ou celular), abertura e remoção. */
export function ListaArquivos({
  clienteId,
  propostaId,
  categoria,
  podeEnviar = true,
  textoVazio = 'Nenhum arquivo.',
}: Props) {
  const perfil = usePerfil()
  const equipe = useEquipe()
  const arquivos = useArquivos({ clienteId, propostaId })
  const enviar = useEnviarArquivos({ clienteId, propostaId })
  const remover = useRemoverArquivo(clienteId)
  const campo = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEscolher(lista: FileList | null) {
    if (!lista?.length) return
    setErro(null)
    try {
      await enviar.mutateAsync({ arquivos: [...lista], categoria })
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      if (campo.current) campo.current.value = ''
    }
  }

  async function aoAbrir(arquivo: Arquivo) {
    setErro(null)
    try {
      await abrirArquivo(arquivo)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function aoRemover(arquivo: Arquivo) {
    if (!window.confirm(`Apagar o arquivo “${arquivo.nome_original}”?`)) return
    setErro(null)
    try {
      await remover.mutateAsync(arquivo)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const podeApagar = (a: Arquivo) =>
    a.enviado_por === perfil.id || PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const nomeDe = (id: string) => equipe.data?.find((p) => p.id === id)?.nome ?? ''

  return (
    <div className="flex flex-col gap-3">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {arquivos.isPending && <Carregando />}
      {arquivos.data?.length === 0 && <p className="text-sm text-texto-suave">{textoVazio}</p>}

      {!!arquivos.data?.length && (
        <ul className="flex flex-col gap-2">
          {arquivos.data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-borda p-3">
              <IconeArquivo tipo={a.tipo_mime} />
              <button
                type="button"
                onClick={() => void aoAbrir(a)}
                className="min-w-0 flex-1 text-left"
                title="Abrir"
              >
                <span className="block truncate font-semibold text-verde-escuro underline">
                  {a.nome_original}
                </span>
                <span className="block text-xs text-texto-suave">
                  {[
                    formatarTamanho(a.tamanho_bytes),
                    formatarDataHora(a.criado_em),
                    nomeDe(a.enviado_por),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
              {podeApagar(a) && (
                <BotaoIcone rotulo={`Apagar ${a.nome_original}`} onClick={() => void aoRemover(a)}>
                  <Trash2 className="size-4" />
                </BotaoIcone>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEnviar && (
        <>
          {/* No celular, este campo oferece "tirar foto", "galeria" ou "arquivos". */}
          <input
            ref={campo}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            id={`enviar-${propostaId ?? clienteId}`}
            onChange={(e) => void aoEscolher(e.target.files)}
          />
          <Button
            variante="secundario"
            className="self-start"
            disabled={enviar.isPending}
            onClick={() => campo.current?.click()}
          >
            {enviar.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> Enviando…
              </>
            ) : (
              <>
                <Upload className="size-4" aria-hidden /> Enviar arquivo
              </>
            )}
          </Button>
          <p className="text-xs text-texto-suave">
            PDF, fotos, Word ou Excel, até 20 MB. Fotos grandes são reduzidas automaticamente.
          </p>
        </>
      )}
    </div>
  )
}
