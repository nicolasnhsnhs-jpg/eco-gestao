import { useQueryClient } from '@tanstack/react-query'
import { FileDown, Pencil, Printer, Receipt } from 'lucide-react'
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
import {
  PAPEIS_ACESSO_TOTAL,
  PAPEIS_CERTIFICADOS,
  PAPEIS_ESCRITORIO_OS,
  podeApagar,
} from '@/lib/papeis'

import { ListaArquivos } from '../arquivos/ListaArquivos'
import { EnviarOsAoCliente } from '../certificados/EnviarOsAoCliente'
import { usePerfil } from '../auth/useAuth'
import {
  COR_STATUS_OS,
  enderecoDaFicha,
  fichaDaOs,
  NOME_STATUS_OS,
  osAberta,
  useCancelarOs,
  useConferencia,
  useOrdemServico,
  useReabrirOs,
} from './api'
import { nomeVeiculo } from './nomeVeiculo'
import { NOME_RESPOSTA, ocorrenciasDaOs, respostasDe } from './ocorrencias'
import { formatarM3, nomeResiduo, quantidadeValida, residuoDoChecklist } from './tipos/residuo'
import { ConferenciaOs } from './ConferenciaOs'
import { CorrigirTextos } from './CorrigirTextos'
import { EditarOs } from './EditarOs'
import { EscopoAgua } from './EscopoAgua'
import { EscopoReservatorio } from './EscopoReservatorio'
import { EscopoAreasAtendidas } from './EscopoAreas'
import { EscopoProdutosProgramados } from './ProdutosProgramados'
import { EscopoArCondicionado } from './EscopoArCondicionado'
import { EscopoBebedouro } from './EscopoBebedouro'
import { EscopoCoifa } from './EscopoCoifa'
import { EscopoPragas } from './EscopoPragas'
import type { AlvoEscopo } from './pragasApi'

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
  const cancelar = useCancelarOs(id)
  const reabrir = useReabrirOs(id)
  const [erro, setErro] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [gerandoFicha, setGerandoFicha] = useState(false)
  const [editando, setEditando] = useState(false)
  const queryClient = useQueryClient()
  const financeiro = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const conferencia = useConferencia(id, financeiro)

  if (os.isPending) return <Carregando />
  if (os.isError) return <Aviso tipo="erro">{mensagemDeErro(os.error)}</Aviso>
  if (!os.data) return <Aviso tipo="erro">OS não encontrada.</Aviso>

  const o = os.data
  const ficha = fichaDaOs(o.ficha_cliente)
  const e = o.execucao
  const ocorrencias = ocorrenciasDaOs(o)
  // No teste de treinamento o escritório só acompanha o que o técnico preencheu.
  const escritorio = PAPEIS_ESCRITORIO_OS.includes(perfil.papel) && !o.treinamento
  const antesDeComecar = o.status === 'rascunho' || o.status === 'agendada'
  // Com o OK do escritório e ainda não faturada (Financeiro > A faturar > Abrir OS).
  const podeEmitirNota =
    financeiro &&
    !o.treinamento &&
    (o.status === 'concluida' || o.status === 'conferida') &&
    !!conferencia.data?.liberada_financeiro_em &&
    !conferencia.data.lancamento_id
  const alvo: AlvoEscopo | null = o.modelo_id
    ? {
        modeloId: o.modelo_id,
        escopo: o.escopo,
        osId: o.id,
        antesDeComecar,
        emExecucao: o.status === 'em_execucao',
      }
    : null

  async function baixarPdf() {
    setErro(null)
    setGerandoPdf(true)
    // O gerador de PDF só é baixado quando alguém pede um PDF (deixa o resto do sistema leve).
    const aba = window.open('', '_blank')
    try {
      const { gerarESalvarPdfOs } = await import('./pdf/gerarPdfOs')
      const { blob } = await gerarESalvarPdfOs(o)
      void queryClient.invalidateQueries({ queryKey: ['arquivos', o.cliente_id] })
      const link = URL.createObjectURL(blob)
      if (aba) aba.location.href = link
      else window.location.href = link
    } catch (err) {
      aba?.close()
      setErro(mensagemDeErro(err))
    } finally {
      setGerandoPdf(false)
    }
  }

  async function imprimirOsFisica() {
    setErro(null)
    setGerandoFicha(true)
    const aba = window.open('', '_blank')
    try {
      const { gerarFichaCampo } = await import('./pdf/fichaCampoPdf')
      const bytes = await gerarFichaCampo(o)
      const link = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      if (aba) aba.location.href = link
      else window.location.href = link
    } catch (err) {
      aba?.close()
      setErro(mensagemDeErro(err))
    } finally {
      setGerandoFicha(false)
    }
  }

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
            {/* Financeiro: a nota já sai preenchida pela proposta e, ao registrar, a OS é faturada. */}
            {podeEmitirNota && (
              <Link to={`/financeiro/notas/nova?tipo=avulsa&os=${o.id}`}>
                <Button>
                  <Receipt className="size-5" aria-hidden />
                  Emitir nota
                </Button>
              </Link>
            )}
            {escritorio && (o.status === 'concluida' || o.status === 'conferida') && (
              <Button
                variante={podeEmitirNota ? 'secundario' : 'primario'}
                onClick={() => void baixarPdf()}
                disabled={gerandoPdf}
              >
                <FileDown className="size-5" aria-hidden />
                {gerandoPdf ? 'Gerando PDF…' : 'PDF da OS'}
              </Button>
            )}
            {/* Enquanto as equipes aprendem a OS digital: via em papel para preencher à mão. */}
            {escritorio && (o.status === 'rascunho' || osAberta(o.status)) && (
              <Button
                variante="secundario"
                onClick={() => void imprimirOsFisica()}
                disabled={gerandoFicha}
              >
                <Printer className="size-5" aria-hidden />
                {gerandoFicha ? 'Gerando…' : 'Imprimir OS física'}
              </Button>
            )}
            {PAPEIS_CERTIFICADOS.includes(perfil.papel) &&
              !o.treinamento &&
              (o.status === 'concluida' || o.status === 'conferida') && (
                <Link to={`/certificados/novo?os=${o.id}`}>
                  <Button variante="secundario">Emitir certificado</Button>
                </Link>
              )}
            {/* Serviço sem certificado: manda só a OS por e-mail (com cópia para o ADM). */}
            {PAPEIS_CERTIFICADOS.includes(perfil.papel) &&
              !o.treinamento &&
              (o.status === 'concluida' || o.status === 'conferida') && (
                <EnviarOsAoCliente os={o} />
              )}
            {escritorio && (
              <Link to={`/os/nova?cliente=${o.cliente_id}`}>
                <Button variante="secundario">Agendar próxima visita</Button>
              </Link>
            )}
            {/* O Administrador e o ADM preenchem pelo escritório (ex.: OS em papel). */}
            {(perfil.papel === 'admin' || perfil.papel === 'administrativo') &&
              osAberta(o.status) && (
                <Link to={`/os/${o.id}/executar`}>
                  <Button variante="secundario">Preencher execução</Button>
                </Link>
              )}
            {/* Antes de começar dá para trocar técnicos, data, veículo… (de última hora). */}
            {escritorio && antesDeComecar && (
              <Button variante="secundario" onClick={() => setEditando(true)}>
                <Pencil className="size-5" aria-hidden />
                Editar OS
              </Button>
            )}
            {/* Só o Administrador e o ADM principal cancelam (o operador avisa o escritório). */}
            {(perfil.papel === 'admin' ||
              (perfil.papel === 'administrativo' && podeApagar(perfil))) &&
              o.status !== 'cancelada' && (
                <Button
                  variante="fantasma"
                  onClick={() => {
                    const motivo = window
                      .prompt(
                        'Cancelar esta OS? Ela sai da lista do técnico e não pode mais ser preenchida. Motivo do cancelamento (fica registrado):',
                      )
                      ?.trim()
                    if (!motivo) return
                    void executar(() => cancelar.mutateAsync(motivo))
                  }}
                >
                  Cancelar OS
                </Button>
              )}
            {perfil.papel === 'admin' &&
              !o.treinamento &&
              (o.status === 'concluida' || o.status === 'conferida') && (
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

      {escritorio && antesDeComecar && (
        <EditarOs os={o} aberto={editando} aoFechar={() => setEditando(false)} />
      )}

      {o.treinamento && (
        <div className="mb-4">
          <Aviso tipo="info">
            OS de teste (treinamento): só para o técnico aprender. Não vai para o cliente, não gera
            PDF nem serviço realizado. Apague em Ordens de serviço → Treinamento.
          </Aviso>
        </div>
      )}

      {o.implantacao && (
        <div className="mb-4">
          <Aviso tipo="info">
            <strong>OS de implantação.</strong> O técnico cadastra em campo os pontos que instalar;
            eles já vão para a O.S salva deste local.
            {o.status === 'concluida' &&
              ' Revise os pontos no escopo abaixo (área, número, forma e tipo de isca) antes de conferir: é com eles que saem os próximos atendimentos.'}
          </Aviso>
        </div>
      )}

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
          <Linha rotulo="Veículo">{o.veiculo ? nomeVeiculo(o.veiculo) : '—'}</Linha>
          <Linha rotulo="CPF/CNPJ">
            {ficha.cpf_cnpj
              ? formatarDocumento(ficha.cpf_cnpj, ficha.cpf_cnpj.length === 11 ? 'PF' : 'PJ')
              : '—'}
          </Linha>
          <Linha rotulo="Endereço">{enderecoDaFicha(ficha) || '—'}</Linha>
          <Linha rotulo="Descrição">{o.descricao || '—'}</Linha>
          <Linha rotulo="Observações ADM">
            {o.observacoes_adm || '—'}
            {escritorio && o.modelo_id && (
              <Link
                className="mt-1 block text-sm font-semibold text-verde underline"
                to={`/os/modelos/${o.modelo_id}`}
              >
                Alterar as informações fixas das próximas OS
              </Link>
            )}
          </Linha>
          {ocorrencias.length > 0 && (
            <Linha rotulo={ocorrencias.length > 1 ? 'Ocorrências' : 'Ocorrência'}>
              <ul className="flex flex-col gap-1">
                {ocorrencias.map((oc) => (
                  <li key={oc.id} className="whitespace-pre-line">
                    {ocorrencias.length > 1 && '• '}
                    {oc.texto}
                  </li>
                ))}
              </ul>
            </Linha>
          )}
          {o.status === 'cancelada' && o.motivo_cancelamento && (
            <Aviso tipo="erro">
              Cancelada em {formatarDataHora(o.cancelada_em)}: {o.motivo_cancelamento}
            </Aviso>
          )}
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
              {o.tipo?.registra_residuo && (
                <>
                  <Linha rotulo="Quantidade sugada">
                    {quantidadeValida(residuoDoChecklist(e.checklist))
                      ? formatarM3(residuoDoChecklist(e.checklist).quantidade_m3!)
                      : '—'}
                  </Linha>
                  <Linha rotulo="Resíduo">
                    {nomeResiduo(residuoDoChecklist(e.checklist).codigo) ?? '—'}
                  </Linha>
                </>
              )}
              <Linha rotulo="Resultado">{e.resultado || '—'}</Linha>
              <Linha rotulo="Observações">{e.observacoes || '—'}</Linha>
              {ocorrencias.map((oc, i) => {
                const r = respostasDe(e.ocorrencias_resultado)[oc.id]
                return (
                  <Linha
                    key={oc.id}
                    rotulo={ocorrencias.length > 1 ? `Ocorrência ${i + 1}` : 'Ocorrência'}
                  >
                    {r ? (
                      <Etiqueta cor={r === 'sanado' ? 'verde' : 'alerta'}>
                        {NOME_RESPOSTA[r]}
                      </Etiqueta>
                    ) : (
                      'Técnico ainda não respondeu'
                    )}
                  </Linha>
                )
              })}
              <Linha rotulo="Operador">
                {e.operador_nome || '—'}{' '}
                {e.assinatura_operador_id && <Etiqueta cor="verde">Visto</Etiqueta>}
              </Linha>
              <Linha rotulo="Acompanhou">
                {e.sem_acompanhamento && 'Não houve acompanhamento'}
                {e.sem_acompanhamento && e.ninguem_para_assinar && ' · ninguém para assinar'}
                {e.sem_acompanhamento &&
                  (e.responsavel_nome || e.responsavel_setor || e.assinatura_cliente_id) &&
                  ' · recebeu: '}
                {[e.responsavel_nome, e.responsavel_setor].filter(Boolean).join(' · ') ||
                  (e.sem_acompanhamento ? '' : '—')}{' '}
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

      {escritorio && alvo && o.tipo?.formulario_os === 'pragas' && (
        <div className="mt-4">
          <EscopoPragas alvo={alvo} />
        </div>
      )}
      {escritorio && alvo && o.tipo?.formulario_os === 'coifa' && (
        <div className="mt-4">
          <EscopoCoifa alvo={alvo} />
        </div>
      )}
      {escritorio && alvo && o.tipo?.formulario_os === 'telas' && (
        <div className="mt-4">
          <EscopoCoifa alvo={alvo} entregaTelas />
        </div>
      )}
      {escritorio && alvo && o.tipo?.formulario_os === 'bebedouro' && (
        <div className="mt-4">
          <EscopoBebedouro alvo={alvo} />
        </div>
      )}
      {escritorio &&
        alvo &&
        o.tipo?.formulario_os &&
        ['pragas', 'pragas_simples'].includes(escritorio && alvo && o.tipo.formulario_os) && (
          <div className="mt-4">
            <EscopoProdutosProgramados alvo={alvo} />
          </div>
        )}
      {escritorio && alvo && o.tipo?.formulario_os === 'pragas_simples' && (
        <div className="mt-4">
          <EscopoAreasAtendidas alvo={alvo} />
        </div>
      )}
      {escritorio && alvo && o.tipo?.formulario_os === 'reservatorio' && (
        <div className="mt-4">
          <EscopoReservatorio alvo={alvo} />
        </div>
      )}
      {escritorio && alvo && o.tipo?.formulario_os === 'agua' && (
        <div className="mt-4">
          <EscopoAgua alvo={alvo} />
        </div>
      )}
      {escritorio && alvo && o.tipo?.formulario_os === 'ar_condicionado' && (
        <div className="mt-4">
          <EscopoArCondicionado alvo={alvo} />
        </div>
      )}
      {escritorio && alvo && (
        <p className="mt-2 text-sm">
          <Link className="font-semibold text-verde underline" to={`/os/modelos/${alvo.modeloId}`}>
            Abrir a O.S de contrato deste local
          </Link>
        </p>
      )}

      {escritorio && (o.status === 'concluida' || o.status === 'conferida') && (
        <CorrigirTextos os={o} />
      )}

      {escritorio && (
        <div className="mt-4">
          <ConferenciaOs osId={o.id} status={o.status} />
        </div>
      )}

      <Card className="mt-4">
        <h2 className="mb-3 font-titulo text-lg font-bold text-verde-escuro">
          Fotos, assinaturas e PDF
        </h2>
        {o.tipo?.fotos_antes_depois && (
          <>
            <h3 className="mb-2 font-semibold text-verde-escuro">Foto antes do serviço</h3>
            <ListaArquivos
              clienteId={o.cliente_id}
              osId={o.id}
              categoria="foto_antes"
              filtrarPorCategoria
              miniaturas
              podeEnviar={false}
              textoVazio="Nenhuma foto de antes."
            />
            <h3 className="mt-4 mb-2 font-semibold text-verde-escuro">Foto após o serviço</h3>
            <ListaArquivos
              clienteId={o.cliente_id}
              osId={o.id}
              categoria="foto_depois"
              filtrarPorCategoria
              miniaturas
              podeEnviar={false}
              textoVazio="Nenhuma foto de depois."
            />
            <h3 className="mt-4 mb-2 font-semibold text-verde-escuro">
              Outras fotos, assinaturas e PDF
            </h3>
          </>
        )}
        <ListaArquivos
          clienteId={o.cliente_id}
          osId={o.id}
          categoria="foto_os"
          miniaturas
          podeEnviar={false}
          semCategorias={o.tipo?.fotos_antes_depois ? ['foto_antes', 'foto_depois'] : undefined}
          textoVazio={o.tipo?.fotos_antes_depois ? 'Nenhum outro arquivo.' : 'Nenhuma foto ainda.'}
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
