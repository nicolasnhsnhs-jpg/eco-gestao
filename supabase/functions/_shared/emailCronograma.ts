// O e-mail que avisa o cliente das datas do controle de pragas do mês (Serviços >
// Cronograma), no mesmo visual da proposta e do certificado: cartão branco, logo,
// verde da Eco Ambiental. Sai do SAC; o cliente não precisa confirmar.
//
// Os serviços de espaçamento maior (coifa, reservatório, sucção…) usam o mesmo
// e-mail, mas perguntando se a data serve (`confirmar`): o cliente responde ao SAC.
//
// Um e-mail por cliente (CNPJ), com um quadro para cada unidade (endereço) dele na
// rota — quando a mesma razão social tem CNPJs diferentes, cada um recebe o seu e o
// quadro diz a que unidade as datas se referem.

export type UnidadeCronograma = {
  /** "Limpeza de coifa" (vazio no controle de pragas da rota). */
  servico: string | null
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
  /** Pergunta se a data serve (serviço de contrato), em vez de só avisar (pragas). */
  confirmar: boolean
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

/** "dezembro de 2026" → "dezembro/2026" */
const mesBarra = (mes: string) => mes.replace(' de ', '/')

/** Os serviços do e-mail de confirmação, sem repetir: "limpeza de coifa e sucção". */
function servicosDoEmail(d: DadosEmailCronograma): string {
  const nomes = [
    ...new Set(d.unidades.map((u) => u.servico?.trim().toLowerCase()).filter(Boolean)),
  ] as string[]
  if (nomes.length === 0) return 'atendimento'
  if (nomes.length === 1) return nomes[0]
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export function assuntoCronograma(d: DadosEmailCronograma) {
  if (d.confirmar) {
    const s = servicosDoEmail(d)
    return `Agendamento de ${s} – confirme a data – ${d.cliente} – ${d.empresa}`
  }
  return `Datas do controle de pragas – ${mesBarra(d.mes)} – ${d.cliente} – ${d.empresa}`
}

/** Título, abertura e fechamento: aviso (pragas) ou pergunta (serviço de contrato). */
function textos(d: DadosEmailCronograma) {
  const varias = d.unidades.length > 1
  const comHorario = d.unidades.filter((u) => u.horario?.trim()).length
  // Todas com horário: nada a dizer; algumas: só as sem horário são em horário comercial.
  const comercial =
    comHorario === d.unidades.length
      ? ''
      : `${comHorario ? 'Quando não há horário indicado, o' : 'O'} atendimento é feito em horário comercial.`
  if (d.confirmar) {
    return {
      titulo: 'Podemos agendar? 📅',
      abertura: [
        `Está chegando a hora do serviço de <strong>${escapar(servicosDoEmail(d))}</strong>`,
        `Está chegando a hora do serviço de ${servicosDoEmail(d)}`,
      ],
      abertura2: varias
        ? 'Separamos as datas abaixo para cada uma das suas unidades:'
        : 'Separamos a data abaixo para a sua unidade:',
      fechamento: [
        comercial,
        '<strong>Pode ser nesta data?</strong> Responda este e-mail confirmando ou sugerindo outro dia que fique melhor para vocês.',
        'Pode ser nesta data? Responda este e-mail confirmando ou sugerindo outro dia que fique melhor para vocês.',
      ],
    }
  }
  return {
    titulo: 'Datas do seu atendimento 📅',
    abertura: [
      `Informamos as datas do <strong>controle de pragas de ${escapar(d.mes)}</strong>`,
      `Informamos as datas do controle de pragas de ${d.mes}`,
    ],
    abertura2: varias ? 'em cada uma das suas unidades:' : 'na sua unidade:',
    fechamento: [
      `${comercial} Não é preciso confirmar: este e-mail é só para avisar.`.trim(),
      'Alguma dúvida ou precisa de outra data? É só responder este e-mail.',
      'Alguma dúvida ou precisa de outra data? É só responder este e-mail.',
    ],
  }
}

function linhasDaUnidade(u: UnidadeCronograma): [string, string][] {
  return [
    ...(u.servico?.trim() ? ([['Serviço', u.servico.trim()]] as [string, string][]) : []),
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

  const t = textos(d)
  // No aviso a frase continua ("…de dezembro em cada unidade:"); na pergunta, são duas.
  const abertura = d.confirmar
    ? `${t.abertura[0]}.</p>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6">${t.abertura2}`
    : `${t.abertura[0]} ${t.abertura2}`

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapar(assuntoCronograma(d))}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f8f1">
    <div style="display: none; max-height: 0; overflow: hidden">
      ${escapar(d.confirmar ? `Agendamento de ${servicosDoEmail(d)}: pode ser nesta data?` : `Datas do controle de pragas de ${d.mes}.`)}
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
                  ${t.titulo}
                </h1>
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6">
                  Olá${d.cliente ? `, <strong>${escapar(d.cliente)}</strong>` : ''}!
                </p>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6">
                  ${abertura}
                </p>
              </td>
            </tr>${quadros}
            <tr>
              <td style="padding: 8px 32px 24px; ${FONTE} color: #55624f">${
                t.fechamento[0]
                  ? `
                <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6">
                  ${t.fechamento[0]}
                </p>`
                  : ''
              }
                <p style="margin: 0; font-size: ${d.confirmar ? '16px; color: #1e2a1c' : '14px'}; line-height: 1.6">
                  ${t.fechamento[1]}
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
  const t = textos(d)
  return [
    `Olá${d.cliente ? `, ${d.cliente}` : ''}!`,
    '',
    d.confirmar ? `${t.abertura[1]}. ${t.abertura2}` : `${t.abertura[1]} ${t.abertura2}`,
    '',
    ...d.unidades.flatMap((u) => [
      ...linhasDaUnidade(u).map(([r, v]) => `${r}: ${v.replace(/\n/g, ', ')}`),
      '',
    ]),
    ...(t.fechamento[0] ? [t.fechamento[0].replace(/<[^>]+>/g, '')] : []),
    t.fechamento[2],
    '',
    'Atenciosamente,',
    `SAC · ${d.empresa}`,
    d.emailSac,
  ].join('\n')
}

// -----------------------------------------------------------------------------
// Montagem: quais e-mails saem de um cronograma (usada pela função e pela prévia
// da tela, para as duas mostrarem a mesma coisa).
// -----------------------------------------------------------------------------

export type ItemParaEmail = {
  id: string
  cliente_id: string
  ordem: number
  datas: string[] | null
  so_visita: number | null
  incluido: boolean
  horario: string | null
  observacoes: string | null
  servicos: string[]
  pede_confirmacao: boolean
  cliente: { nome: string; nome_fantasia: string | null; cpf_cnpj: string | null } | null
  endereco: {
    apelido: string | null
    logradouro: string
    numero: string | null
    bairro: string | null
    cidade: string
    uf: string
  } | null
}

/** Os dias da unidade: os próprios; senão os da rota (ou só a Nª visita dela). */
export function datasDaUnidade(
  item: { datas: string[] | null; so_visita: number | null },
  daRota: readonly string[],
): string[] {
  if (item.datas) return [...item.datas].sort()
  const rota = [...daRota].sort()
  if (item.so_visita) return rota[item.so_visita - 1] ? [rota[item.so_visita - 1]] : []
  return rota
}

/** O turno/horário que vai no e-mail (o da unidade, senão o da rota; vazio = comercial). */
export function horarioDaUnidade(
  item: { horario: string | null },
  daRota: string | null,
): string | null {
  return item.horario?.trim() || daRota?.trim() || null
}

/** "Matriz – Av. Brasil, 10 – Centro – Esteio/RS" */
export function localDaUnidade(e: ItemParaEmail['endereco']): string {
  if (!e) return 'Endereço principal'
  const rua = `${e.logradouro}, ${e.numero || 's/n'}`
  const partes = [rua, e.bairro, `${e.cidade}/${e.uf}`].filter(Boolean).join(' – ')
  return e.apelido?.trim() ? `${e.apelido.trim()} – ${partes}` : partes
}

export type GrupoEmail<T extends ItemParaEmail> = {
  clienteId: string
  nomeCliente: string
  confirmar: boolean
  /** As unidades que vão no e-mail (com datas), na ordem da rota. */
  itens: T[]
  unidades: UnidadeCronograma[]
}

/**
 * Um e-mail por cliente (CNPJ): as unidades dele, com datas. Aviso e pedido de
 * confirmação do mesmo cliente saem em e-mails separados. Unidades sem datas ou fora
 * do mês ficam de fora.
 */
export function gruposDeEmail<T extends ItemParaEmail>(
  itens: readonly T[],
  crono: { datas: readonly string[]; horario: string | null },
): GrupoEmail<T>[] {
  const grupos = new Map<string, GrupoEmail<T>>()
  for (const i of [...itens].sort((a, b) => a.ordem - b.ordem)) {
    if (!i.incluido) continue
    const datas = datasDaUnidade(i, crono.datas)
    if (datas.length === 0) continue
    const chave = `${i.cliente_id}|${i.pede_confirmacao}`
    let g = grupos.get(chave)
    if (!g) {
      g = {
        clienteId: i.cliente_id,
        nomeCliente: i.cliente?.nome_fantasia || i.cliente?.nome || 'Cliente',
        confirmar: i.pede_confirmacao,
        itens: [],
        unidades: [],
      }
      grupos.set(chave, g)
    }
    g.itens.push(i)
    g.unidades.push({
      servico: i.pede_confirmacao ? i.servicos.join(', ') || null : null,
      local: localDaUnidade(i.endereco),
      cnpj: documentoFormatado(i.cliente?.cpf_cnpj ?? null),
      datas,
      horario: horarioDaUnidade(i, crono.horario),
      observacoes: i.observacoes,
    })
  }
  return [...grupos.values()]
}
