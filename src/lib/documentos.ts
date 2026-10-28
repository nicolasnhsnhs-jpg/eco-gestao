/**
 * CPF, CNPJ, telefone e CEP: limpeza, validação e formatação.
 * As mesmas validações de CPF/CNPJ existem no banco; aqui elas servem para avisar
 * o erro na hora, antes de salvar.
 */

export function soNumeros(texto: string): string {
  return texto.replace(/\D/g, '')
}

/** Remove pontuação e deixa letras maiúsculas (o CNPJ novo pode ter letras). */
export function limparDocumento(texto: string): string {
  return texto.replace(/[^0-9a-z]/gi, '').toUpperCase()
}

export function cpfValido(valor: string): boolean {
  const cpf = soNumeros(valor)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const d = [...cpf].map(Number)
  const digito = (ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += d[i] * (ate + 1 - i)
    return ((soma * 10) % 11) % 10
  }
  return digito(9) === d[9] && digito(10) === d[10]
}

/**
 * Aceita o CNPJ numérico e o alfanumérico (letras nas 12 primeiras posições),
 * usado pela Receita Federal a partir de julho de 2026.
 * Cada caractere vale (código ASCII − 48): '0'..'9' = 0..9, 'A' = 17, 'B' = 18…
 */
export function cnpjValido(valor: string): boolean {
  const cnpj = limparDocumento(valor)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false

  const v = [...cnpj].map((c) => c.charCodeAt(0) - 48)
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const digito = (ate: number) => {
    const p = pesos.slice(13 - ate)
    const soma = v.slice(0, ate).reduce((total, valorChar, i) => total + valorChar * p[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito(12) === v[12] && digito(13) === v[13]
}

export function formatarCpf(valor: string): string {
  const n = soNumeros(valor).slice(0, 11)
  return n
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function formatarCnpj(valor: string): string {
  const n = limparDocumento(valor).slice(0, 14)
  return n
    .replace(/^(\w{2})(\w)/, '$1.$2')
    .replace(/^(\w{2})\.(\w{3})(\w)/, '$1.$2.$3')
    .replace(/\.(\w{3})(\w)/, '.$1/$2')
    .replace(/(\w{4})(\d)/, '$1-$2')
}

export function formatarDocumento(valor: string | null | undefined, tipo: 'PF' | 'PJ'): string {
  if (!valor) return ''
  return tipo === 'PF' ? formatarCpf(valor) : formatarCnpj(valor)
}

/** (48) 99999-9999 ou (48) 3333-3333 */
export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return ''
  const n = soNumeros(valor).slice(0, 11)
  if (n.length <= 2) return n
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

export function telefoneValido(valor: string): boolean {
  return /^\d{10,11}$/.test(soNumeros(valor))
}

export function formatarCep(valor: string | null | undefined): string {
  if (!valor) return ''
  const n = soNumeros(valor).slice(0, 8)
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n
}

/** Link para abrir uma conversa no WhatsApp (o número precisa do código do Brasil). */
export function linkWhatsapp(telefone: string): string {
  return `https://wa.me/55${soNumeros(telefone)}`
}

export type EnderecoViaCep = {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

/** Busca o endereço pelo CEP no ViaCEP (serviço gratuito). Retorna null se não achar. */
export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const n = soNumeros(cep)
  if (n.length !== 8) return null
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${n}/json/`)
    if (!resposta.ok) return null
    const dados = await resposta.json()
    if (dados.erro) return null
    return {
      logradouro: dados.logradouro ?? '',
      bairro: dados.bairro ?? '',
      cidade: dados.localidade ?? '',
      uf: dados.uf ?? '',
    }
  } catch {
    return null
  }
}
