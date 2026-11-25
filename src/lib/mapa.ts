/**
 * Endereço para o GPS (Google Maps / Waze). Antes ia "rua · complemento · bairro ·
 * cidade/UF", sem CEP: com o complemento ("Galpão 2", "Sala 3") e o separador "·"
 * o Maps às vezes achava outra rua com o mesmo nome. Agora vai no formato que ele
 * entende melhor, com o CEP e sem o complemento.
 */
export type EnderecoMapa = {
  logradouro: string
  numero?: string | null
  bairro?: string | null
  cidade: string
  uf: string
  cep?: string | null
}

function cepFormatado(cep: string | null | undefined) {
  const d = (cep ?? '').replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : ''
}

/** "Rua X, 123 - Centro, Gravataí - RS, 94000-000, Brasil" */
export function enderecoParaMapa(e: EnderecoMapa) {
  // Endereço vindo da Receita às vezes já traz o número na rua ("RODOVIA RSC-453 2780
  // QUILOMETRO 3,5"): não repete o número.
  const numero = e.numero?.trim()
  const digitos = (numero ?? '').replace(/\D/g, '')
  const jaTemNumero = digitos !== '' && new RegExp(`(^|\\D)${digitos}(\\D|$)`).test(e.logradouro)
  const rua = [e.logradouro.trim(), jaTemNumero ? null : numero].filter(Boolean).join(', ')
  const ruaBairro = [rua, e.bairro?.trim()].filter(Boolean).join(' - ')
  const cidade = [e.cidade.trim(), e.uf.trim()].filter(Boolean).join(' - ')
  return [ruaBairro, cidade, cepFormatado(e.cep), 'Brasil'].filter(Boolean).join(', ')
}

/** Abre o Maps já com a rota até o endereço (no celular, abre o app de GPS). */
export const linkRotaMapa = (e: EnderecoMapa) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(enderecoParaMapa(e))}`

/**
 * Toque no endereço da O.S: abre o GPS que o técnico usa. No Android, o link "geo:"
 * abre o app de mapas padrão dele (ou pergunta: Maps, Waze…); no iPhone e no
 * computador, a rota do Google Maps (abre o app, se tiver).
 */
export function linkGps(e: EnderecoMapa, agente = globalThis.navigator?.userAgent ?? '') {
  if (/android/i.test(agente)) return `geo:0,0?q=${encodeURIComponent(enderecoParaMapa(e))}`
  return linkRotaMapa(e)
}

/** Abre o Maps mostrando o endereço. */
export const linkMapa = (e: EnderecoMapa) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoParaMapa(e))}`
