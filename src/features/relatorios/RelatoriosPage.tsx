import { FileDown, FileText, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'

import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'

import { buscarOsParaRelatorio, useOsDoPeriodo, type OsDoPeriodo } from './api'
import { montarRelatorio, type RelatorioMensal } from './montarRelatorio'

/** Formulários que contam como controle de pragas (já vêm marcados). */
const DE_PRAGAS = new Set(['pragas', 'pragas_simples'])

/** "2026-09" → primeiro e último dia do mês. */
function limitesDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

/** Mês passado: normalmente o relatório é do mês que acabou. */
function mesPassado() {
  const [a, m] = hojeISO().split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * /relatorios: relatório técnico mensal para o cliente. Escolhe o cliente (nome ou
 * CNPJ), o período e as OS; o sistema escreve cada visita a partir do que o técnico
 * anotou, o ADM confere o texto e gera o PDF.
 */
export function RelatoriosPage() {
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null)
  const [mes, setMes] = useState(mesPassado)
  const [periodo, setPeriodo] = useState(() => limitesDoMes(mesPassado()))
  const [tipo, setTipo] = useState('')
  const [unidade, setUnidade] = useState('')
  // null = ainda não mexeu: vale a escolha automática (as OS de pragas).
  const [marcadas, setMarcadas] = useState<Set<string> | null>(null)
  const [relatorio, setRelatorio] = useState<RelatorioMensal | null>(null)
  const [montando, setMontando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const lista = useOsDoPeriodo(cliente?.id ?? null, periodo.de, periodo.ate)
  const todas = useMemo(() => lista.data ?? [], [lista.data])

  const tipos = useMemo(() => {
    const m = new Map<string, string>()
    for (const os of todas) m.set(os.tipoId, os.tipoNome)
    return [...m].sort((a, b) => a[1].localeCompare(b[1]))
  }, [todas])
  const unidades = useMemo(() => {
    const m = new Map<string, string>()
    for (const os of todas)
      m.set(
        os.enderecoId ?? '',
        os.unidade ||
          (os.endereco ? `${os.endereco.logradouro} · ${os.endereco.cidade}` : 'Sem endereço'),
      )
    return [...m]
  }, [todas])

  const visiveis = todas.filter(
    (os) => (!tipo || os.tipoId === tipo) && (!unidade || (os.enderecoId ?? '') === unidade),
  )
  const selecionadas =
    marcadas ?? new Set(todas.filter((os) => DE_PRAGAS.has(os.formulario)).map((os) => os.id))
  const escolhidas = visiveis.filter((os) => selecionadas.has(os.id))

  function recomecar() {
    setMarcadas(null)
    setRelatorio(null)
    setErro(null)
  }

  function mudarMes(valor: string) {
    setMes(valor)
    if (/^\d{4}-\d{2}$/.test(valor)) setPeriodo(limitesDoMes(valor))
    recomecar()
  }

  function alternar(os: OsDoPeriodo) {
    const nova = new Set(selecionadas)
    if (nova.has(os.id)) nova.delete(os.id)
    else nova.add(os.id)
    setMarcadas(nova)
    setRelatorio(null)
  }

  function marcarTodas(sim: boolean) {
    const nova = new Set(selecionadas)
    for (const os of visiveis) {
      if (sim) nova.add(os.id)
      else nova.delete(os.id)
    }
    setMarcadas(nova)
    setRelatorio(null)
  }

  async function montar() {
    setErro(null)
    setMontando(true)
    try {
      const dados = await buscarOsParaRelatorio(escolhidas.map((os) => os.id))
      setRelatorio(montarRelatorio(dados, { dataEmissao: hojeISO() }))
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setMontando(false)
    }
  }

  async function gerarPdf(baixar: boolean) {
    if (!relatorio) return
    setErro(null)
    setGerando(true)
    // A aba abre antes de gerar (senão o navegador bloqueia como pop-up).
    const aba = baixar ? null : window.open('', '_blank')
    try {
      const [{ gerarPdfRelatorio }, { baixarAssinatura }] = await Promise.all([
        import('./gerarPdfRelatorio'),
        import('../certificados/api'),
      ])
      const assinatura = await baixarAssinatura('responsavel').catch(() => null)
      const blob = await gerarPdfRelatorio(relatorio, assinatura)
      const link = URL.createObjectURL(blob)
      if (baixar) {
        const a = document.createElement('a')
        a.href = link
        a.download = `${relatorio.cliente || 'Relatório'} - ${mes}.pdf`.replace(
          /[\\/:*?"<>|]/g,
          '-',
        )
        a.click()
      } else if (aba) aba.location.href = link
      else window.location.href = link
    } catch (e) {
      aba?.close()
      setErro(mensagemDeErro(e))
    } finally {
      setGerando(false)
    }
  }

  const mudar = <K extends keyof RelatorioMensal>(campo: K, valor: RelatorioMensal[K]) =>
    setRelatorio((r) => (r ? { ...r, [campo]: valor } : r))
  const mudarVisita = (i: number, campo: 'data' | 'numero' | 'equipe' | 'texto', valor: string) =>
    setRelatorio((r) =>
      r ? { ...r, visitas: r.visitas.map((v, k) => (k === i ? { ...v, [campo]: valor } : v)) } : r,
    )
  const mudarGrafico = (campo: keyof RelatorioMensal['grafico'], valor: string) =>
    setRelatorio((r) =>
      r ? { ...r, grafico: { ...r.grafico, [campo]: Math.max(0, Number(valor) || 0) } } : r,
    )

  return (
    <>
      <PageHeader
        titulo="Relatórios"
        descricao="Relatório técnico mensal: escolha o cliente, o mês e as OS, confira o texto e gere o PDF."
      />

      {UNIDADE.relatorio.assinatura.length === 0 && (
        <div className="mb-4">
          <Aviso tipo="info">
            Nesta unidade ainda faltam o nome e o registro da responsável técnica: o PDF sai só com
            a assinatura escaneada.
          </Aviso>
        </div>
      )}

      <Card className="mb-4 flex flex-col gap-4">
        <h2 className="font-bold text-verde-escuro">1. Cliente e período</h2>
        <Campo rotulo="Cliente (nome ou CNPJ)" htmlFor="rel-cliente">
          <ClienteSeletor
            id="rel-cliente"
            valor={cliente}
            aoMudar={(c) => {
              setCliente(c)
              setTipo('')
              setUnidade('')
              recomecar()
            }}
          />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Mês" htmlFor="rel-mes">
            <Input
              id="rel-mes"
              type="month"
              value={mes}
              onChange={(e) => mudarMes(e.target.value)}
            />
          </Campo>
          <Campo rotulo="De" htmlFor="rel-de" dica="Pode puxar uma visita do fim do mês anterior.">
            <Input
              id="rel-de"
              type="date"
              value={periodo.de}
              onChange={(e) => {
                setPeriodo((p) => ({ ...p, de: e.target.value }))
                recomecar()
              }}
            />
          </Campo>
          <Campo rotulo="Até" htmlFor="rel-ate">
            <Input
              id="rel-ate"
              type="date"
              value={periodo.ate}
              onChange={(e) => {
                setPeriodo((p) => ({ ...p, ate: e.target.value }))
                recomecar()
              }}
            />
          </Campo>
        </div>
      </Card>

      {cliente && (
        <Card className="mb-4 flex flex-col gap-4">
          <h2 className="font-bold text-verde-escuro">2. Ordens de serviço do período</h2>
          {lista.isPending && <Carregando />}
          {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}
          {lista.isSuccess && todas.length === 0 && (
            <p className="text-texto-suave">Nenhuma OS concluída deste cliente no período.</p>
          )}
          {todas.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Serviço" htmlFor="rel-tipo">
                  <Select
                    id="rel-tipo"
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value)
                      setRelatorio(null)
                    }}
                  >
                    <option value="">Todos os serviços</option>
                    {tipos.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </Select>
                </Campo>
                {unidades.length > 1 && (
                  <Campo rotulo="Unidade do cliente" htmlFor="rel-unidade">
                    <Select
                      id="rel-unidade"
                      value={unidade}
                      onChange={(e) => {
                        setUnidade(e.target.value)
                        setRelatorio(null)
                      }}
                    >
                      <option value="">Todas as unidades</option>
                      {unidades.map(([id, nome]) => (
                        <option key={id} value={id}>
                          {nome}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Button variante="fantasma" onClick={() => marcarTodas(true)}>
                  Marcar todas
                </Button>
                <Button variante="fantasma" onClick={() => marcarTodas(false)}>
                  Desmarcar todas
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {visiveis.map((os) => (
                  <li key={os.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-borda p-3 hover:bg-lima-claro">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 accent-verde"
                        checked={selecionadas.has(os.id)}
                        onChange={() => alternar(os)}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold text-verde-escuro">
                          {formatarData(os.data)} · O.S. {os.numero} · {os.tipoNome}
                        </span>
                        <span className="block text-sm text-texto-suave">
                          {[os.unidade, os.equipe.join(', ')].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void montar()}
                  disabled={escolhidas.length === 0 || montando}
                >
                  <FileText className="size-5" aria-hidden />
                  {montando
                    ? 'Montando…'
                    : `Montar relatório (${escolhidas.length} ${escolhidas.length === 1 ? 'OS' : 'OS'})`}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}

      {relatorio && (
        <Card className="mb-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-verde-escuro">3. Conferir e gerar o PDF</h2>
            <Button variante="fantasma" onClick={() => void montar()} disabled={montando}>
              <RotateCcw className="size-4" aria-hidden /> Escrever de novo a partir das OS
            </Button>
          </div>
          <p className="text-sm text-texto-suave">
            Nos textos das visitas, linha que começa com “- ” vira item (•); o que vem antes do
            primeiro “:” sai em negrito.
          </p>
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Campo rotulo="Data do relatório" htmlFor="rel-emissao">
              <Input
                id="rel-emissao"
                type="date"
                value={relatorio.dataEmissao}
                onChange={(e) => mudar('dataEmissao', e.target.value || hojeISO())}
              />
            </Campo>
            <Campo rotulo="Título" htmlFor="rel-titulo">
              <Input
                id="rel-titulo"
                value={relatorio.titulo}
                onChange={(e) => mudar('titulo', e.target.value)}
              />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Cliente" htmlFor="rel-nome">
              <Input
                id="rel-nome"
                value={relatorio.cliente}
                onChange={(e) => mudar('cliente', e.target.value)}
              />
            </Campo>
            <Campo rotulo="Endereço" htmlFor="rel-endereco">
              <Input
                id="rel-endereco"
                value={relatorio.endereco}
                onChange={(e) => mudar('endereco', e.target.value)}
              />
            </Campo>
          </div>

          <h3 className="mt-2 font-semibold text-verde-escuro">Visitas</h3>
          {relatorio.visitas.map((v, i) => (
            <div key={v.osId} className="flex flex-col gap-3 rounded-xl border border-borda p-3">
              <div className="grid gap-3 sm:grid-cols-[9rem_10rem_1fr]">
                <Campo rotulo="Data" htmlFor={`v-data-${i}`}>
                  <Input
                    id={`v-data-${i}`}
                    value={v.data}
                    onChange={(e) => mudarVisita(i, 'data', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="O.S." htmlFor={`v-os-${i}`}>
                  <Input
                    id={`v-os-${i}`}
                    value={v.numero}
                    onChange={(e) => mudarVisita(i, 'numero', e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Equipe em campo" htmlFor={`v-equipe-${i}`}>
                  <Input
                    id={`v-equipe-${i}`}
                    value={v.equipe}
                    onChange={(e) => mudarVisita(i, 'equipe', e.target.value)}
                  />
                </Campo>
              </div>
              <Campo rotulo="O que foi feito" htmlFor={`v-texto-${i}`}>
                <Textarea
                  id={`v-texto-${i}`}
                  rows={Math.min(16, Math.max(4, v.texto.split('\n').length + 1))}
                  value={v.texto}
                  onChange={(e) => mudarVisita(i, 'texto', e.target.value)}
                />
              </Campo>
            </div>
          ))}

          <h3 className="mt-2 font-semibold text-verde-escuro">Gráfico dos pontos de iscagem</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['instalados', 'Instalados'],
                ['capturados', 'Capturados'],
                ['consumidas', 'Iscas consumidas'],
                ['degradadas', 'Degradadas e substituídas'],
              ] as const
            ).map(([campo, rotulo]) => (
              <Campo key={campo} rotulo={rotulo} htmlFor={`g-${campo}`}>
                <Input
                  id={`g-${campo}`}
                  type="number"
                  min={0}
                  value={relatorio.grafico[campo]}
                  onChange={(e) => mudarGrafico(campo, e.target.value)}
                />
              </Campo>
            ))}
          </div>

          <Campo
            rotulo="Produtos e registro na Anvisa"
            htmlFor="rel-produtos"
            dica="Um por linha. Registro, lote e datas vêm do cadastro de produtos dos certificados."
          >
            <Textarea
              id="rel-produtos"
              rows={Math.max(3, relatorio.produtos.split('\n').length + 1)}
              value={relatorio.produtos}
              onChange={(e) => mudar('produtos', e.target.value)}
            />
          </Campo>
          <Campo rotulo="Parecer conclusivo" htmlFor="rel-parecer">
            <Textarea
              id="rel-parecer"
              rows={4}
              value={relatorio.parecer}
              onChange={(e) => mudar('parecer', e.target.value)}
            />
          </Campo>
          <Campo rotulo="Considerações finais" htmlFor="rel-consideracoes">
            <Textarea
              id="rel-consideracoes"
              rows={4}
              value={relatorio.consideracoes}
              onChange={(e) => mudar('consideracoes', e.target.value)}
            />
          </Campo>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void gerarPdf(false)} disabled={gerando}>
              <FileText className="size-5" aria-hidden /> {gerando ? 'Gerando…' : 'Ver PDF'}
            </Button>
            <Button variante="secundario" onClick={() => void gerarPdf(true)} disabled={gerando}>
              <FileDown className="size-5" aria-hidden /> Baixar PDF
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}
