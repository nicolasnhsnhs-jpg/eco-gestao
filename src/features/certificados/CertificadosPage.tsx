import { FileDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { useCertificados, type CertificadoResumo } from './api'
import { AbasCertificados } from './ProdutosCertificadoPage'

const nomeCliente = (c: CertificadoResumo['cliente']) => c?.nome_fantasia || c?.nome || '—'

const nomeUnidade = (e: CertificadoResumo['endereco']) =>
  e ? e.apelido || `${e.logradouro}, ${e.numero ?? 's/n'} · ${e.cidade}/${e.uf}` : null

function situacao(c: CertificadoResumo) {
  if (c.cancelado_em) return { texto: 'Cancelado', cor: 'cinza' as const }
  if (!c.validade) return { texto: 'Sem validade', cor: 'cinza' as const }
  if (c.validade < hojeISO()) return { texto: 'Vencido', cor: 'perigo' as const }
  return { texto: `Válido até ${formatarData(c.validade)}`, cor: 'verde' as const }
}

/** /certificados: lista dos certificados emitidos, com busca e PDF. */
export function CertificadosPage() {
  const certificados = useCertificados()
  const [busca, setBusca] = useState('')
  const [gerando, setGerando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const termo = busca.trim().toLowerCase()
  const lista =
    certificados.data?.filter(
      (c) =>
        !termo ||
        [c.numero, c.cliente?.nome, c.cliente?.nome_fantasia, c.endereco?.apelido, c.tipo?.nome]
          .filter(Boolean)
          .some((t) => t!.toLowerCase().includes(termo)),
    ) ?? []

  async function baixar(c: CertificadoResumo) {
    setErro(null)
    setGerando(c.id)
    // O gerador de PDF só é baixado quando alguém pede um PDF.
    const aba = window.open('', '_blank')
    try {
      const { abrirPdfCertificado } = await import('./pdf/gerarPdfCertificado')
      await abrirPdfCertificado(c, aba)
    } catch (e) {
      aba?.close()
      setErro(mensagemDeErro(e))
    } finally {
      setGerando(null)
    }
  }

  return (
    <>
      <AbasCertificados />
      <PageHeader
        titulo="Certificados"
        descricao="Emita o certificado de cada serviço feito e baixe o PDF para enviar ao cliente."
        acoes={
          <Link to="/certificados/novo">
            <Button>
              <Plus className="size-5" aria-hidden /> Emitir certificado
            </Button>
          </Link>
        }
      />
      <input
        aria-label="Buscar"
        placeholder="Buscar por número, cliente, unidade ou serviço…"
        className="mb-4 min-h-11 w-full rounded-xl border border-borda bg-white px-3"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      {certificados.isPending && <Carregando />}
      {certificados.isError && <Aviso tipo="erro">{mensagemDeErro(certificados.error)}</Aviso>}
      {certificados.isSuccess && lista.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          {termo ? 'Nenhum certificado encontrado.' : 'Nenhum certificado emitido ainda.'}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {lista.map((c) => {
          const s = situacao(c)
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borda bg-white p-4"
            >
              <Link to={`/certificados/${c.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="font-semibold text-verde-escuro">
                  {c.numero} · {nomeCliente(c.cliente)}
                  {nomeUnidade(c.endereco) && ` · ${nomeUnidade(c.endereco)}`}
                </p>
                <p className="text-sm text-texto-suave">
                  {c.tipo?.nome} · feito em {formatarData(c.data_execucao)}
                  {c.os?.numero && ` · ${c.os.numero}`}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <Etiqueta cor={s.cor}>{s.texto}</Etiqueta>
                <Button
                  variante="secundario"
                  onClick={() => void baixar(c)}
                  disabled={gerando === c.id}
                  aria-label={`Baixar o PDF do certificado ${c.numero}`}
                >
                  <FileDown className="size-5" aria-hidden />
                  {gerando === c.id ? 'Gerando…' : 'PDF'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
