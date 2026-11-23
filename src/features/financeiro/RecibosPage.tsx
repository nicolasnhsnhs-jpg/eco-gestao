import { Ban, FileDown, Pencil, Plus, Receipt, RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { formatarCnpj, formatarCpf, formatarDocumento, soNumeros } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useSituacaoAssinaturaDigital } from '../certificados/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { numeroRecibo } from './gerarPdfRecibo'
import {
  documentoDoCliente,
  useCancelarRecibo,
  useRecibos,
  useSalvarRecibo,
  type Recibo,
} from './recibosApi'

/** Atalhos para o "referente a" mais comum. */
const SUGESTOES = ['Taxa de deslocamento', 'Visita técnica', 'Serviço de ']
const FORMAS = [
  'PIX',
  'Dinheiro',
  'Transferência bancária',
  'Cartão de crédito',
  'Cartão de débito',
  'Boleto',
]

/**
 * Recibos: para o que não tem nota fiscal (uma taxa de deslocamento, por exemplo).
 * Preenche quem pagou, o que foi e o valor; o PDF sai com os dados da empresa.
 */
export function RecibosPage() {
  const recibos = useRecibos()
  const [editando, setEditando] = useState<Recibo | 'novo' | null>(null)
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const lista = (recibos.data ?? []).filter(
    (r) => !termo || `${r.numero} ${r.pagador_nome} ${r.descricao}`.toLowerCase().includes(termo),
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Recibos</h1>
        <Button onClick={() => setEditando('novo')}>
          <Plus className="size-5" aria-hidden /> Criar recibo
        </Button>
      </div>
      <p className="mb-4 text-sm text-texto-suave">
        Para o que não dá para emitir nota fiscal, como uma taxa de deslocamento. O PDF sai com o
        nome, o CNPJ e o endereço da empresa.
      </p>

      <Input
        type="search"
        placeholder="Buscar por número, nome ou descrição"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-4"
      />

      {recibos.isError && <Aviso tipo="erro">{mensagemDeErro(recibos.error)}</Aviso>}
      {recibos.isPending && <Carregando />}
      {recibos.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          {termo ? 'Nenhum recibo encontrado.' : 'Nenhum recibo ainda.'}
        </Card>
      )}

      {lista.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-borda">
            {lista.map((r) => (
              <LinhaRecibo key={r.id} r={r} aoEditar={() => setEditando(r)} />
            ))}
          </ul>
        </Card>
      )}

      <Modal
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={
          editando && editando !== 'novo'
            ? `Recibo nº ${numeroRecibo(editando.numero)}`
            : 'Criar recibo'
        }
      >
        {editando !== null && (
          <FormRecibo
            key={editando === 'novo' ? 'novo' : editando.id}
            recibo={editando === 'novo' ? null : editando}
            aoSalvar={(r, aba) => {
              setEditando(null)
              abrirPdf(r, false, aba).catch(() => aba?.close())
            }}
          />
        )}
      </Modal>
    </>
  )
}

/**
 * Gera o PDF e abre numa aba nova (ou baixa). A aba é aberta antes de gerar, ainda no
 * clique, senão o navegador a bloqueia como pop-up.
 */
