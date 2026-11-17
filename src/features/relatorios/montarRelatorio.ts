import { formatarData, formatarMes } from '@/lib/datas'

import type { FichaCliente } from '../os/api'
import type { InsetoOs, PontoOs, ProdutoOs } from '../os/pragasApi'
import {
  escreverFaixas,
  ESPECIES,
  NIVEIS,
  PRAGAS_INSETOS,
  PROCEDIMENTOS,
  type ChecklistPragas,
  type EscopoPragas,
} from '../os/tipos/pragas'
import { dosesMarcadas, type ChecklistProgramas, type EscopoProgramas } from '../os/tipos/programas'

/*
 * Relatório técnico mensal (modelo da Naturovos): junta as OS do mês de um cliente
 * e escreve, para cada visita, o que foi feito, a partir do que o técnico anotou.
 * O texto de cada visita sai num formato simples, que o ADM pode corrigir antes do PDF:
 *
 *   Controle de Roedores: Realizada a inspeção dos 57 pontos de monitoramento.
 *   - Pontos não encontrados: Ponto 52.
 *   - Insumos Utilizados: 20 g de Brodifacoum (Blocos).
 *
 * Linha com "- " é um item (•); as outras são parágrafos, com o que vem antes do
 * primeiro ":" em negrito.
 */

/** Produto do catálogo de certificados (registro, lote, fabricação e validade). */
export type ProdutoCatalogoRelatorio = {
  id: string
  nome_comercial: string | null
  principio_ativo: string
  registro: string | null
  lote: string | null
  fabricacao: string | null
  validade: string | null
}

/** Tudo de uma OS que o relatório usa. */
export type OsParaRelatorio = {
  id: string
  numero: string
  /** Data da execução (ou a agendada, se faltar). */
  data: string
  tipoNome: string
  formulario: string
  escopo: unknown
  checklist: unknown
  resultado: string | null
  observacoes: string | null
  equipe: string[]
  ficha: FichaCliente
  pontos: PontoOs[]
  produtos: (ProdutoOs & { produto: ProdutoCatalogoRelatorio | null })[]
  insetos: InsetoOs[]
}

export type VisitaRelatorio = {
  osId: string
  data: string
  numero: string
  equipe: string
  texto: string
}

export type GraficoRoedores = {
  instalados: number
  capturados: number
  consumidas: number
  degradadas: number
}

export type RelatorioMensal = {
  dataEmissao: string
  titulo: string
  cliente: string
  endereco: string
  objetivo: string
  condicoes: string
  visitas: VisitaRelatorio[]
  grafico: GraficoRoedores
  /** Insetos capturados nas armadilhas luminosas no período, por espécie. */
  capturasInsetos: { rotulo: string; n: number }[]
  /** Uma linha por produto: "Brodifacoum - MS 3.2699... - Lote 863/11 - Fab. … - Val. …". */
  produtos: string
  parecer: string
  consideracoes: string
}

export const TEXTO_OBJETIVO =
  'Este relatório técnico apresenta o procedimento realizado pela empresa ECO-AMBIENTAL, referente ao monitoramento e controle de pragas.'

export const TEXTO_CONDICOES =
  'As inspeções estão descritas abaixo por data da visita técnica de monitoramento ou ocorrência e número da ordem de serviço (O.S). Na referida ordem de serviço constam informações acerca dos técnicos envolvidos, tempo de realização do serviço, locais onde foram realizados os procedimentos de controle, os alvos combatidos, os produtos químicos utilizados e suas quantidades.'

export const TEXTO_PARECER =
  'Além das aplicações preventivas e curativas, recomendamos observar as áreas tratadas, mantendo uma higienização constante e com especial atenção para as medidas preventivas e corretivas a serem providenciadas quando relatadas, para que assim possamos ter um melhor resultado e controle.'

export const TEXTO_CONSIDERACOES =
  'Informações mais completas sobre o produto químico utilizado, tais como: toxicidade, modo de ação, dose letal, informações para uso médico em caso de ingestão e outras informações pertinentes, estão disponíveis na Ficha Técnica dos Produtos que fica localizado na pasta de arquivo de documentos sob os cuidados do responsável do contrato no cliente.'

