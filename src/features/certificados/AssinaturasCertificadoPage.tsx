import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'

import { usePerfil } from '../auth/useAuth'
import { useAssinatura, useEnviarAssinatura, type QualAssinatura } from './api'
import { AbasCertificados } from './ProdutosCertificadoPage'

/** /certificados/assinaturas: assinatura escaneada que vai no PDF. */
export function AssinaturasCertificadoPage() {
  const perfil = usePerfil()
  const podeTrocar = perfil.papel === 'admin'
  const conf = UNIDADE.certificado
  const pessoas: { qual: QualAssinatura; titulo: string; nome: string }[] = [
    { qual: 'responsavel', titulo: 'Responsável técnico', nome: conf.responsavel.nome },
  ]
  if (conf.responsavelSuccao)
    pessoas.push({
      qual: 'succao',
      titulo: 'Responsável da sucção',
      nome: conf.responsavelSuccao.nome,
    })

  return (
    <>
      <AbasCertificados />
      <p className="mb-4 text-texto-suave">
        A assinatura entra sozinha no PDF quando o certificado está no nome do responsável. Ela fica
        guardada com acesso restrito: só quem emite certificados consegue ver.
        {!podeTrocar && ' Só o Administrador pode trocar.'}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {pessoas.map((p) => (
          <CartaoAssinatura key={p.qual} {...p} podeTrocar={podeTrocar} />
        ))}
      </div>
    </>
  )
}

function CartaoAssinatura({
  qual,
  titulo,
  nome,
  podeTrocar,
}: {
  qual: QualAssinatura
  titulo: string
  nome: string
  podeTrocar: boolean
}) {
  const atual = useAssinatura(qual)
  const enviar = useEnviarAssinatura()
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    try {
      const png = await limparAssinatura(arquivo)
      await enviar.mutateAsync({ qual, png })
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
      <div>
        <h2 className="font-semibold">{titulo}</h2>
        <p className="text-sm text-texto-suave">{nome || 'Nome ainda não configurado'}</p>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-borda bg-fundo-suave p-3">
        {atual.isPending ? (
          <Carregando />
        ) : atual.data ? (
          <img src={atual.data} alt={`Assinatura de ${nome}`} className="max-h-24" />
        ) : (
          <p className="text-sm text-texto-suave">Nenhuma assinatura enviada.</p>
        )}
      </div>
      {podeTrocar && (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => void aoEscolher(e.target.files?.[0])}
          />
          <Button
            variante="secundario"
            disabled={enviar.isPending}
            onClick={() => entrada.current?.click()}
          >
            <Upload className="size-5" aria-hidden />
            {enviar.isPending
              ? 'Enviando…'
              : atual.data
                ? 'Trocar assinatura'
                : 'Enviar assinatura'}
          </Button>
          <p className="text-sm text-texto-suave">
            Foto ou escaneado em fundo branco. O branco some sozinho.
          </p>
        </>
      )}
    </section>
  )
}

/** Deixa o fundo branco transparente, recorta as sobras e devolve um PNG. */
async function limparAssinatura(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  // Imagem grande demais só pesa no PDF: até 800px de largura basta.
  const escala = Math.min(1, 800 / bitmap.width)
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)
  const tela = document.createElement('canvas')
  tela.width = w
  tela.height = h
  const ctx = tela.getContext('2d')
  if (!ctx) throw new Error('Não foi possível ler a imagem.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data
  let [x0, y0, x1, y1] = [w, h, -1, -1]
  for (let i = 0; i < px.length; i += 4) {
    const claro = (px[i] + px[i + 1] + px[i + 2]) / 3
    const alfa = Math.max(0, Math.min(255, ((235 - claro) * 255) / 120))
    px[i + 3] = Math.min(px[i + 3], alfa)
    if (px[i + 3] > 20) {
      const x = (i / 4) % w
      const y = Math.floor(i / 4 / w)
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  if (x1 < 0) throw new Error('Não achei a assinatura na imagem. Use uma foto com fundo branco.')
  ctx.putImageData(img, 0, 0)
  const recorte = document.createElement('canvas')
  recorte.width = x1 - x0 + 1
  recorte.height = y1 - y0 + 1
  recorte.getContext('2d')?.drawImage(tela, -x0, -y0)
  return new Promise((ok, falha) =>
    recorte.toBlob(
      (b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))),
      'image/png',
    ),
  )
}
