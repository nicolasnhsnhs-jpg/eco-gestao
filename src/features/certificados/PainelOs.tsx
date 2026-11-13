import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { useOrdemServico, type OsCompleta } from '../os/api'

/*
 * Na emissão do certificado: a OS de onde ele veio fica aberta ao lado (os textos
 * principais e o PDF da OS, montado na hora e sem guardar), para ir preenchendo
 * o certificado olhando para ela.
 */
export function PainelOs({ osId, aoFechar }: { osId: string; aoFechar: () => void }) {
  const os = useOrdemServico(osId)
  const o = os.data

  return (
    <Card className="flex flex-col gap-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
            Ordem de serviço
          </p>
          <h2 className="text-lg font-bold">
            {o ? `${o.numero} · ${o.tipo?.nome ?? ''}` : 'Carregando…'}
          </h2>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar a OS"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-verde-escuro hover:bg-lima-claro"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {os.isPending && <Carregando />}
      {os.isError && <Aviso tipo="erro">{mensagemDeErro(os.error)}</Aviso>}
      {o && <ConteudoOs o={o} />}
    </Card>
  )
}

function ConteudoOs({ o }: { o: OsCompleta }) {
  const e = o.execucao
  const pdf = useQuery({
    queryKey: ['os', o.id, 'pdf-rascunho', o.atualizado_em],
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      const { montarPdfOs } = await import('../os/pdf/gerarPdfOs')
      return montarPdfOs(o)
    },
  })
  const link = useMemo(() => (pdf.data ? URL.createObjectURL(pdf.data) : null), [pdf.data])
  useEffect(() => () => void (link && URL.revokeObjectURL(link)), [link])

  return (
    <>
      <dl className="grid gap-2">
        <Dado rotulo="Data do serviço" valor={formatarData(e?.data ?? o.data_agendada)} />
        <Dado rotulo="Descrição" valor={o.descricao} />
        <Dado rotulo="Resultado" valor={e?.resultado} />
        <Dado rotulo="Observações do técnico" valor={e?.observacoes} />
      </dl>

      <div className="flex flex-col gap-1">
        <p className="font-semibold">PDF da OS</p>
        {pdf.isPending && <Carregando />}
        {pdf.isError && <Aviso tipo="erro">{mensagemDeErro(pdf.error)}</Aviso>}
        {link && (
          <>
            <iframe
              title={`PDF da ${o.numero}`}
              src={`${link}#view=FitH`}
              className="h-[70dvh] w-full rounded-xl border border-borda bg-white"
            />
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="self-start font-semibold text-verde underline"
            >
              Abrir o PDF em outra aba
            </a>
          </>
        )}
      </div>

      <Link
        to={`/os/${o.id}`}
        target="_blank"
        className="self-start font-semibold text-verde underline"
      >
        Abrir a OS completa
      </Link>
    </>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor?.trim()) return null
  return (
    <div>
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="font-semibold whitespace-pre-line">{valor}</dd>
    </div>
  )
}