async function abrirPdf(r: Recibo, baixar = false, abaJaAberta?: Window | null) {
  const aba = baixar ? null : (abaJaAberta ?? window.open('', '_blank'))
  try {
    const [{ gerarPdfRecibo }, { assinarPdfRecibo }] = await Promise.all([
      import('./gerarPdfRecibo'),
      import('../certificados/api'),
    ])
    // Com assinatura digital (e não cancelado), o PDF vai ao servidor e volta assinado.
    const digital = r.assinatura_digital && !r.cancelado
    const montado = await gerarPdfRecibo({
      numero: r.numero,
      data: r.data,
      pagadorNome: r.pagador_nome,
      pagadorDocumento: r.pagador_documento,
      descricao: r.descricao,
      valor: Number(r.valor),
      formaPagamento: r.forma_pagamento,
      observacoes: r.observacoes,
      cancelado: r.cancelado,
      assinaturaDigital: digital,
    })
    const blob = digital ? await assinarPdfRecibo(r.id, montado) : montado
    const link = URL.createObjectURL(blob)
    if (baixar) {
      const a = document.createElement('a')
      a.href = link
      a.download = `Recibo ${numeroRecibo(r.numero)} - ${r.pagador_nome}.pdf`.replace(
        /[\\/:*?"<>|]/g,
        '-',
      )
      a.click()
    } else if (aba) aba.location.href = link
    else window.location.href = link
  } catch (e) {
    aba?.close()
    throw e
  }
}

function LinhaRecibo({ r, aoEditar }: { r: Recibo; aoEditar: () => void }) {
  const cancelar = useCancelarRecibo()
  const [erro, setErro] = useState<string | null>(null)

  function aoCancelar() {
    const msg = r.cancelado
      ? 'Desfazer o cancelamento deste recibo?'
      : 'Cancelar este recibo? Ele continua na lista, marcado como cancelado.'
    if (!window.confirm(msg)) return
    cancelar.mutate({ id: r.id, cancelado: !r.cancelado })
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          Nº {numeroRecibo(r.numero)} · {r.pagador_nome}
          {r.cancelado && (
            <span className="ml-2">
              <Etiqueta cor="perigo">Cancelado</Etiqueta>
            </span>
          )}
          {r.assinatura_digital && !r.cancelado && (
            <span className="ml-2">
              <Etiqueta cor="verde">Assinado digitalmente</Etiqueta>
            </span>
          )}
        </p>
        <p className="truncate text-sm text-texto-suave">
          {formatarData(r.data)} · {r.descricao}
          {r.forma_pagamento && ` · ${r.forma_pagamento}`}
        </p>
        {(erro || cancelar.isError) && (
          <p className="text-sm text-perigo">{erro ?? mensagemDeErro(cancelar.error)}</p>
        )}
      </div>
      <span className={r.cancelado ? 'font-bold text-texto-suave line-through' : 'font-bold'}>
        {formatarReais(r.valor)}
      </span>
      <div className="flex gap-1">
        <Button
          variante="secundario"
          onClick={() => abrirPdf(r).catch((e) => setErro(mensagemDeErro(e)))}
          aria-label="Abrir PDF"
          title="Abrir PDF"
        >
          <Receipt className="size-4" aria-hidden /> PDF
        </Button>
        <Button
          variante="fantasma"
          onClick={() => abrirPdf(r, true).catch((e) => setErro(mensagemDeErro(e)))}
          aria-label="Baixar PDF"
          title="Baixar PDF"
        >
          <FileDown className="size-4" aria-hidden />
        </Button>
        {!r.cancelado && (
          <Button variante="fantasma" onClick={aoEditar} aria-label="Editar" title="Editar">
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
        <Button
          variante="fantasma"
          onClick={aoCancelar}
          disabled={cancelar.isPending}
          aria-label={r.cancelado ? 'Desfazer cancelamento' : 'Cancelar recibo'}
          title={r.cancelado ? 'Desfazer cancelamento' : 'Cancelar recibo'}
        >
          {r.cancelado ? (
            <RotateCcw className="size-4" aria-hidden />
          ) : (
            <Ban className="size-4 text-perigo" aria-hidden />
          )}
        </Button>
      </div>
    </li>
  )
}

function mascaraDocumento(texto: string) {
  const n = soNumeros(texto)
  return n.length > 11 ? formatarCnpj(n) : formatarCpf(n)
}

function FormRecibo({
  recibo,
  aoSalvar,
}: {
  recibo: Recibo | null
  aoSalvar: (r: Recibo, aba: Window | null) => void
}) {
  const salvar = useSalvarRecibo()
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(
    recibo?.cliente_id ? { id: recibo.cliente_id, nome: recibo.pagador_nome } : null,
  )
  const [nome, setNome] = useState(recibo?.pagador_nome ?? '')
  const [documento, setDocumento] = useState(recibo?.pagador_documento ?? '')
  const [descricao, setDescricao] = useState(recibo?.descricao ?? '')
  const [valor, setValor] = useState(valorParaCampo(recibo ? Number(recibo.valor) : null))
  const [data, setData] = useState(recibo?.data ?? hojeISO())
  const [forma, setForma] = useState(recibo?.forma_pagamento ?? '')
  const [observacoes, setObservacoes] = useState(recibo?.observacoes ?? '')
  const [digital, setDigital] = useState(recibo?.assinatura_digital ?? false)
  const situacaoDigital = useSituacaoAssinaturaDigital()
  const [erros, setErros] = useState<Record<string, string>>({})

  async function escolherCliente(c: ClienteEscolhido | null) {
    setCliente(c)
    if (!c) return
    setNome(c.nome)
    try {
      const dados = await documentoDoCliente(c.id)
      if (dados) {
        setNome(dados.nome || c.nome)
        setDocumento(formatarDocumento(dados.cpf_cnpj, dados.tipo_pessoa))
      }
    } catch {
      // Sem o documento, a pessoa digita.
    }
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    const v = lerValor(valor)
    const novos: Record<string, string> = {}
    if (nome.trim().length < 2) novos.nome = 'Digite o nome de quem pagou.'
    if (descricao.trim().length < 2) novos.descricao = 'Diga a que se refere o pagamento.'
    if (!v || v <= 0) novos.valor = 'Digite o valor.'
    if (!data) novos.data = 'Escolha a data.'
    setErros(novos)
    if (Object.keys(novos).length || !v) return
    const aba = window.open('', '_blank')
    salvar.mutate(
      {
        id: recibo?.id,
        dados: {
          data,
          cliente_id: cliente?.id ?? null,
          pagador_nome: nome.trim(),
          pagador_documento: documento.trim() || null,
          descricao: descricao.trim(),
          valor: v,
          forma_pagamento: forma || null,
          observacoes: observacoes.trim() || null,
          assinatura_digital: digital,
        },
      },
      { onSuccess: (r) => aoSalvar(r, aba), onError: () => aba?.close() },
    )
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
      <Campo
        rotulo="Cliente do cadastro"
        htmlFor="recibo-cliente"
        dica="Opcional: já preenche o nome e o CPF/CNPJ."
      >
        <ClienteSeletor id="recibo-cliente" valor={cliente} aoMudar={escolherCliente} />
      </Campo>

      <Campo rotulo="Recebemos de" htmlFor="recibo-nome" obrigatorio erro={erros.nome}>
        <Input
          id="recibo-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={!!erros.nome}
          maxLength={200}
        />
      </Campo>

      <Campo rotulo="CPF ou CNPJ" htmlFor="recibo-doc">
        <Input
          id="recibo-doc"
          inputMode="numeric"
          value={documento}
          onChange={(e) => setDocumento(mascaraDocumento(e.target.value))}
        />
      </Campo>

      <Campo rotulo="Referente a" htmlFor="recibo-descricao" obrigatorio erro={erros.descricao}>
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setDescricao(s)
                document.getElementById('recibo-descricao')?.focus()
              }}
              className="rounded-full border border-borda px-3 py-1 text-sm font-semibold text-verde-escuro hover:bg-lima-claro"
            >
              {s.trim()}
            </button>
          ))}
        </div>
        <Textarea
          id="recibo-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          aria-invalid={!!erros.descricao}
          placeholder="Ex.: Taxa de deslocamento para visita técnica no dia 20/11"
          maxLength={2000}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Valor (R$)" htmlFor="recibo-valor" obrigatorio erro={erros.valor}>
          <Input
            id="recibo-valor"
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(mascaraValor(e.target.value))}
            aria-invalid={!!erros.valor}
            placeholder="0,00"
          />
        </Campo>
        <Campo rotulo="Data" htmlFor="recibo-data" obrigatorio erro={erros.data}>
          <Input
            id="recibo-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </Campo>
      </div>

      <Campo rotulo="Forma de pagamento" htmlFor="recibo-forma">
        <Select id="recibo-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
          <option value="">Não informar</option>
          {FORMAS.map((f) => (
            <option key={f}>{f}</option>
          ))}
          {forma && !FORMAS.includes(forma) && <option>{forma}</option>}
        </Select>
      </Campo>

      <Campo rotulo="Observação no recibo" htmlFor="recibo-obs">
        <Textarea
          id="recibo-obs"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          maxLength={500}
          className="min-h-16"
        />
      </Campo>

      <AssinaturaDigital situacao={situacaoDigital} marcada={digital} aoMudar={setDigital} />

      {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}

      <Button type="submit" disabled={salvar.isPending}>
        {salvar.isPending ? 'Salvando…' : recibo ? 'Salvar e abrir o PDF' : 'Criar e abrir o PDF'}
      </Button>
    </form>
  )
}

