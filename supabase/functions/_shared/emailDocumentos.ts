// O e-mail que leva o certificado e a ordem de serviço ao cliente, no mesmo visual do
// e-mail da nota fiscal (emailNota.ts): cartão branco, logo, verde da Eco Ambiental.

export type DadosEmailDocumentos = {
  /** Endereço do sistema da unidade, de onde vem o logo. */
  site: string
  /** "Eco Ambiental RS" */
  empresa: string
  cliente: string
  /** "CERT-2026-0012" */
  certificado: string
  /** "Controle de pragas" */
  servico: string
  /** Data do serviço (AAAA-MM-DD). */
  dataServico: string | null
  /** Válido até (AAAA-MM-DD). */
  validade: string | null
  /** Unidade/endereço do serviço, quando houver. */
  local: string | null
  /** Números das OS anexadas. */
  ordens: string[]
}

const data = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const escapar = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const FONTE = "font-family: 'Segoe UI', Arial, sans-serif;"

export function assuntoDocumentos(d: DadosEmailDocumentos) {
  const os = d.ordens.length ? ' e ordem de serviço' : ''
  return `Certificado${os} – ${d.servico} · ${d.empresa}`
}

/** "o certificado" / "o certificado e a ordem de serviço" / "… e as ordens de serviço". */
function anexos(d: DadosEmailDocumentos) {
  if (d.ordens.length === 0) return 'o certificado'
  return d.ordens.length === 1
    ? 'o certificado e a ordem de serviço'
    : 'o certificado e as ordens de serviço'
}

function linhas(d: DadosEmailDocumentos): [string, string][] {
  return [
    ['Certificado', d.certificado],
    ['Serviço', d.servico],
    ...(d.local ? ([['Local', d.local]] as [string, string][]) : []),
    ...(d.dataServico ? ([['Data do serviço', data(d.dataServico)]] as [string, string][]) : []),
    ...(d.validade ? ([['Válido até', data(d.validade)]] as [string, string][]) : []),
    ...(d.ordens.length
      ? ([
          [d.ordens.length > 1 ? 'Ordens de serviço' : 'Ordem de serviço', d.ordens.join(', ')],
        ] as [string, string][])
      : []),
  ]
}

export function htmlDocumentos(d: DadosEmailDocumentos): string {
  const quadro = linhas(d)
    .map(
      ([rotulo, valor], i) => `
                    <tr>
                      <td style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: 14px; color: #55624f; white-space: nowrap; vertical-align: top">${escapar(rotulo)}</td>
                      <td align="right" style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: 14px; color: #1e2a1c;">${escapar(valor)}</td>
                    </tr>`,
    )
    .join('')
  const plural = d.ordens.length > 0

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapar(assuntoDocumentos(d))}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f8f1">
    <div style="display: none; max-height: 0; overflow: hidden">
      Segue${plural ? 'm' : ''} em anexo ${anexos(d)} do serviço de ${escapar(d.servico)}.
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
                  Seu certificado chegou 🌱
                </h1>
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6">
                  Olá${d.cliente ? `, <strong>${escapar(d.cliente)}</strong>` : ''}!
                </p>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6">
                  Obrigado por contar com a ${escapar(d.empresa)}. Segue${plural ? 'm' : ''} em anexo
                  ${anexos(d)} do serviço realizado. Os detalhes:
                </p>
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
                  📎 Os PDFs estão anexados a este e-mail.
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6">
                  Alguma dúvida sobre o serviço ou o certificado? É só responder este e-mail.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 32px; border-top: 1px solid #e3e9dd; ${FONTE} font-size: 12px; line-height: 1.6; color: #55624f">
                Este e-mail foi enviado pelo administrativo da ${escapar(d.empresa)}.
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
export function textoDocumentos(d: DadosEmailDocumentos): string {
  return [
    `Olá${d.cliente ? `, ${d.cliente}` : ''}!`,
    '',
    `Segue${d.ordens.length ? 'm' : ''} em anexo ${anexos(d)} do serviço realizado.`,
    '',
    ...linhas(d).map(([r, v]) => `${r}: ${v}`),
    '',
    'Alguma dúvida? É só responder este e-mail.',
    '',
    `${d.empresa} · Soluções ambientais`,
  ].join('\n')
}