/** "a, b e c" */
export function juntarComE(itens: string[]) {
  return itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

const num = (n: number) => n.toLocaleString('pt-BR')
const doisDigitos = (n: number) => String(n).padStart(2, '0')

/** "Ponto 13" ou "Pontos 12, 15, 40-45". */
export function nomearPontos(numeros: number[], singular = 'Ponto', plural = 'Pontos') {
  return numeros.length === 1
    ? `${singular} ${numeros[0]}`
    : `${plural} ${escreverFaixas(numeros).replace(/(\d+)-(\d+)/g, '$1 ao $2')}`
}

const FORMA_CURTA: Record<string, string> = {
  bloco: 'Blocos',
  semente: 'Sementes',
  granulada: 'Granulada',
  po: 'Pó',
  polvilhamento: 'Pó',
  placa: 'Placas',
  liquido: 'Pulverização',
  atomizacao: 'Atomização',
  nebulizacao: 'Nebulização',
}

/** "600 g de Brodifacoum (Blocos)", "24 unidades de Cola Atóxica". */
export function descreverInsumo(
  p: Pick<ProdutoOs, 'principio_ativo' | 'forma' | 'gramas' | 'ml' | 'unidades'>,
) {
  const nome = p.principio_ativo.trim()
  const forma = FORMA_CURTA[p.forma]
  const comForma = forma ? `${nome} (${forma})` : nome
  const partes: string[] = []
  if (p.gramas) partes.push(`${num(p.gramas)} g`)
  if (p.ml) partes.push(`${num(p.ml)} ml`)
  if (p.unidades)
    partes.push(`${doisDigitos(p.unidades)} ${p.unidades === 1 ? 'unidade' : 'unidades'}`)
  return partes.length ? `${partes.join(' e ')} de ${comForma}` : comForma
}

/** "01 ao 03 - Recebimento, 04 - Guarita" — onde fica cada ponto (na implantação). */
export function localizacaoDosPontos(pontos: Pick<PontoOs, 'numero' | 'area'>[]) {
  const ordenados = [...pontos].sort((a, b) => a.numero - b.numero)
  const grupos: { de: number; ate: number; area: string }[] = []
  for (const p of ordenados) {
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.area === p.area && p.numero === ultimo.ate + 1) ultimo.ate = p.numero
    else grupos.push({ de: p.numero, ate: p.numero, area: p.area.trim() })
  }
  return grupos
    .map((g) =>
      g.de === g.ate
        ? `${doisDigitos(g.de)} - ${g.area}`
        : g.ate === g.de + 1
          ? `${doisDigitos(g.de)} e ${doisDigitos(g.ate)} - ${g.area}`
          : `${doisDigitos(g.de)} ao ${doisDigitos(g.ate)} - ${g.area}`,
    )
    .join(', ')
}

const numerosCom = (pontos: PontoOs[], codigos: string[]) =>
  pontos.filter((p) => p.situacao && codigos.includes(p.situacao)).map((p) => p.numero)

