import { Check, Copy, UserCheck, X } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Select } from '@/components/ui/Campo'
import { mensagemDeErro } from '@/lib/erros'
import { NOME_DO_PAPEL, PAPEIS, type Papel } from '@/lib/papeis'

import {
  enderecoDoLink,
  useCriarLinkCadastro,
  useLinksCadastro,
  useResolverSolicitacao,
  useRevogarLinkCadastro,
  type Usuario,
} from './api'

/** Pelo link ninguém vira Administrador: esse perfil só o admin dá, depois. */
const PAPEIS_DO_LINK = PAPEIS.filter((p) => p !== 'admin')

const VALIDADES = [
  { dias: 1, rotulo: '1 dia' },
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
]

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Janela "Link de cadastro": gera o link para mandar no grupo e lista os que ainda valem. */
export function LinksCadastro() {
  const links = useLinksCadastro()
  const criar = useCriarLinkCadastro()
  const revogar = useRevogarLinkCadastro()
  const [papel, setPapel] = useState<Papel>('operador')
  const [dias, setDias] = useState(7)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(enderecoDoLink(codigo))
      setCopiado(codigo)
      setTimeout(() => setCopiado((atual) => (atual === codigo ? null : atual)), 2500)
    } catch {
      window.prompt('Copie o link:', enderecoDoLink(codigo))
    }
  }

  async function gerar() {
    setErro(null)
    try {
      const link = await criar.mutateAsync({ papel, dias })
      await copiar(link.codigo)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-texto-suave">
        Mande o link no grupo da empresa. Cada pessoa cria o próprio acesso (nome, e-mail e senha) e
        aparece aqui em <strong>Pedindo acesso</strong> para você aprovar.
      </p>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Link para" htmlFor="link-papel">
          <Select id="link-papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
            {PAPEIS_DO_LINK.map((p) => (
              <option key={p} value={p}>
                {NOME_DO_PAPEL[p]}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Vale por" htmlFor="link-dias">
          <Select id="link-dias" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {VALIDADES.map((v) => (
              <option key={v.dias} value={v.dias}>
                {v.rotulo}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Button disabled={criar.isPending} onClick={() => void gerar()}>
        {criar.isPending ? 'Gerando…' : 'Gerar e copiar link'}
      </Button>

      <div>
        <h3 className="mb-2 font-semibold">Links que ainda valem</h3>
        {links.isError && <Aviso tipo="erro">{mensagemDeErro(links.error)}</Aviso>}
        {links.data?.length === 0 && <p className="text-sm text-texto-suave">Nenhum link ativo.</p>}
        <ul className="flex flex-col gap-2">
          {links.data?.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-borda p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{NOME_DO_PAPEL[l.papel]}</p>
                <p className="text-sm text-texto-suave">
                  Vale até {dataHora.format(new Date(l.expira_em))}
                </p>
              </div>
              <Button variante="secundario" onClick={() => void copiar(l.codigo)}>
                {copiado === l.codigo ? (
                  <>
                    <Check className="size-4" aria-hidden /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="size-4" aria-hidden /> Copiar
                  </>
                )}
              </Button>
              <Button
                variante="fantasma"
                disabled={revogar.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Cancelar este link? Quem abrir depois não vai conseguir se cadastrar.',
                    )
                  )
                    return
                  revogar.mutate(l.id, { onError: (e) => setErro(mensagemDeErro(e)) })
                }}
              >
                Cancelar link
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Quem se cadastrou pelo link e espera a aprovação. Some quando não há ninguém. */
export function SolicitacoesDeAcesso({
  pendentes,
  aoTerminar,
  aoErrar,
}: {
  pendentes: Usuario[]
  aoTerminar: (mensagem: string) => void
  aoErrar: (mensagem: string) => void
}) {
  const resolver = useResolverSolicitacao()
  // Perfil escolhido para cada um (começa com o perfil do link).
  const [papeis, setPapeis] = useState<Record<string, Papel>>({})
  const [aprovandoTodos, setAprovandoTodos] = useState(false)

  if (pendentes.length === 0) return null
  const papelDe = (u: Usuario) => papeis[u.id] ?? u.papel

  async function aprovar(u: Usuario) {
    try {
      await resolver.mutateAsync({ usuarioId: u.id, aprovar: true, papel: papelDe(u) })
      aoTerminar(`${u.nome} aprovado como ${NOME_DO_PAPEL[papelDe(u)]}. Já pode entrar.`)
    } catch (e) {
      aoErrar(mensagemDeErro(e))
    }
  }

  async function aprovarTodos() {
    if (
      !window.confirm(
        `Aprovar as ${pendentes.length} pessoas com o perfil escolhido para cada uma?`,
      )
    )
      return
    setAprovandoTodos(true)
    let aprovados = 0
    try {
      for (const u of pendentes) {
        await resolver.mutateAsync({ usuarioId: u.id, aprovar: true, papel: papelDe(u) })
        aprovados++
      }
      aoTerminar(`${aprovados} ${aprovados === 1 ? 'pessoa aprovada' : 'pessoas aprovadas'}.`)
    } catch (e) {
      aoErrar(`${aprovados} aprovada(s). Parou por um erro: ${mensagemDeErro(e)}`)
    } finally {
      setAprovandoTodos(false)
    }
  }

  async function recusar(u: Usuario) {
    if (!window.confirm(`Recusar o pedido de ${u.nome} (${u.email})? O cadastro é apagado.`)) return
    try {
      await resolver.mutateAsync({ usuarioId: u.id, aprovar: false })
      aoTerminar(`Pedido de ${u.nome} recusado.`)
    } catch (e) {
      aoErrar(mensagemDeErro(e))
    }
  }

  const ocupado = resolver.isPending || aprovandoTodos

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border-2 border-alerta/40 bg-white">
      <div className="flex flex-wrap items-center gap-2 bg-amber-50 px-4 py-3">
        <UserCheck className="size-5 text-alerta" aria-hidden />
        <h2 className="flex-1 font-bold">Pedindo acesso ({pendentes.length})</h2>
        {pendentes.length > 1 && (
          <Button disabled={ocupado} onClick={() => void aprovarTodos()}>
            {aprovandoTodos ? 'Aprovando…' : 'Aprovar todos'}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-borda">
        {pendentes.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{u.nome}</p>
              <p className="truncate text-sm text-texto-suave">{u.email}</p>
              <p className="text-xs text-texto-suave">
                Pediu em {dataHora.format(new Date(u.criado_em))}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={`Perfil de ${u.nome}`}
                className="w-auto"
                value={papelDe(u)}
                disabled={ocupado}
                onChange={(e) =>
                  setPapeis((atual) => ({ ...atual, [u.id]: e.target.value as Papel }))
                }
              >
                {PAPEIS_DO_LINK.map((p) => (
                  <option key={p} value={p}>
                    {NOME_DO_PAPEL[p]}
                  </option>
                ))}
              </Select>
              <Button disabled={ocupado} onClick={() => void aprovar(u)}>
                <Check className="size-4" aria-hidden /> Aprovar
              </Button>
              <Button variante="fantasma" disabled={ocupado} onClick={() => void recusar(u)}>
                <X className="size-4" aria-hidden /> Recusar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
