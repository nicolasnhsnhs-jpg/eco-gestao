import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ESCRITORIO_OS } from '@/lib/papeis'

import { ListaArquivos } from '../arquivos/ListaArquivos'
import { usePerfil } from '../auth/useAuth'
import {
  COR_STATUS_OS,
  enderecoDaFicha,
  fichaDaOs,
  NOME_STATUS_OS,
  osAberta,
  useAtualizarOs,
  useOrdemServico,
  useReabrirOs,
} from './api'

const hora = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : '—'

/** Ficha da OS para o escritório: escopo, o que o operador preencheu e as ações. */
export function OsPage() {
  const { id = '' } = useParams()
  const perfil = usePerfil()
  const os = useOrdemServico(id)
  const atualizar = useAtualizarOs(id)
  const reabrir = useReabrirOs(id)
  const [erro, setErro] = useState<string | null>(null)

  if (os.isPending) return <Carregando />
  if (os.isError) return <Aviso tipo="erro">{mensagemDeErro(os.error)}</Aviso>
  if (!os.data) return <Aviso tipo="erro">OS não encontrada.</Aviso>

  const o = os.data
  const ficha = fichaDaOs(o.ficha_cliente)
  const e = o.execucao
  const escritorio = PAPEIS_ESCRITORIO_OS.includes(perfil.papel)

  async function executar(acao: () => Promise<unknown>) {
    setErro(null)
    try {
      await acao()
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <>
      <PageHeader
        titulo={`${o.numero} · ${o.tipo?.nome ?? ''}`}
        descricao={`${ficha.nome_fantasia || ficha.nome}${ficha.unidade?.apelido ? ` · ${ficha.unidade.apelido}` : ''}`}
        acoes={
          <div className="flex flex-wrap gap-2">
            {escritorio && (
              <Link to={`/os/nova?cliente=${o.cliente_id}`}>
                <Button variante="secundario">Agendar próxima visita</Button>
              </Link>
            )}
            {perfil.papel === 'admin' && osAberta(o.status) && (
              <Link to={`/os/${o.id}/executar`}>
                <Button variante="secundario">Preencher execução</Button>
              </Link>
            )}
            {escritorio && (o.status === 'agendada' || o.status === 'rascunho') && (
              <Button
                variante="fantasma"
                onClick={() => {
                  if (!window.confirm('Cancelar esta OS?')) return
                  void executar(() => atualizar.mutateAsync({ dados: { status: 'cancelada' } }))
                }}
              >
                Cancelar OS
              </Button>
            )}
            {perfil.papel === 'admin' && (o.status === 'concluida' || o.status === 'conferida') && (
              <Button
                variante="fantasma"
                onClick={() => {
                  const motivo = window.prompt('Motivo da reabertura (fica registrado):')?.trim()
                  if (!motivo) return
                  void executar(() => reabrir.mutateAsync(motivo))
                }}
              >
                Reabrir OS
              </Button>
            )}
          </div>
        }
      />

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <h2 className="font-titulo text-lg font-bold text-verde-escuro">Escopo</h2>
          <Linha rotulo="Situação">
            <Etiqueta cor={COR_STATUS_OS[o.status]}>{NOME_STATUS_OS[o.status]}</Etiqueta>
          </Linha>
          <Linha rotulo="Agendada para">
            {formatarData(o.data_agendada)}
            {o.hora_agendada && ` às ${o.hora_agendada.slice(0, 5)}`}
          </Linha>
          <Linha rotulo="Operadores">
            {o.operadores.map((x) => x.operador?.nome).join(', ') || '—'}
          </Linha>
          <Linha rotulo="Veículo">
            {o.veiculo ? `${o.veiculo.placa} · ${o.veiculo.descricao}` : '—'}
          </Linha>
          <Linha rotulo="CPF/CNPJ">
            {ficha.cpf_cnpj
              ? formatarDocumento(ficha.cpf_cnpj, ficha.cpf_cnpj.length === 11 ? 'PF' : 'PJ')
              : '—'}
          </Linha>
          <Linha rotulo="Endereço">{enderecoDaFicha(ficha) || '—'}</Linha>
          <Linha rotulo="Descrição">{o.descricao || '—'}</Linha>
          <Linha rotulo="Observações ADM">{o.observacoes_adm || '—'}</Linha>
          {o.motivo_reabertura && (
            <Aviso tipo="info">
              Reaberta em {formatarDataHora(o.reaberta_em)}: {o.motivo_reabertura}
            </Aviso>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="font-titulo text-lg font-bold text-verde-escuro">Execução</h2>
          {e ? (
            <>
              <Linha rotulo="Data">{formatarData(e.data)}</Linha>
              <Linha rotulo="Horários">
                Chegada {hora(e.hora_chegada)} · Início {hora(e.hora_inicio)} · Término{' '}
                {hora(e.hora_termino)} · Saída {hora(e.hora_saida)}
              </Linha>
              <Linha rotulo="KM na chegada">{e.km_chegada?.toLocaleString('pt-BR') ?? '—'}</Linha>
              <Linha rotulo="Resultado">{e.resultado || '—'}</Linha>
              <Linha rotulo="Observações">{e.observacoes || '—'}</Linha>
              <Linha rotulo="Operador">
                {e.operador_nome || '—'}{' '}
                {e.assinatura_operador_id && <Etiqueta cor="verde">Visto</Etiqueta>}
              </Linha>
              <Linha rotulo="Acompanhou">
                {[e.responsavel_nome, e.responsavel_setor].filter(Boolean).join(' · ') || '—'}{' '}
                {e.assinatura_cliente_id && <Etiqueta cor="verde">Assinado</Etiqueta>}
              </Linha>
              {o.concluida_em && (
                <Linha rotulo="Concluída em">{formatarDataHora(o.concluida_em)}</Linha>
              )}
            </>
          ) : (
            <p className="text-texto-suave">Sem execução.</p>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-titulo text-lg font-bold text-verde-escuro">
          Fotos e assinaturas
        </h2>
        <ListaArquivos
          clienteId={o.cliente_id}
          osId={o.id}
          categoria="foto_os"
          miniaturas
          podeEnviar={false}
          textoVazio="Nenhuma foto ainda."
        />
      </Card>
    </>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr]">
      <span className="text-sm text-texto-suave">{rotulo}</span>
      <span className="whitespace-pre-line">{children}</span>
    </div>
  )
}