/** Controle de roedores: implantação ou inspeção, e só as exceções em itens. */
function textoRoedores(pontos: PontoOs[], checklist: ChecklistPragas) {
  const iscas = pontos.filter((p) => p.tipo === 'porta_isca')
  if (iscas.length === 0) return [] as string[]
  const linhas: string[] = []
  const novos = numerosCom(iscas, ['IN'])
  if (novos.length === iscas.length) {
    linhas.push(
      `Controle de Roedores: Realizada a implantação de ${iscas.length} pontos de monitoramento, localizados conforme segue: ${localizacaoDosPontos(iscas)}.`,
    )
  } else if (novos.length > 0) {
    linhas.push(
      `Controle de Roedores: Realizada a inspeção dos pontos de monitoramento e a implantação de mais ${novos.length} ${novos.length === 1 ? 'ponto' : 'pontos'} (${nomearPontos(novos).replace(/^Pontos? /, '')}).`,
    )
  } else {
    linhas.push(
      `Controle de Roedores: Realizada a inspeção dos ${iscas.length} pontos de monitoramento.`,
    )
  }

  const excecoes: [string[], (n: number[]) => string][] = [
    [['MC'], (n) => `Pontos com consumo (isca mantida): ${nomearPontos(n)}.`],
    [
      ['CT'],
      (n) => `Pontos com consumo: ${nomearPontos(n)}. Foi realizada a substituição da isca.`,
    ],
    [
      ['DT'],
      (n) =>
        `Pontos degradados (deterioração natural, sem consumo): ${nomearPontos(n)}. Foi realizada a substituição da isca.`,
    ],
    [['CAP'], (n) => `Pontos com captura: ${nomearPontos(n)}.`],
    [['SC'], (n) => `Placas adesivas com captura, substituídas: ${nomearPontos(n)}.`],
    [['T'], (n) => `Placas adesivas trocadas: ${nomearPontos(n)}.`],
    [['Q'], (n) => `Dispositivos quebrados: ${nomearPontos(n)}.`],
    [['I'], (n) => `Placas adesivas inexistentes: ${nomearPontos(n)}.`],
    [['SA'], (n) => `Pontos sem acesso: ${nomearPontos(n)}.`],
    [['NE'], (n) => `Pontos não encontrados: ${nomearPontos(n)}.`],
  ]
  let algumaExcecao = false
  for (const [codigos, frase] of excecoes) {
    const n = numerosCom(iscas, codigos)
    if (n.length) {
      algumaExcecao = true
      linhas.push(`- ${frase(n)}`)
    }
  }
  if (novos.length !== iscas.length) {
    linhas.push(
      algumaExcecao
        ? '- Demais dispositivos: Não apresentavam vestígios de roedores ou degradação das iscas.'
        : '- Os dispositivos não apresentavam vestígios de roedores ou degradação das iscas.',
    )
  }
  if (checklist.sem_acesso?.trim()) linhas.push(`- Sem acesso: ${checklist.sem_acesso.trim()}`)
  if (checklist.quebrados?.trim()) linhas.push(`- Quebrados: ${checklist.quebrados.trim()}`)
  if (checklist.comentarios_roedores?.trim())
    linhas.push(`- Observações: ${checklist.comentarios_roedores.trim()}`)
  return linhas
}

/** Controle de insetos: o que foi aplicado, ou que não havia focos. */
function textoInsetos(os: OsParaRelatorio, checklist: ChecklistPragas) {
  const escopo = (os.escopo ?? {}) as EscopoPragas & EscopoProgramas
  const marcacoes = (checklist as ChecklistProgramas).programas ?? {}
  const programas = (escopo.programas ?? [])
    .map((g) => ({ g, doses: dosesMarcadas(g, marcacoes[g.id]) }))
    .filter((x) => x.doses.length > 0)
  const temInsetos = escopo.subtipo === 'insetos_roedores' || os.insetos.length > 0
  if (!temInsetos && programas.length === 0) return [] as string[]

  const linhas: string[] = []
  if (checklist.monitoramento_insetos === false && os.insetos.length === 0 && !programas.length) {
    linhas.push('Controle de Insetos: Monitoramento de insetos não realizado nesta visita.')
    return linhas
  }
  linhas.push('Controle de Insetos:')
  for (const i of os.insetos) {
    const praga = PRAGAS_INSETOS[i.praga as keyof typeof PRAGAS_INSETOS] ?? i.praga
    const nivel = i.nivel ? ` (nível ${NIVEIS[i.nivel as keyof typeof NIVEIS]?.toLowerCase()})` : ''
    const procedimento = i.procedimento
      ? PROCEDIMENTOS[i.procedimento as keyof typeof PROCEDIMENTOS]
      : 'Aplicação'
    const produto = [i.principio_ativo, i.quantidade].filter(Boolean).join(' ')
    linhas.push(
      `- ${praga} em ${i.area.trim()}${nivel}: ${procedimento}${produto ? ` com ${produto}` : ''}.`,
    )
  }
  for (const { g, doses } of programas) {
    linhas.push(
      `- ${g.titulo}${g.areas ? ` (${g.areas})` : ''}: ${doses.map((d) => d.texto).join('; ')}.`,
    )
  }
  if (os.insetos.length === 0 && programas.length === 0) {
    linhas.push('- Não foram identificados focos ou atividades de pragas no momento da vistoria.')
  }
  if (checklist.comentarios_aplicacao?.trim())
    linhas.push(`- Locais de aplicação: ${checklist.comentarios_aplicacao.trim()}`)
  return linhas
}

