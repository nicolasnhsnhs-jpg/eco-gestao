/**
 * Assinatura de e-mail no padrão Eco Ambiental, para o Outlook clássico.
 * Só usa <table> e CSS inline (o Outlook ignora <style>, flexbox e grid).
 * As imagens ficam no site público (ecoambientalsc.com.br/assinatura/img/): o Outlook
 * e quem recebe o e-mail precisam baixá-las sem login.
 */

export const IMG_ASSINATURA = 'https://ecoambientalsc.com.br/assinatura/img/'

export const ICONES_SERVICO = {
  inseto: 'Inseto',
  rato: 'Rato',
  caixa: "Caixa d'água",
  succao: 'Caminhão',
  desentupimento: 'Chave',
  jato: 'Jato',
  coifa: 'Coifa',
  placa: 'Placa solar',
  gota: 'Gota',
  folha: 'Folha',
  check: 'Check',
} as const

export type IconeServico = keyof typeof ICONES_SERVICO

export type ServicoAssinatura = { icone: IconeServico; texto: string }

export type DadosAssinatura = {
  nome: string
  cargo: string
  telefone: string
  whatsapp: string
  email: string
  site: string
  instagram: string
  rodape1: string
  rodape2: string
  servicos: ServicoAssinatura[]
}

export const PADRAO_ASSINATURA: DadosAssinatura = {
  nome: '',
  cargo: '',
  telefone: '',
  whatsapp: '',
  email: 'adm@ecoambientalsc.com.br',
  site: 'ecoambientalsc.com.br',
  instagram: '@ecoambientalsc',
  rodape1: 'Há mais de 22 anos atuando com',
  rodape2: 'prevenção e responsabilidade.',
  servicos: [
    { icone: 'inseto', texto: 'Desinsetização' },
    { icone: 'rato', texto: 'Desratização' },
    { icone: 'caixa', texto: "Limpeza e Desinfecção de Caixas d'Água" },
    { icone: 'succao', texto: 'Sucção de Fossa e Caixa de Gordura' },
    { icone: 'desentupimento', texto: 'Desentupimento' },
    { icone: 'jato', texto: 'Hidrojateamento' },
    { icone: 'coifa', texto: 'Limpeza de Coifas' },
    { icone: 'placa', texto: 'Limpeza de Placas' },
  ],
}

// ---------- utilidades ----------
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c])
const digitos = (s: string) => s.replace(/\D/g, '')

/** Número com DDI 55 quando foi digitado só com DDD (até 11 dígitos). */
export function comDDI(s: string) {
  const d = digitos(s)
  return d.length <= 11 ? '55' + d : d
}

export function urlSite(s: string) {
  return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '')
}

