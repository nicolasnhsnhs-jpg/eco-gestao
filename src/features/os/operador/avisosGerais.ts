import { fichaDaOs, osAberta, type OsResumo } from '../api'

/*
 * Aviso geral do Início do operador: tudo o que o escritório pediu nas OS que ele
 * ainda vai fazer (observações do ADM e ocorrências abertas), um bloco por OS,
 * no formato "Cliente: observações".
 */

export type AvisoDaOs = {
  osId: string
  cliente: string
  servico: string
  data: string
  observacoes: string | null
  ocorrencias: string[]
}

type OsComAvisos = Pick<
  OsResumo,
  'id' | 'status' | 'ficha_cliente' | 'data_agendada' | 'observacoes_adm' | 'tipo' | 'ocorrencias'
>

export function avisosDasOs(lista: OsComAvisos[]): AvisoDaOs[] {
  return lista.flatMap((os) => {
    if (!osAberta(os.status)) return []
    const observacoes = os.observacoes_adm?.trim() || null
    const ocorrencias = (os.ocorrencias ?? [])
      .flatMap((l) => (l.ocorrencia && !l.ocorrencia.sanada_em ? [l.ocorrencia] : []))
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .map((o) => o.texto.trim())
      .filter(Boolean)
    if (!observacoes && ocorrencias.length === 0) return []
    const ficha = fichaDaOs(os.ficha_cliente)
    const cliente = [ficha.nome_fantasia || ficha.nome, ficha.unidade?.apelido]
      .filter(Boolean)
      .join(' · ')
    return [
      {
        osId: os.id,
        cliente: cliente || 'Cliente',
        servico: os.tipo?.nome ?? '',
        data: os.data_agendada,
        observacoes,
        ocorrencias,
      },
    ]
  })
}

/**
 * Uma chave por aviso (OS + texto): a caixa só abre sozinha de novo quando
 * aparece uma que o operador ainda não viu (uma OS concluída saindo não conta).
 */
export function chavesDosAvisos(avisos: AvisoDaOs[]): string[] {
  return avisos.map((a) => JSON.stringify([a.osId, a.observacoes, a.ocorrencias]))
}

export function temAvisoNovo(avisos: AvisoDaOs[], vistos: readonly string[]): boolean {
  const jaVistos = new Set(vistos)
  return chavesDosAvisos(avisos).some((c) => !jaVistos.has(c))
}