const capturasDe = (p: PontoOs) =>
  Object.entries((p.capturas ?? {}) as Record<string, unknown>)
    .map(([codigo, n]) => [codigo, Number(n) || 0] as const)
    .filter(([codigo, n]) => n > 0 && codigo in ESPECIES)

/** Armadilhas luminosas: refis, lâmpadas, capturas e as que não estavam funcionando. */
function textoArmadilhas(pontos: PontoOs[]) {
  const als = pontos.filter((p) => p.tipo === 'armadilha_luminosa')
  if (als.length === 0) return [] as string[]
  const linhas = ['Armadilhas Luminosas (AL):']
  const nomear = (n: number[]) => nomearPontos(n, 'AL', 'ALs')
  const refis = als.filter((a) => a.refil === 'T').map((a) => a.numero)
  if (refis.length === als.length) linhas.push('- Realizada a substituição de todos os refis.')
  else if (refis.length) linhas.push(`- Refis substituídos: ${nomear(refis)}.`)
  const lampadas = als
    .filter((a) => a.lampadas_trocadas || a.situacao_armadilha === 'LT')
    .map((a) => a.numero)
  if (lampadas.length) linhas.push(`- Lâmpadas trocadas: ${nomear(lampadas)}.`)
  const danificadas = als.filter((a) => a.situacao_armadilha === 'D').map((a) => a.numero)
  const desligadas = als.filter((a) => a.situacao_armadilha === 'DL').map((a) => a.numero)
  if (danificadas.length) linhas.push(`- Armadilhas danificadas: ${nomear(danificadas)}.`)
  if (desligadas.length) linhas.push(`- Armadilhas desligadas: ${nomear(desligadas)}.`)
  const higiene = als.filter((a) => a.higiene === 'I').map((a) => a.numero)
  if (higiene.length) linhas.push(`- Higiene insuficiente no local: ${nomear(higiene)}.`)

  const totais = new Map<string, number>()
  for (const a of als)
    for (const [codigo, n] of capturasDe(a)) totais.set(codigo, (totais.get(codigo) ?? 0) + n)
  if (totais.size) {
    const partes = [...totais].map(
      ([codigo, n]) =>
        `${num(n)} ${ESPECIES[codigo as keyof typeof ESPECIES].toLowerCase()}${n === 1 ? '' : 's'}`,
    )
    linhas.push(`- Insetos capturados: ${juntarComE(partes)}.`)
  }
  linhas.push(
    danificadas.length || desligadas.length
      ? '- Demais armadilhas em funcionamento.'
      : '- Armadilhas em funcionamento.',
  )
  return linhas
}

/** Feromônio e armadilha biológica de moscas: um resumo curto. */
function textoMonitoramento(pontos: PontoOs[]) {
  const linhas: string[] = []
  const feromonios = pontos.filter((p) => p.tipo === 'feromonio')
  if (feromonios.length) {
    linhas.push(
      `Monitoramento com feromônio: Realizada a inspeção de ${feromonios.length} ${feromonios.length === 1 ? 'armadilha' : 'armadilhas'} adesivas com feromônio e atrativo alimentar.`,
    )
    for (const f of feromonios) {
      const qtd = Number(((f.capturas ?? {}) as Record<string, unknown>).qtd) || 0
      if (qtd > 0)
        linhas.push(
          `- Armadilha ${doisDigitos(f.numero)} (${f.area.trim()}): ${num(qtd)} capturados${f.observacao?.trim() ? ` - ${f.observacao.trim()}` : ''}.`,
        )
    }
    const trocadas = feromonios.filter((f) => f.refil === 'T').map((f) => f.numero)
    if (trocadas.length)
      linhas.push(`- Armadilhas trocadas: ${nomearPontos(trocadas, 'Armadilha', 'Armadilhas')}.`)
  }
  const moscas = pontos.filter((p) => p.tipo === 'armadilha_moscas')
  if (moscas.length) {
    linhas.push(
      `Armadilhas biológicas para moscas: Realizada a inspeção de ${moscas.length} ${moscas.length === 1 ? 'armadilha' : 'armadilhas'}.`,
    )
    const trocadas = moscas.filter((m) => m.refil === 'T').map((m) => m.numero)
    if (trocadas.length)
      linhas.push(`- Refis substituídos: ${nomearPontos(trocadas, 'Armadilha', 'Armadilhas')}.`)
  }
  return linhas
}

