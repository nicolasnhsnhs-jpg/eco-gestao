// O e-mail que leva a proposta comercial ao cliente, no mesmo visual do e-mail do
// certificado (emailDocumentos.ts): cartão branco, logo, verde da Eco Ambiental.
//
// O início do texto é escrito pelo vendedor na tela (ex.: "verificamos que o certificado
// está próximo do vencimento…"); o resto (quadro da proposta e assinatura) é fixo.

export type DadosEmailProposta = {
  /** Endereço do sistema da unidade, de onde vem o logo. */
  site: string
  /** "Eco Ambiental SC" */
  empresa: string
  cliente: string
  /** "2026-0123" */
  numero: string
  /** Serviços da proposta, um por linha do quadro. */
  servicos: string[]
  /** Válida até (AAAA-MM-DD). */
  validade: string | null
  /** Unidade/endereço do serviço, quando houver. */
  local: string | null
  /** Texto escrito na tela; parágrafos separados por linha em branco. */
  mensagem: string
  vendedor: { nome: string; telefone: string | null; email: string }
}

const data = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const escapar = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const FONTE = "font-family: 'Segoe UI', Arial, sans-serif;"

export function assuntoProposta(d: DadosEmailProposta) {
  return `Proposta ${d.numero} – ${d.empresa}`
}

/** "48999998888" → "(48) 99999-8888" */
function telefone(t: string | null) {
  const n = (t ?? '').replace(/\D/g, '')
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return t ?? ''
}

function paragrafos(texto: string): string[] {
  return texto
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function linhas(d: DadosEmailProposta): [string, string][] {
  return [
    ['Proposta', d.numero],
    ...(d.servicos.length
      ? ([[d.servicos.length > 1 ? 'Serviços' : 'Serviço', d.servicos.join('\n')]] as [
          string,
          string,
        ][])
      : []),
    ...(d.local ? ([['Local', d.local]] as [string, string][]) : []),
    ...(d.validade ? ([['Válida até', data(d.validade)]] as [string, string][]) : []),
  ]
}

export function htmlProposta(d: DadosEmailProposta): string {
  const quadro = linhas(d)
    .map(
      ([rotulo, valor], i) => `
                    <tr>
                      <td style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: 14px; color: #55624f; white-space: nowrap; vertical-align: top">${escapar(rotulo)}</td>
                      <td align="right" style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: 14px; color: #1e2a1c;">${escapar(valor).replace(/\n/g, '<br />')}</td>
                    </tr>`,
    )
    .join('')

  const texto = paragrafos(d.mensagem)
    .map(
      (p) => `
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6">
                  ${escapar(p).replace(/\n/g, '<br />')}
                </p>`,
    )
    .join('')

  const contato = [
    telefone(d.vendedor.telefone),
    `<a href="mailto:${escapar(d.vendedor.email)}" style="color: #3e7b1f">${escapar(d.vendedor.email)}</a>`,
  ]
    .filter(Boolean)
    .join(' · ')

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapar(assuntoProposta(d))}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f8f1">
    <div style="display: none; max-height: 0; overflow: hidden">
      ${escapar(paragrafos(d.mensagem)[0]?.slice(0, 140) ?? `Segue em anexo a proposta ${d.numero}.`)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f8f1">
      <tr>
        <td align="center" style="padding: 32px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
            style="max-width: 560px; background-color: #ffffff; border: 1px solid #e3e9dd; border-radius: 12px">
            <tr>
              <td align="center" style="padding: 32px 32px 8px">
                <img src="${escapar(d.site)}/logo-pdf.jpg" width="180" height="79" alt="Eco Ambiental"
                  style="display: block; border: 0" />
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 0; ${FONTE} color: #1e2a1c">
                <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.3; color: #1f4d1a">
                  Sua proposta chegou 🌱
                </h1>
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6">
                  Olá${d.cliente ? `, <strong>${escapar(d.cliente)}</strong>` : ''}!
                </p>${texto}
                <p style="margin: 8px 0 24px; font-size: 16px; line-height: 1.6">Os detalhes:</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 24px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                  style="${FONTE} background-color: #f5f8f1; border: 1px solid #e3e9dd; border-radius: 8px">${quadro}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 24px; ${FONTE} color: #55624f">
                <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6">
                  📎 A proposta em PDF está anexada a este e-mail.
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6">
                  Alguma dúvida? É só responder este e-mail.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 24px; border-top: 1px solid #e3e9dd; ${FONTE} font-size: 14px; line-height: 1.6; color: #1e2a1c">
                Atenciosamente,<br />
                <strong>${escapar(d.vendedor.nome)}</strong><br />
                <span style="color: #55624f">Comercial · ${escapar(d.empresa)}</span><br />
                <span style="color: #55624f">${contato}</span>
              </td>
            </tr>
          </table>
          <p style="margin: 16px 0 0; ${FONTE} font-size: 12px; color: #55624f">
            ${escapar(d.empresa)} · Soluções ambientais
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Versão em texto puro. */
export function textoProposta(d: DadosEmailProposta): string {
  return [
    `Olá${d.cliente ? `, ${d.cliente}` : ''}!`,
    '',
    ...paragrafos(d.mensagem).flatMap((p) => [p, '']),
    ...linhas(d).map(([r, v]) => `${r}: ${v.replace(/\n/g, ', ')}`),
    '',
    'A proposta em PDF está anexada a este e-mail. Alguma dúvida? É só responder.',
    '',
    'Atenciosamente,',
    d.vendedor.nome,
    `Comercial · ${d.empresa}`,
    [telefone(d.vendedor.telefone), d.vendedor.email].filter(Boolean).join(' · '),
  ].join('\n')
}
