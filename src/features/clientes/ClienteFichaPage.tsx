import {
  ArrowLeft,
  Building2,
  Mail,
  Pencil,
  Phone,
  Repeat,
  ShieldX,
  User,
  UserCheck,
  UserX,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarDataHora } from '@/lib/datas'
import { formatarDocumento, formatarTelefone, linkWhatsapp } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import {
  useAnonimizarCliente,
  useAtendimentos,
  useAtualizarCliente,
  useCliente,
  type ClienteCompleto,
} from './api'
import { Secao } from './ficha/Secao'
import { SecaoAtendimentos } from './ficha/SecaoAtendimentos'
import { SecaoContatos } from './ficha/SecaoContatos'
import { SecaoEnderecos } from './ficha/SecaoEnderecos'
import { SecaoFinanceira } from './ficha/SecaoFinanceira'
import { SecaoPropostas } from './ficha/SecaoPropostas'
import { ListaArquivos } from '../arquivos/ListaArquivos'
import { SecaoHistorico } from './ficha/SecaoHistorico'
import { TransferirModal } from './ficha/TransferirModal'

/** Ficha do cliente: tudo sobre ele num lugar só. */
export function ClienteFichaPage() {
  const { id = '' } = useParams()
  const cliente = useCliente(id)

  if (cliente.isPending) return <Carregando />
  if (cliente.isError) return <Aviso tipo="erro">{mensagemDeErro(cliente.error)}</Aviso>
  if (!cliente.data) {
    return <Aviso tipo="erro">Cliente não encontrado ou sem permissão de acesso.</Aviso>
  }
  return <Ficha cliente={cliente.data} />
}

