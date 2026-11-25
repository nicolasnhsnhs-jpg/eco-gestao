/**
 * Trocas comuns nos textos do pessoal de campo. O corretor do celular sublinha palavra
 * que não existe, mas não pega palavra certa no lugar errado ("bloco deteriorado pela
 * humildade"): essas ficam aqui, com a sugestão. Só palavras inteiras, sem diferenciar
 * maiúsculas nem acentos digitados a mais ou a menos.
 */
const TROCAS: Record<string, string> = {
  // Palavra que existe, mas não é a que se quis dizer
  humildade: 'umidade',
  humido: 'úmido',
  humida: 'úmida',
  humidade: 'umidade',
  concerto: 'conserto',
  concertado: 'consertado',
  concertar: 'consertar',
  // Erros frequentes de grafia
  dedetisacao: 'dedetização',
  dedetisado: 'dedetizado',
  dedetisada: 'dedetizada',
  dedetizacao: 'dedetização',
  desratisacao: 'desratização',
  desratizacao: 'desratização',
  descupinisacao: 'descupinização',
  infestasao: 'infestação',
  infestacao: 'infestação',
  excesao: 'exceção',
  excessao: 'exceção',
  presisa: 'precisa',
  presiza: 'precisa',
  concerteza: 'com certeza',
  derrepente: 'de repente',
  apartir: 'a partir',
  reservatorio: 'reservatório',
  higienisacao: 'higienização',
  higienizacao: 'higienização',
  manutencao: 'manutenção',
  manutensao: 'manutenção',
  aplicacao: 'aplicação',
  aplicasao: 'aplicação',
  orientacao: 'orientação',
  observacao: 'observação',
  nao: 'não',
  tambem: 'também',
  ja: 'já',
  sao: 'são',
}

/** Tira acentos e deixa minúsculo, para comparar com a lista. */
const normalizar = (palavra: string) =>
  palavra
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export type AvisoOrtografia = { escrito: string; sugestao: string }

/**
 * As trocas encontradas no texto, sem repetir: [{ escrito: "humildade", sugestao: "umidade" }].
 * Palavra sem acento só é avisada quando foi escrita sem o acento mesmo ("nao", não "não").
 */
export function avisosOrtografia(texto: string | null | undefined): AvisoOrtografia[] {
  if (!texto) return []
  const vistos = new Set<string>()
  const avisos: AvisoOrtografia[] = []
  for (const palavra of texto.match(/[\p{L}]+/gu) ?? []) {
    const chave = normalizar(palavra)
    const sugestao = TROCAS[chave]
    if (!sugestao || vistos.has(chave)) continue
    // Quando a correção é só o acento ("nao" → "não"), quem já escreveu com acento acertou.
    if (normalizar(sugestao) === chave && palavra.toLowerCase() !== chave) continue
    vistos.add(chave)
    avisos.push({ escrito: palavra, sugestao })
  }
  return avisos
}