export function urlInstagram(s: string) {
  if (/^https?:\/\//i.test(s)) return s
  return 'https://www.instagram.com/' + s.replace(/^@/, '').replace(/\/+$/, '') + '/'
}

/** "22 anos" fica em verde no rodapé. */
const destacaAnos = (s: string) =>
  esc(s).replace(/(\d+\s+anos)/i, '<b style="color:#8fd13f;">$1</b>')

// ---------- HTML ----------
const FONTE = 'font-family:Arial,Helvetica,sans-serif;mso-line-height-rule:exactly;'
const CINZA = '#333333'
const ESCURO = '#14301a'
const FUNDO_RODAPE = '#062414'
const ESPACO = (px: number) =>
  `<td width="${px}" style="width:${px}px;font-size:1px;line-height:1px;">&nbsp;</td>`
const TABELA = 'cellpadding="0" cellspacing="0" border="0" role="presentation"'
const img = (src: string, w: number, h: number, alt = '') =>
  `<img src="${src}" width="${w}" height="${h}" alt="${alt}" style="display:block;border:0;width:${w}px;height:${h}px;">`

function link(href: string, texto: string, sublinhado: boolean, tamanho = '') {
  return (
    `<a href="${esc(href)}" style="color:${CINZA};text-decoration:${sublinhado ? 'underline' : 'none'};${tamanho ? `font-size:${tamanho};` : ''}">` +
    `<span style="color:${CINZA};">${esc(texto)}</span></a>`
  )
}

function linhaContato(icone: string, base: string, conteudo: string) {
  return (
    `<tr><td style="padding:0 0 5px 0;"><table ${TABELA} style="border-collapse:collapse;"><tr>` +
    `<td width="24" valign="middle" style="width:24px;">${img(base + icone, 24, 24)}</td>` +
    ESPACO(8) +
    `<td valign="middle" style="${FONTE}font-size:11.5px;line-height:15px;color:${CINZA};">${conteudo}</td>` +
    `</tr></table></td></tr>`
  )
}

function linhaServico(s: ServicoAssinatura, base: string) {
  const icone = s.icone in ICONES_SERVICO ? s.icone : 'check'
  return (
    `<tr><td style="padding:0 0 3px 0;"><table ${TABELA} style="border-collapse:collapse;"><tr>` +
    `<td width="20" valign="middle" style="width:20px;">${img(`${base}sv-${icone}.png`, 20, 20)}</td>` +
    ESPACO(6) +
    `<td valign="middle" style="${FONTE}font-size:10.5px;line-height:12px;color:${CINZA};">${esc(s.texto.trim())}</td>` +
    `</tr></table></td></tr>`
  )
}

/** HTML da assinatura (650 px de largura). `base` é o endereço da pasta de imagens. */
export function gerarAssinatura(d: DadosAssinatura, base = IMG_ASSINATURA) {
  const contatos: string[] = []
  const telefone = d.telefone.trim()
  const whatsapp = d.whatsapp.trim()
  const instagram = d.instagram.trim()
  const site = d.site.trim()
  const email = d.email.trim()
  if (telefone)
    contatos.push(
      linhaContato('ic-telefone.png', base, link(`tel:+${comDDI(telefone)}`, telefone, false)),
    )
  if (whatsapp)
    contatos.push(
      linhaContato(
        'ic-whatsapp.png',
        base,
        link(`https://wa.me/${comDDI(whatsapp)}`, whatsapp, false),
      ),
    )
  if (instagram)
    contatos.push(
      linhaContato('ic-instagram.png', base, link(urlInstagram(instagram), instagram, true)),
    )
  if (site)
    contatos.push(
      linhaContato(
        'ic-site.png',
        base,
        link(urlSite(site), site.replace(/^https?:\/\//i, '').replace(/\/$/, ''), true),
      ),
    )
  if (email) {
    // E-mails compridos diminuem a fonte para não estourar a coluna.
    const tamanho = email.length > 36 ? '10px' : email.length > 31 ? '10.5px' : ''
    contatos.push(linhaContato('ic-email.png', base, link(`mailto:${email}`, email, true, tamanho)))
  }

  const servicos = d.servicos
    .filter((s) => s.texto.trim())
    .map((s) => linhaServico(s, base))
    .join('')

  const divisoria =
    ESPACO(9) +
    '<td width="1" bgcolor="#c4c4c4" style="width:1px;background-color:#c4c4c4;font-size:1px;line-height:1px;">&nbsp;</td>' +
    ESPACO(9)

  const rodape2 = d.rodape2.trim()

  return (
    `<table ${TABELA} width="650" bgcolor="#ffffff" style="width:650px;border-collapse:collapse;background-color:#ffffff;${FONTE}">` +
    // ---- parte principal ----
    `<tr><td style="padding:12px 0 6px 0;"><table ${TABELA} width="650" style="width:650px;border-collapse:collapse;"><tr>` +
    // logo
    `<td width="205" align="center" valign="middle" style="width:205px;padding:20px 0 0 0;">` +
    `<a href="${esc(urlSite(site || 'ecoambientalsc.com.br'))}" style="text-decoration:none;">` +
    img(base + 'logo.png', 196, 76, 'Eco-Ambiental Serviços Ambientais') +
    `</a></td>` +
    divisoria +
    // contato
    `<td width="250" valign="top" style="width:250px;padding:0 0 0 2px;"><table ${TABELA} style="border-collapse:collapse;">` +
    `<tr><td style="${FONTE}font-size:16px;line-height:20px;font-weight:bold;color:${ESCURO};padding:0 0 2px 0;">${esc(d.nome.trim() || 'Nome do Funcionário')}</td></tr>` +
    `<tr><td style="${FONTE}font-size:12.5px;line-height:16px;color:#555555;padding:0 0 8px 0;">${esc(d.cargo.trim() || 'Cargo / setor')}</td></tr>` +
    contatos.join('') +
    `</table></td>` +
    divisoria +
    // serviços
    `<td width="157" valign="top" style="width:157px;"><table ${TABELA} style="border-collapse:collapse;">` +
    `<tr><td style="${FONTE}font-size:14px;line-height:18px;font-weight:bold;color:${ESCURO};padding:0 0 5px 0;">Nossos serviços</td></tr>` +
    servicos +
    `</table></td>` +
    `</tr></table></td></tr>` +
    // ---- rodapé em onda ----
    `<tr><td style="font-size:1px;line-height:1px;">${img(base + 'onda-topo.png', 650, 26)}</td></tr>` +
    `<tr><td bgcolor="${FUNDO_RODAPE}" style="background-color:${FUNDO_RODAPE};font-size:1px;line-height:1px;">` +
    `<table ${TABELA} width="650" bgcolor="${FUNDO_RODAPE}" style="width:650px;border-collapse:collapse;background-color:${FUNDO_RODAPE};"><tr>` +
    `<td width="330" height="46" bgcolor="${FUNDO_RODAPE}" valign="middle" style="width:330px;height:46px;background-color:${FUNDO_RODAPE};">` +
    `<table ${TABELA} style="border-collapse:collapse;"><tr>` +
    ESPACO(18) +
    `<td width="21" valign="middle" style="width:21px;">${img(base + 'gota.png', 21, 38)}</td>` +
    ESPACO(11) +
    '<td width="1" bgcolor="#3f7a2a" style="width:1px;background-color:#3f7a2a;font-size:1px;line-height:1px;">&nbsp;</td>' +
    ESPACO(11) +
    `<td valign="middle" style="${FONTE}font-size:11.5px;line-height:15px;color:#ffffff;">` +
    destacaAnos(d.rodape1.trim()) +
    (rodape2 ? `<br><b>${esc(rodape2)}</b>` : '') +
    `</td></tr></table></td>` +
    `<td width="320" height="46" bgcolor="${FUNDO_RODAPE}" style="width:320px;height:46px;background-color:${FUNDO_RODAPE};font-size:1px;line-height:1px;">${img(base + 'onda-direita.png', 320, 46)}</td>` +
    `</tr></table></td></tr>` +
    `</table>`
  )
}

/** Arquivo .htm para a pasta %APPDATA%\Microsoft\Signatures (com BOM, para o Outlook ler UTF-8). */
export function arquivoHtm(d: DadosAssinatura) {
  const nome = esc(d.nome.trim() || 'Assinatura')
  return (
    '﻿<!DOCTYPE html>\r\n<html lang="pt-BR">\r\n<head>\r\n' +
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\r\n' +
    `<title>Assinatura ${nome}</title>\r\n</head>\r\n<body style="margin:0;">\r\n` +
    gerarAssinatura(d) +
    '\r\n</body>\r\n</html>\r\n'
  )
}

/** Nome do arquivo baixado, sem caracteres que o Windows não aceita. */
export function nomeArquivoHtm(nome: string) {
  const limpo = nome.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Assinatura'
  return `Eco Ambiental SC - ${limpo}.htm`
}