/** Texto de uma visita (uma OS), no formato editável. */
export function textoDaVisita(os: OsParaRelatorio): string {
  const checklist = (os.checklist ?? {}) as ChecklistPragas
  const linhas: string[] = []
  const resultado = os.resultado?.trim()

  if (os.formulario === 'pragas') {
    linhas.push(...textoRoedores(os.pontos, checklist))
    // Os insumos ficam junto do controle de roedores, como no modelo.
    const insumos = os.produtos.map(descreverInsumo)
    if (insumos.length && linhas.length)
      linhas.push(`- Insumos Utilizados: ${juntarComE(insumos)}.`)
    linhas.push(...textoInsetos(os, checklist))
    linhas.push(...textoArmadilhas(os.pontos))
    linhas.push(...textoMonitoramento(os.pontos))
    if (insumos.length && !linhas.some((l) => l.startsWith('- Insumos')))
      linhas.push(`- Insumos Utilizados: ${juntarComE(insumos)}.`)
    if (resultado) linhas.push(`Observações: ${resultado}`)
  } else {
    // Desinsetização mensal e os outros serviços: o resultado escrito pelo técnico.
    linhas.push(`${os.tipoNome}: ${resultado || 'Serviço realizado.'}`)
    linhas.push(...textoArmadilhas(os.pontos))
    linhas.push(...textoMonitoramento(os.pontos))
    const insumos = os.produtos.map(descreverInsumo)
    if (insumos.length) linhas.push(`- Insumos Utilizados: ${juntarComE(insumos)}.`)
  }

  if (checklist.medidas_preventivas && checklist.medidas_descricao?.trim())
    linhas.push(`Medidas recomendadas: ${checklist.medidas_descricao.trim()}`)
  if (checklist.solicitacoes_cliente?.trim())
    linhas.push(`Solicitações do cliente: ${checklist.solicitacoes_cliente.trim()}`)
  return linhas.join('\n')
}

/** Quadro "Frequência de roedores e iscas substituídas" das OS do período. */
export function graficoRoedores(lista: OsParaRelatorio[]): GraficoRoedores {
  let instalados = 0
  let capturados = 0
  let consumidas = 0
  let degradadas = 0
  for (const os of lista) {
    const iscas = os.pontos.filter((p) => p.tipo === 'porta_isca')
    instalados = Math.max(instalados, iscas.length)
    capturados += numerosCom(iscas, ['CAP', 'SC']).length
    consumidas += numerosCom(iscas, ['MC', 'CT']).length
    degradadas += numerosCom(iscas, ['DT']).length
  }
  return { instalados, capturados, consumidas, degradadas }
}

export function capturasDoPeriodo(lista: OsParaRelatorio[]) {
  const totais = new Map<string, number>()
  for (const os of lista)
    for (const p of os.pontos.filter((x) => x.tipo === 'armadilha_luminosa'))
      for (const [codigo, n] of capturasDe(p)) totais.set(codigo, (totais.get(codigo) ?? 0) + n)
  return (Object.keys(ESPECIES) as (keyof typeof ESPECIES)[])
    .filter((c) => totais.has(c))
    .map((c) => ({ rotulo: ESPECIES[c], n: totais.get(c)! }))
}

/** "MS 3.2699.0001.002-5"; "Isento" fica como está. */
const registroMs = (r: string) => (/^\d/.test(r.trim()) ? `MS ${r.trim()}` : r.trim())

