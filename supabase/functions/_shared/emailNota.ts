// O e-mail que leva a nota fiscal ao cliente, no mesmo visual dos e-mails de convite
// e de nova senha (supabase/templates): cartão branco, logo, verde da Eco Ambiental.

export type DadosEmailNota = {
  /** Endereço do sistema da unidade, de onde vem o logo (ex.: https://sistema.ecoambientalrs.com.br). */
  site: string
  /** "Eco Ambiental RS" */
  empresa: string
  cliente: string
  numero: string | null
  competencia: string
  servico: string
  valor: number
  /** Total retido pelo tomador (ISS, PIS/COFINS/CSLL, IRRF, INSS). 0 = sem retenção. */
  retido: number
  vencimento: string | null
  formaPagamento: string | null
  /** O boleto vai anexo junto com a nota. */
  comBoleto?: boolean
  /** Quantos boletos vão anexos (mais de um: "os boletos"). */
  boletos?: number
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export const mesPorExtenso = (iso: string) =>
  `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`
const data = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const reais = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const escapar = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const FONTE = "font-family: 'Segoe UI', Arial, sans-serif;"

const oBoleto = (d: DadosEmailNota) => ((d.boletos ?? 1) > 1 ? 'os boletos' : 'o boleto')

export function assuntoNota(d: DadosEmailNota) {
  return `Nota fiscal${d.numero ? ` nº ${d.numero}` : ''} – ${mesPorExtenso(d.competencia)} · ${d.empresa}`
}

function linhas(d: DadosEmailNota): [string, string, boolean?][] {
  return [
    ['Nota fiscal', d.numero ? `nº ${d.numero}` : '—'],
    ['Referente a', mesPorExtenso(d.competencia)],
    ['Serviço', d.servico],
    ['Valor do serviço', reais(d.valor)],
    ...(d.retido > 0
      ? ([
          ['Retenções na fonte', `– ${reais(d.retido)}`],
          ['Valor a pagar', reais(d.valor - d.retido), true],
        ] as [string, string, boolean][])
      : []),
    ...(d.vencimento
      ? ([['Vencimento', data(d.vencimento), true]] as [string, string, boolean][])
      : []),
    ...(d.formaPagamento ? ([['Forma de pagamento', d.formaPagamento]] as [string, string][]) : []),
  ]
}

export function htmlNota(d: DadosEmailNota): string {
  const quadro = linhas(d)
    .map(
      ([rotulo, valor, destaque], i) => `
                    <tr>
                      <td style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: 14px; color: #55624f; white-space: nowrap; vertical-align: top">${escapar(rotulo)}</td>
                      <td align="right" style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: ${destaque ? '16px' : '14px'}; ${destaque ? 'font-weight: bold; color: #1f4d1a;' : 'color: #1e2a1c;'}">${escapar(valor)}</td>
                    </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapar(assuntoNota(d))}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f8f1">
    <div style="display: none; max-height: 0; overflow: hidden">
      ${d.comBoleto ? `Sua nota fiscal e ${oBoleto(d)}` : 'Sua nota fiscal'} de ${mesPorExtenso(d.competencia)} ${d.comBoleto ? 'estão' : 'está'} em anexo${d.vencimento ? `, com vencimento em ${data(d.vencimento)}` : ''}.
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
                  Sua nota fiscal chegou 🌱
                </h1>
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6">
                  Olá${d.cliente ? `, <strong>${escapar(d.cliente)}</strong>` : ''}!
                </p>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6">
                  Obrigado por contar com a ${escapar(d.empresa)}. ${d.comBoleto ? `Seguem em anexo a nota fiscal e ${oBoleto(d)} do` : 'Segue em anexo a nota fiscal do'}
                  serviço de <strong>${mesPorExtenso(d.competencia)}</strong>. Os detalhes:
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
                  📎 O PDF da nota está anexado a este e-mail.
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6">
                  Alguma dúvida sobre a nota ou o pagamento? É só responder este e-mail que o nosso
                  financeiro atende você.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 32px; border-top: 1px solid #e3e9dd; ${FONTE} font-size: 12px; line-height: 1.6; color: #55624f">
                Este e-mail foi enviado pelo financeiro da ${escapar(d.empresa)}.
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

/** Versão em texto puro (alguns leitores de e-mail e filtros de spam olham esta). */
export function textoNota(d: DadosEmailNota): string {
  return [
    `Olá${d.cliente ? `, ${d.cliente}` : ''}!`,
    '',
    `${d.comBoleto ? `Seguem em anexo a nota fiscal e ${oBoleto(d)}` : 'Segue em anexo a nota fiscal'} do serviço de ${mesPorExtenso(d.competencia)}.`,
    '',
    ...linhas(d).map(([r, v]) => `${r}: ${v}`),
    '',
    'Alguma dúvida? É só responder este e-mail.',
    '',
    `${d.empresa} · Soluções ambientais`,
  ].join('\n')
}
