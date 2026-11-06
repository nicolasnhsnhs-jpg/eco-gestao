// Certificado A1 da empresa (arquivo .pfx), guardado nos segredos do projeto:
//   NFSE_CERTIFICADO  o .pfx em base64 (uma linha só)
//   NFSE_SENHA        a senha do .pfx
// Serve para assinar a DPS e para a conexão com a Sefin Nacional (mTLS).

// @ts-types="npm:@types/node-forge@1.3.11"
import forge from 'npm:node-forge@1.3.1'

import { lerCertificado, type Certificado } from '../_shared/certificadoA1.ts'

export type { Certificado }

let emCache: Certificado | null = null

/** O certificado dos segredos do projeto (lido uma vez por instância da função). */
export function certificadoDaEmpresa(): Certificado {
  if (emCache) return emCache
  const pfx = Deno.env.get('NFSE_CERTIFICADO')
  const senha = Deno.env.get('NFSE_SENHA')
  if (!pfx || senha == null) {
    throw new Error(
      'O certificado A1 ainda não foi cadastrado nos segredos (NFSE_CERTIFICADO e NFSE_SENHA).',
    )
  }
  emCache = lerCertificado(pfx, senha)
  return emCache
}

/** RSA-SHA1 (o padrão da assinatura das notas), em base64. */
export function assinarSha1(cert: Certificado, texto: string): string {
  const md = forge.md.sha1.create()
  md.update(texto, 'utf8')
  return forge.util.encode64(cert.chave.sign(md))
}

export function sha1Base64(texto: string): string {
  const md = forge.md.sha1.create()
  md.update(texto, 'utf8')
  return forge.util.encode64(md.digest().getBytes())
}