function Ficha({ cliente }: { cliente: ClienteCompleto }) {
  const perfil = usePerfil()
  const acessoTotal = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const ehAdmin = perfil.papel === 'admin'
  const anonimizado = !!cliente.anonimizado_em
  const podeEditar = !anonimizado

  const atendimentos = useAtendimentos(cliente.id)
  const ultimo = atendimentos.data?.[0]
  const atualizar = useAtualizarCliente(cliente.id)
  const anonimizar = useAnonimizarCliente(cliente.id)
  const [transferindo, setTransferindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const Icone = cliente.tipo_pessoa === 'PJ' ? Building2 : User

  async function alternarAtivo() {
    const acao = cliente.ativo ? 'desativar' : 'reativar'
    if (!window.confirm(`Deseja ${acao} este cliente?`)) return
    try {
      await atualizar.mutateAsync({ ativo: !cliente.ativo })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function aoAnonimizar() {
    const ok = window.confirm(
      'LGPD: os dados pessoais deste cliente (nome, documento, telefones, e-mail, contatos e endereços) serão apagados para sempre. O histórico de serviços e valores é mantido.\n\nEsta ação não pode ser desfeita. Continuar?',
    )
    if (!ok) return
    try {
      await anonimizar.mutateAsync()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Clientes
      </Link>

      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-lima-claro text-verde">
            <Icone aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words">
              {cliente.nome_fantasia || cliente.nome}
            </h1>
            {cliente.nome_fantasia && <p className="text-texto-suave">{cliente.nome}</p>}
            <div className="mt-1 flex flex-wrap gap-2">
              <Etiqueta cor="verde">{cliente.tipo_pessoa}</Etiqueta>
              {cliente.cpf_cnpj && (
                <Etiqueta>{formatarDocumento(cliente.cpf_cnpj, cliente.tipo_pessoa)}</Etiqueta>
              )}
              {!cliente.ativo && <Etiqueta cor="alerta">Inativo</Etiqueta>}
              {anonimizado && <Etiqueta cor="perigo">Anonimizado (LGPD)</Etiqueta>}
            </div>
          </div>
        </div>
        {podeEditar && (
          <Link
            to={`/clientes/${cliente.id}/editar`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
        )}
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Secao titulo="Contato">
            <div className="flex flex-col gap-2">
              {cliente.whatsapp && (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={`tel:${cliente.whatsapp}`}
                    className="inline-flex items-center gap-2 font-semibold"
                  >
                    <Phone className="size-4 text-verde" aria-hidden />
                    {formatarTelefone(cliente.whatsapp)}
                  </a>
                  <a
                    href={linkWhatsapp(cliente.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-[#25D366] px-3 py-1 text-sm font-semibold text-white"
                  >
                    WhatsApp
                  </a>
                </div>
              )}
              {cliente.telefone && (
                <a href={`tel:${cliente.telefone}`} className="inline-flex items-center gap-2">
                  <Phone className="size-4 text-verde" aria-hidden />
                  {formatarTelefone(cliente.telefone)}
                </a>
              )}
              {cliente.email && (
                <a href={`mailto:${cliente.email}`} className="inline-flex items-center gap-2">
                  <Mail className="size-4 text-verde" aria-hidden />
                  {cliente.email}
                </a>
              )}
              {!cliente.whatsapp && !cliente.telefone && !cliente.email && (
                <p className="text-sm text-texto-suave">Nenhum telefone ou e-mail cadastrado.</p>
              )}
              {cliente.observacoes && (
                <p className="mt-2 rounded-xl bg-fundo-suave p-3 text-sm whitespace-pre-line">
                  {cliente.observacoes}
                </p>
              )}
            </div>
          </Secao>

          {acessoTotal && (
            <SecaoFinanceira
              clienteId={cliente.id}
              clienteNome={cliente.nome_fantasia || cliente.nome}
            />
          )}
          {perfil.papel !== 'recepcao' && (
            <SecaoPropostas
              clienteId={cliente.id}
              clienteNome={cliente.nome_fantasia || cliente.nome}
              vendedorId={cliente.vendedor_responsavel_id}
              podeCriar={podeEditar}
            />
          )}
          <SecaoAtendimentos clienteId={cliente.id} />
          <SecaoEnderecos
            clienteId={cliente.id}
            enderecos={cliente.enderecos}
            podeEditar={podeEditar}
          />
          <SecaoContatos
            clienteId={cliente.id}
            contatos={cliente.contatos_cliente}
            podeEditar={podeEditar}
          />
          <Secao titulo="Documentos">
            <ListaArquivos
              clienteId={cliente.id}
              categoria="outro"
              podeEnviar={podeEditar}
              textoVazio="Contratos, licenças, fotos do local… tudo o que não é de uma proposta."
            />
          </Secao>
        </div>

        {/* Coluna lateral */}
        <div className="flex flex-col gap-5">
          <Secao titulo="Comercial">
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-texto-suave">Vendedor responsável</dt>
                <dd className="font-semibold">{cliente.vendedor?.nome ?? 'Sem vendedor'}</dd>
              </div>
              <div>
                <dt className="text-texto-suave">Último atendimento</dt>
                <dd className="font-semibold">
                  {ultimo
                    ? `${formatarDataHora(ultimo.data_hora)} · ${ultimo.usuario?.nome ?? ''}`
                    : 'Nenhum ainda'}
                </dd>
              </div>
              {cliente.origem && (
                <div>
                  <dt className="text-texto-suave">Como conheceu</dt>
                  <dd className="font-semibold">{cliente.origem}</dd>
                </div>
              )}
            </dl>
            {ehAdmin && podeEditar && (
              <Button
                variante="secundario"
                className="mt-4 w-full"
                onClick={() => setTransferindo(true)}
              >
                <Repeat className="size-4" aria-hidden /> Transferir para outro vendedor
              </Button>
            )}
          </Secao>

          <EmBreveNaFicha titulo="Serviços e vencimentos" fase={4} />

          {acessoTotal && (
            <Secao titulo="Administração">
              <div className="flex flex-col gap-2">
                {!anonimizado && (
                  <Button variante="secundario" onClick={() => void alternarAtivo()}>
                    {cliente.ativo ? (
                      <>
                        <UserX className="size-4" aria-hidden /> Desativar cliente
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-4" aria-hidden /> Reativar cliente
                      </>
                    )}
                  </Button>
                )}
                {ehAdmin && !anonimizado && (
                  <Button variante="fantasma" onClick={() => void aoAnonimizar()}>
                    <ShieldX className="size-4" aria-hidden /> Anonimizar (pedido LGPD)
                  </Button>
                )}
              </div>
            </Secao>
          )}
        </div>
      </div>

      {acessoTotal && <SecaoHistorico clienteId={cliente.id} />}

      <TransferirModal
        aberto={transferindo}
        aoFechar={() => setTransferindo(false)}
        clienteId={cliente.id}
        vendedorAtualId={cliente.vendedor_responsavel_id}
      />
    </div>
  )
}

function EmBreveNaFicha({ titulo, fase }: { titulo: string; fase: number }) {
  return (
    <Card className="border-dashed bg-fundo-suave">
      <h2 className="font-bold text-texto-suave">{titulo}</h2>
      <p className="text-sm text-texto-suave">Chega na Fase {fase}.</p>
    </Card>
  )
}
