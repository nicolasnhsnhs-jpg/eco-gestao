/**
 * A linha "Execução do serviço: 02 horas / 02 operadores técnicos." dos recursos da
 * proposta, separada em tempo e operadores para a tela editar sem abrir o texto todo.
 * O que mais estiver na linha (ex.: "caminhão de auto vácuo e hidrojato") é mantido.
 */
export type Execucao = { tempo: string; operadores: number | null; resto: string[] }

const PREFIXO = /^\s*Execução do serviço:\s*/i

function linhaDaExecucao(linhas: string[]) {
  return linhas.findIndex((l) => PREFIXO.test(l))
}

export function lerExecucao(recursos: string): Execucao {
  const linhas = recursos.split('\n')
  const idx = linhaDaExecucao(linhas)
  const vazio: Execucao = { tempo: '', operadores: null, resto: [] }
  if (idx < 0) return vazio
  let conteudo = linhas[idx]
    .replace(PREFIXO, '')
    .trim()
    .replace(/[.;]\s*$/, '')
  // Coifa: "02 técnicos, tempo previsto de 03 horas"
  const coifa = /^(.*?),\s*tempo previsto de\s*(.*)$/i.exec(conteudo)
  if (coifa) conteudo = `${coifa[2]} / ${coifa[1]}`
  const r = { ...vazio, resto: [] as string[] }
  for (const parte of conteudo.split(/\s*\/\s*/).filter(Boolean)) {
    const ops = /^(\d+)\s*(operador|técnico|tecnico)/i.exec(parte)
    if (ops && r.operadores === null) r.operadores = Number(ops[1])
    else if (!r.tempo && r.operadores === null && r.resto.length === 0) r.tempo = parte
    else r.resto.push(parte)
  }
  return r
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')

export function textoOperadores(n: number) {
  return n === 1 ? '01 operador técnico' : `${doisDigitos(n)} operadores técnicos`
}

/** Reescreve (ou cria, ou tira, se tudo vazio) a linha da execução nos recursos. */
export function escreverExecucao(recursos: string, e: Execucao): string {
  const partes = [
    e.tempo.trim(),
    e.operadores && e.operadores > 0 ? textoOperadores(e.operadores) : '',
    ...e.resto,
  ].filter(Boolean)
  const linhas = recursos ? recursos.split('\n') : []
  const idx = linhaDaExecucao(linhas)
  const nova = partes.length ? `Execução do serviço: ${partes.join(' / ')}.` : null
  if (idx >= 0) {
    if (nova) linhas[idx] = nova
    else linhas.splice(idx, 1)
  } else if (nova) {
    linhas.push(nova)
  }
  return linhas.join('\n')
}
