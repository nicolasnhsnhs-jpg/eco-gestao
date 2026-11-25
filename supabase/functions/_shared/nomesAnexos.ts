/**
 * Nome dos anexos do e-mail da nota: o mesmo nome do arquivo que o financeiro anexou
 * (ex.: "BL4477.pdf"), não "Boleto NF 123.pdf". Sem nome salvo, usa o padrão.
 * Nomes repetidos ganham " (2)", " (3)"… para o cliente não receber dois iguais.
 */
export function nomesDosAnexos(
  arquivos: { nomeOriginal?: string | null; padrao: string }[],
): string[] {
  const usados = new Map<string, number>()
  return arquivos.map(({ nomeOriginal, padrao }) => {
    let nome = limparNome(nomeOriginal) || padrao
    if (!/\.pdf$/i.test(nome)) nome = `${nome}.pdf`
    const chave = nome.toLowerCase()
    const vezes = (usados.get(chave) ?? 0) + 1
    usados.set(chave, vezes)
    return vezes === 1 ? nome : nome.replace(/(\.pdf)$/i, ` (${vezes})$1`)
  })
}

/** Tira caminho e caracteres que atrapalham anexo ("C:\pasta\BL 4477.pdf" → "BL 4477.pdf"). */
function limparNome(nome: string | null | undefined): string {
  return (nome ?? '')
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f"<>|*?:]/g, '')
    .trim()
}
