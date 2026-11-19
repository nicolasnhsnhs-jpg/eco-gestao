import { useDeferredValue } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Mail, Paperclip, Search } from 'lucide-react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { usePerfil } from '@/features/auth/useAuth'
import { formatarDataHora } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_CERTIFICADOS, PAPEIS_ESCRITORIO_OS, type Papel } from '@/lib/papeis'

import { NOME_TIPO_EMAIL, useEmailsEnviados, type EmailEnviado, type SetorEmail } from './api'

const TEXTO: Record<SetorEmail, { titulo: string; explicacao: string }> = {
  financeiro: {
    titulo: 'E-mails enviados',
    explicacao: 'Notas fiscais e boletos mandados ao cliente pelo sistema.',
  },
  administrativo: {
    titulo: 'E-mails enviados',
    explicacao: 'Certificados e ordens de serviço mandados ao cliente pelo sistema.',
  },
  comercial: {
    titulo: 'E-mails enviados',
    explicacao: 'Propostas mandadas ao cliente pelo sistema.',
  },
}

/** Para onde leva o "Abrir" de cada e-mail (só quando quem está vendo pode abrir). */
function linkDoEmail(e: EmailEnviado, papel: Papel): string | null {
  if (e.nota_id && (papel === 'admin' || papel === 'financeiro'))
    return `/financeiro/notas/${e.nota_id}`
  if (e.proposta_id) return `/propostas/${e.proposta_id}`
  if (e.certificado_id && PAPEIS_CERTIFICADOS.includes(papel))
    return `/certificados/${e.certificado_id}`
  if (e.os_ids.length && PAPEIS_ESCRITORIO_OS.includes(papel)) return `/os/${e.os_ids[0]}`
  return null
}

/**
 * Consulta dos e-mails que o setor mandou, dos mais recentes para os mais antigos,
 * com busca pelo cliente (ou e-mail, ou número): o funcionário confere que foi sem
 * precisar abrir a caixa de e-mail e procurar a cópia.
 */
export function EmailsEnviadosPage({ setor }: { setor: SetorEmail }) {
  const perfil = usePerfil()
  const [parametros, setParametros] = useSearchParams()
  const busca = parametros.get('q') ?? ''
  const buscaAdiada = useDeferredValue(busca)
  const emails = useEmailsEnviados(setor, buscaAdiada)
  const lista = emails.data?.pages.flat() ?? []

  function mudarBusca(valor: string) {
    const novos = new URLSearchParams(parametros)
    if (valor) novos.set('q', valor)
    else novos.delete('q')
    setParametros(novos, { replace: true })
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">{TEXTO[setor].titulo}</h1>
      <p className="mb-4 text-sm text-texto-suave">{TEXTO[setor].explicacao}</p>

      <Card className="mb-4 p-4">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Pesquisar
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave"
              aria-hidden
            />
            <Input
              type="search"
              className="pl-10"
              placeholder="Cliente, e-mail ou número"
              value={busca}
              onChange={(e) => mudarBusca(e.target.value)}
            />
          </div>
        </label>
      </Card>

      {emails.isError && <Aviso tipo="erro">{mensagemDeErro(emails.error)}</Aviso>}
      {emails.isPending && <Carregando />}

      {emails.isSuccess &&
        (lista.length === 0 ? (
          <Card className="py-10 text-center text-texto-suave">
            {buscaAdiada.trim()
              ? 'Nenhum e-mail enviado encontrado com essa pesquisa.'
              : 'Nenhum e-mail enviado ainda.'}
          </Card>
        ) : (
          <>
            <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
              {lista.map((e) => (
                <LinhaEmail key={e.id} e={e} link={linkDoEmail(e, perfil.papel)} />
              ))}
            </ul>
            {emails.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <Button
                  variante="secundario"
                  disabled={emails.isFetchingNextPage}
                  onClick={() => emails.fetchNextPage()}
                >
                  {emails.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </>
        ))}
      <p className="mt-3 text-sm text-texto-suave">
        Aparecem os e-mails mandados pelo sistema a partir de 19/11/2026. A cópia oculta é quem
        também recebeu o e-mail (para o registro na caixa de entrada).
      </p>
    </>
  )
}

function LinhaEmail({ e, link }: { e: EmailEnviado; link: string | null }) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <Mail className="mt-0.5 size-6 shrink-0 text-verde" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-semibold">{e.cliente_nome || 'Cliente'}</p>
          <p className="text-sm text-texto-suave">{formatarDataHora(e.enviado_em)}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Etiqueta cor="verde">{NOME_TIPO_EMAIL[e.tipo] ?? e.tipo}</Etiqueta>
          <span className="text-sm font-medium">{e.descricao}</span>
          {e.valor !== null && (
            <strong className="text-sm text-verde-escuro">{formatarReais(e.valor)}</strong>
          )}
          {e.automatico && <Etiqueta>Automático, ao emitir</Etiqueta>}
        </div>
        <p className="mt-1 text-sm break-words">
          <span className="text-texto-suave">Para: </span>
          {e.para}
        </p>
        {e.copia_oculta && (
          <p className="text-sm break-words text-texto-suave">Cópia oculta: {e.copia_oculta}</p>
        )}
        {e.anexos.length > 0 && (
          <p className="mt-1 flex items-start gap-1 text-sm break-words text-texto-suave">
            <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden />
            {e.anexos.join(', ')}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-texto-suave">
          <span>{e.perfil?.nome ? `Enviado por ${e.perfil.nome}` : ''}</span>
          {link && (
            <Link to={link} className="font-semibold text-verde-escuro hover:underline">
              Abrir
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}
