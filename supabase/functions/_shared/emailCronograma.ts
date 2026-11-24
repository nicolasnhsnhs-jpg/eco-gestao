// O e-mail que avisa o cliente das datas do controle de pragas do mês (Serviços >
// Cronograma), no mesmo visual da proposta e do certificado: cartão branco, logo,
// verde da Eco Ambiental. Sai do SAC; o cliente não precisa confirmar.
//
// Um e-mail por cliente (CNPJ), com um quadro para cada unidade (endereço) dele na
// rota — quando a mesma razão social tem CNPJs diferentes, cada um recebe o seu e o
// quadro diz a que unidade as datas se referem.

export type UnidadeCronograma = {
  /** "Av. Assis Brasil, 1000 – Passo d'Areia – Porto Alegre/RS" */
  local: string
  /** "12.345.678/0001-90" */
  cnpj: string | null
  /** Dias (AAAA-MM-DD), em ordem. */
  datas: string[]
  /** "Manhã", "Às 9h"… (vazio: horário comercial). */
  horario: string | null
  observacoes: string | null
}

export type DadosEmailCronograma = {
  /** Endereço do sistema da unidade, de onde vem o logo. */
  site: string
  /** "Eco Ambiental RS" */
  empresa: string
  cliente: string
  /** "dezembro de 2026" */
  mes: string
  unidades: UnidadeCronograma[]
  /** "sac@ecoambientalrs.com.br" */
  emailSac: string
}

const escapar = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const FONTE = "font-family: 'Segoe UI', Arial, sans-serif;"

const SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]
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

/** "2026-12-10" → "10/12 (quinta-feira)" */
export function diaComSemana(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const semana = SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} (${semana})`
}

/** "2026-12-01" → "dezembro de 2026" */
export function nomeDoMes(iso: string): string {
  const [a, m] = iso.slice(0, 7).split('-').map(Number)
  return `${MESES[m - 1]} de ${a}`
}

/** "12345678000190" → "12.345.678/0001-90" (CPF também). */
export function documentoFormatado(doc: string | null): string | null {
  const n = (doc ?? '').replace(/\D/g, '')
  if (n.length === 14)
    return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
  if (n.length === 11) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
  return doc || null
}

export function assuntoCronograma(d: DadosEmailCronograma) {
  const [primeira] = d.mes.split(' de ')
  const mesAno = `${primeira}/${d.mes.split(' de ')[1] ?? ''}`
  return `Datas do controle de pragas – ${mesAno} – ${d.cliente} – ${d.empresa}`
}

function linhasDaUnidade(u: UnidadeCronograma): [string, string][] {
  return [
    ['Unidade', u.local],
    ...(u.cnpj ? ([['CNPJ', u.cnpj]] as [string, string][]) : []),
    [u.datas.length > 1 ? 'Datas' : 'Data', u.datas.map(diaComSemana).join('\n')],
    ['Horário', u.horario?.trim() || 'Horário comercial'],
    ...(u.observacoes?.trim()
      ? ([['Observação', u.observacoes.trim()]] as [string, string][])
      : []),
  ]
}

export function htmlCronograma(d: DadosEmailCronograma): string {
  const quadros = d.unidades
    .map((u) => {
      const linhas = linhasDaUnidade(u)
        .map(
          ([rotulo, valor], i) => `
                    <tr>
                      <td style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: 14px; color: #55624f; white-space: nowrap; vertical-align: top">${escapar(rotulo)}</td>
                      <td align="right" style="padding: 10px 16px; ${i ? 'border-top: 1px solid #e3e9dd;' : ''} font-size: 14px; color: #1e2a1c;${rotulo.startsWith('Data') ? ' font-weight: 600;' : ''}">${escapar(valor).replace(/\n/g, '<br />')}</td>
                    </tr>`,
        )
        .join('')
      return `
            <tr>
              <td style="padding: 0 32px 16px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                  style="${FONTE} background-color: #f5f8f1; border: 1px solid #e3e9dd; border-radius: 8px">${linhas}
                </table>
              </td>
            </tr>`
    })
    .join('')

  const varias = d.unidades.length > 1
  const algumHorario = d.unidades.some((u) => u.horario?.trim())

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapar(assuntoCronograma(d))}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f8f1">
    <div style="display: none; max-height: 0; overflow: hidden">
      Datas do controle de pragas de ${escapar(d.mes)}.
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
                  Datas do seu atendimento 📅
                </h1>
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6">
                  Olá${d.cliente ? `, <strong>${escapar(d.cliente)}</strong>` : ''}!
                </p>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6">
                  Informamos as datas do <strong>controle de pragas de ${escapar(d.mes)}</strong>
                  ${varias ? 'em cada uma das suas unidades' : 'na sua unidade'}:
                </p>
              </td>
            </tr>${quadros}
            <tr>
              <td style="padding: 8px 32px 24px; ${FONTE} color: #55624f">
                <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6">
                  ${algumHorario ? 'Quando não há horário indicado, o' : 'O'} atendimento é feito em horário comercial.
                  Não é preciso confirmar: este e-mail é só para avisar.
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6">
                  Alguma dúvida ou precisa de outra data? É só responder este e-mail.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 24px; border-top: 1px solid #e3e9dd; ${FONTE} font-size: 14px; line-height: 1.6; color: #1e2a1c">
                Atenciosamente,<br />
                <strong>SAC · ${escapar(d.empresa)}</strong><br />
                <span style="color: #55624f"><a href="mailto:${escapar(d.emailSac)}" style="color: #3e7b1f">${escapar(d.emailSac)}</a></span>
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
export function textoCronograma(d: DadosEmailCronograma): string {
  return [
    `Olá${d.cliente ? `, ${d.cliente}` : ''}!`,
    '',
    `Informamos as datas do controle de pragas de ${d.mes} ${
      d.unidades.length > 1 ? 'em cada uma das suas unidades' : 'na sua unidade'
    }:`,
    '',
    ...d.unidades.flatMap((u) => [
      ...linhasDaUnidade(u).map(([r, v]) => `${r}: ${v.replace(/\n/g, ', ')}`),
      '',
    ]),
    'O atendimento é feito em horário comercial (salvo horário indicado acima). Não é preciso confirmar: este e-mail é só para avisar.',
    'Alguma dúvida ou precisa de outra data? É só responder este e-mail.',
    '',
    'Atenciosamente,',
    `SAC · ${d.empresa}`,
    d.emailSac,
  ].join('\n')
}