/**
 * Opção de sair com a assinatura digital (certificado A1 ICP-Brasil, o mesmo da NFS-e e
 * dos certificados de serviço). Sem o certificado cadastrado na unidade, fica desligada.
 */
function AssinaturaDigital({
  situacao,
  marcada,
  aoMudar,
}: {
  situacao: ReturnType<typeof useSituacaoAssinaturaDigital>
  marcada: boolean
  aoMudar: (v: boolean) => void
}) {
  const s = situacao.data
  const pronta = !!s?.configurado && !s.vencido
  const explicacao = situacao.isPending
    ? 'Conferindo o certificado digital…'
    : situacao.error
      ? mensagemDeErro(situacao.error)
      : !s?.configurado
        ? 'O certificado digital desta unidade ainda não foi cadastrado. O recibo sai com a linha para assinar à mão.'
        : s.vencido
          ? `O certificado digital de ${s.titular} venceu em ${formatarData(s.validoAte.slice(0, 10))}. Cadastre o novo para voltar a assinar.`
          : `O PDF sai assinado por ${s.titular} (certificado válido até ${formatarData(s.validoAte.slice(0, 10))}).`
  return (
    <label
      className={cn(
        'flex gap-3 rounded-xl border border-borda p-3',
        'has-checked:border-verde has-checked:bg-lima-claro',
        pronta || marcada ? 'cursor-pointer' : 'opacity-70',
      )}
    >
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0"
        // Desmarcar sempre pode; marcar, só com o certificado em dia.
        disabled={!pronta && !marcada}
        checked={marcada}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">Assinatura digital (certificado ICP-Brasil)</span>
        <span className="text-sm text-texto-suave">{explicacao}</span>
      </span>
    </label>
  )
}
