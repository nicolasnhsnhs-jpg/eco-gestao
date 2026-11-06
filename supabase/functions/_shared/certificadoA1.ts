// Leitura de um certificado A1 ICP-Brasil (arquivo .pfx em base64, guardado nos
// segredos do projeto). Usado pela NFS-e (certificado da empresa) e pela assinatura
// digital dos certificados de serviço (certificado da responsável técnica).

// @ts-types="npm:@types/node-forge@1.3.11"
import forge from 'npm:node-forge@1.3.1'

export type Certificado = {
  /** Certificado (e a cadeia, se veio no .pfx) em PEM, para a conexão. */
  certPem: string
  /** Chave privada em PKCS#8 PEM, para a conexão. */
  chavePem: string
  /** Certificado do titular em base64 (DER), que vai dentro da assinatura. */
  certBase64: string
  chave: forge.pki.rsa.PrivateKey
  titular: string
  /** CNPJ do titular, quando o certificado é de pessoa jurídica (ICP-Brasil). */
  cnpj: string | null
  validoAte: Date
  /** O certificado do titular e os da cadeia (para assinaturas CMS/PDF). */
  cert: forge.pki.Certificate
  cadeia: forge.pki.Certificate[]
}

function bolsas(p12: forge.pkcs12.Pkcs12Pfx, tipo: string) {
  return p12.getBags({ bagType: tipo })[tipo] ?? []
}

/** Tamanho total que o próprio .pfx diz ter (cabeçalho DER da SEQUENCE de fora). */
function tamanhoDeclarado(der: string): number {
  if (der.charCodeAt(0) !== 0x30 || der.length < 2) return -1
  const b = der.charCodeAt(1)
  if (b < 0x80) return 2 + b
  const n = b & 0x7f
  if (n === 0) return der.length // comprimento indefinido (BER): não dá para conferir
  let tamanho = 0
  for (let i = 0; i < n; i++) tamanho = tamanho * 256 + der.charCodeAt(2 + i)
  return 2 + n + tamanho
}

/** Tira o que costuma vir junto ao colar: espaços, quebras de linha e aspas em volta. */
const semAspas = (v: string) => v.trim().replace(/^(["'])([\s\S]*)\1$/, '$2')

/** Nomes dos segredos onde o .pfx e a senha ficam (só para as mensagens de erro). */
export type Segredos = { arquivo: string; senha: string }

export function lerCertificado(
  pfxBase64: string,
  senha: string,
  segredos: Segredos = { arquivo: 'NFSE_CERTIFICADO', senha: 'NFSE_SENHA' },
): Certificado {
  const b64 = semAspas(pfxBase64).replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length < 1000) {
    throw new Error(
      `O segredo ${segredos.arquivo} não parece o .pfx em base64 (${b64.length} caracteres). Copie de novo com o comando do PowerShell e cole sem nada a mais.`,
    )
  }
  const der = forge.util.decode64(b64)
  if (tamanhoDeclarado(der) !== der.length) {
    throw new Error(
      `O segredo ${segredos.arquivo} está incompleto (o texto foi colado pela metade). Copie de novo com o comando do PowerShell.`,
    )
  }
  let asn1: forge.asn1.Asn1
  try {
    asn1 = forge.asn1.fromDer(der, false)
  } catch {
    throw new Error(
      `O segredo ${segredos.arquivo} está incompleto ou não é um .pfx. Copie de novo com o comando do PowerShell.`,
    )
  }

  // A senha como foi salva e, se não abrir, sem espaços/aspas sobrando nas pontas.
  const senhas = [...new Set([senha, semAspas(senha)])]
  let p12: forge.pkcs12.Pkcs12Pfx | null = null
  let erro = ''
  for (const s of senhas) {
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, s)
      break
    } catch (e) {
      erro = (e as Error).message ?? String(e)
    }
  }
  if (!p12) {
    if (/MAC could not be verified|Invalid password/i.test(erro)) {
      throw new Error(
        `A senha do certificado (segredo ${segredos.senha}) não confere com o arquivo. Confira maiúsculas, minúsculas e espaços.`,
      )
    }
    throw new Error(`Não foi possível abrir o certificado: ${erro}`)
  }

  const chaves = [
    ...bolsas(p12, forge.pki.oids.pkcs8ShroudedKeyBag),
    ...bolsas(p12, forge.pki.oids.keyBag),
  ]
  const chave = chaves[0]?.key as forge.pki.rsa.PrivateKey | undefined
  if (!chave) throw new Error('O certificado não tem a chave privada.')

  const certs = bolsas(p12, forge.pki.oids.certBag)
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c)
  // O do titular é o que casa com a chave privada; os outros são da cadeia.
  const doTitular = certs.find((c) => (c.publicKey as forge.pki.rsa.PublicKey).n.equals(chave.n))
  if (!doTitular) throw new Error('O certificado do titular não está no arquivo.')
  const cadeia = certs.filter((c) => c !== doTitular)

  const titular = String(doTitular.subject.getField('CN')?.value ?? '')
  // ICP-Brasil e-CNPJ: "RAZÃO SOCIAL:12345678000199" no CN.
  const cnpj = titular.match(/:(\d{14})$/)?.[1] ?? null

  return {
    certPem: [doTitular, ...cadeia].map((c) => forge.pki.certificateToPem(c)).join(''),
    chavePem: forge.pki.privateKeyInfoToPem(
      forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(chave)),
    ),
    certBase64: forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(doTitular)).getBytes(),
    ),
    chave,
    titular,
    cnpj,
    validoAte: doTitular.validity.notAfter,
    cert: doTitular,
    cadeia,
  }
}