/** Relação dos produtos do período, com registro e lote (do catálogo dos certificados). */
export function relacaoProdutos(lista: OsParaRelatorio[]) {
  const linhas = new Map<string, string>()
  for (const os of lista) {
    for (const p of os.produtos) {
      const c = p.produto
      if (!c) {
        const nome = p.principio_ativo.trim()
        if (!linhas.has(`livre:${nome.toLowerCase()}`))
          linhas.set(`livre:${nome.toLowerCase()}`, nome)
        continue
      }
      if (linhas.has(c.id)) continue
      const nome = c.nome_comercial?.trim()
        ? `${c.principio_ativo.trim()} (${c.nome_comercial.trim()})`
        : c.principio_ativo.trim()
      linhas.set(
        c.id,
        [
          nome,
          c.registro?.trim() && registroMs(c.registro),
          c.lote?.trim() && `Lote ${c.lote.trim()}`,
          c.fabricacao && `Fab. ${formatarMes(c.fabricacao)}`,
          c.validade && `Val. ${formatarMes(c.validade)}`,
        ]
          .filter(Boolean)
          .join(' - '),
      )
    }
  }
  return [...linhas.values()]
}

/** Nome do cliente como no cabeçalho: "NATUROVOS SALVADOR DO SUL – FL 48". */
export function nomeDoCliente(ficha: FichaCliente) {
  const nome = (ficha.nome_fantasia || ficha.nome || ficha.razao_social || '').trim()
  const apelido = ficha.unidade?.apelido?.trim()
  return [nome, apelido].filter(Boolean).join(' – ').toUpperCase()
}

/** "Rod. BR 470, S/N – km 260,5 – São Francisco – Salvador do Sul/RS" */
export function enderecoDoCliente(ficha: FichaCliente) {
  const u = ficha.unidade
  if (!u) return ''
  return [
    [u.logradouro, u.numero || 'S/N'].filter(Boolean).join(', '),
    u.complemento,
    u.bairro,
    `${u.cidade}/${u.uf}`,
  ]
    .filter((x) => x && String(x).trim())
    .join(' – ')
}

/** Rascunho do relatório: as OS em ordem de data, com os textos já escritos. */
export function montarRelatorio(
  lista: OsParaRelatorio[],
  opcoes: { dataEmissao: string; servico?: string },
): RelatorioMensal {
  const ordenadas = [...lista].sort(
    (a, b) => a.data.localeCompare(b.data) || a.numero.localeCompare(b.numero),
  )
  const ficha = ordenadas.at(-1)?.ficha ?? {}
  return {
    dataEmissao: opcoes.dataEmissao,
    titulo: `RELATÓRIO TÉCNICO MENSAL - ${(opcoes.servico ?? 'Controle de Pragas').toUpperCase()}`,
    cliente: nomeDoCliente(ficha),
    endereco: enderecoDoCliente(ficha),
    objetivo: TEXTO_OBJETIVO,
    condicoes: TEXTO_CONDICOES,
    visitas: ordenadas.map((os) => ({
      osId: os.id,
      data: formatarData(os.data),
      numero: os.numero,
      equipe: juntarComE(os.equipe),
      texto: textoDaVisita(os),
    })),
    grafico: graficoRoedores(ordenadas),
    capturasInsetos: capturasDoPeriodo(ordenadas),
    produtos: relacaoProdutos(ordenadas).join('\n'),
    parecer: TEXTO_PARECER,
    consideracoes: TEXTO_CONSIDERACOES,
  }
}

export type LinhaTexto = { tipo: 'item' | 'paragrafo'; titulo: string; texto: string }

/** Lê o texto editável de uma visita (para o PDF e a prévia). */
export function lerTextoVisita(texto: string): LinhaTexto[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const item = /^[-•]\s*/.test(l)
      const corpo = item ? l.replace(/^[-•]\s*/, '') : l
      const doisPontos = corpo.indexOf(':')
      // Só vira título o que é curto (o rótulo antes do ":"), não uma frase inteira.
      const titulo = doisPontos > 0 && doisPontos <= 60 ? corpo.slice(0, doisPontos + 1) : ''
      return {
        tipo: item ? 'item' : 'paragrafo',
        titulo,
        texto: (titulo ? corpo.slice(titulo.length) : corpo).trim(),
      }
    })
}
