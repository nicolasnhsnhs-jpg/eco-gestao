import { nomeVeiculo } from '../nomeVeiculo'
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'

import type { Arquivo } from '@/features/arquivos/api'
import { baixarAssinatura } from '@/features/certificados/api'
import { formatarData } from '@/lib/datas'
import { formatarCnpj, formatarCpf, formatarTelefone } from '@/lib/documentos'
import { UNIDADE } from '@/lib/unidade'
import { supabase } from '@/lib/supabase'

import { enderecoDaFicha, fichaDaOs, type OsCompleta } from '../api'
import { escreverBebedouro } from './bebedouroPdf'
import { escreverCoifa } from './coifaPdf'
import { buscarDadosPragas, escreverPragas, type DadosPragas } from './pragasPdf'
import { escreverTelas } from './telasPdf'

/*
 * PDF da OS para enviar ao cliente e arquivar. Feito no navegador com pdf-lib
 * (sem WebAssembly nem eval, então respeita a política de segurança do site).
 * Leva só o que o cliente deve ver: dados, escopo, execução, fotos e assinaturas.
 * Observações ADM e a conferência interna ficam de fora.
 */

const A4 = { largura: 595.28, altura: 841.89 }
const MARGEM = 40
const LARGURA_UTIL = A4.largura - MARGEM * 2
const VERDE = rgb(0.243, 0.482, 0.122) // #3E7B1F
const VERDE_ESCURO = rgb(0.122, 0.302, 0.102) // #1F4D1A
const CINZA = rgb(0.4, 0.4, 0.4)
const BORDA = rgb(0.82, 0.86, 0.8)

/** Dados da empresa no rodapé de todas as páginas (cada unidade tem os seus). */
export const EMPRESA_RODAPE = UNIDADE.rodape

/**
 * As fontes do PDF só têm os caracteres do português "comum". Os parecidos que vêm
 * de outros programas e do celular (espaços especiais, barras e traços "chiques",
 * letras de largura dupla) viram os comuns; o resto vira "?".
 */
export function textoSeguro(texto: string | null | undefined) {
  return (texto ?? '')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF\r]/g, '')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[\u2044\u2215\u29F8]/g, '/')
    .replace(/[\u29F5\u2216]/g, '\\')
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/\t/g, ' ')
    .replace(/[^\n\x20-\x7e\xa0-\xff€•]/g, '?')
}

/** Quebra o texto em linhas que cabem na largura. */
export function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number) {
  const linhas: string[] = []
  for (const paragrafo of textoSeguro(texto).split('\n')) {
    let atual = ''
    for (const palavra of paragrafo.split(' ')) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        atual = tentativa
      } else {
        if (atual) linhas.push(atual)
        atual = palavra
      }
    }
    linhas.push(atual)
  }
  return linhas
}

const hora = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : '—'

function documento(valor: string | null | undefined) {
  if (!valor) return ''
  return valor.length === 11 ? formatarCpf(valor) : formatarCnpj(valor)
}

/** Converte qualquer imagem (inclusive WebP) em JPEG, que o PDF aceita. */
async function paraJpeg(blob: Blob, larguraMaxima = 1200) {
  const bitmap = await createImageBitmap(blob)
  const escala = Math.min(1, larguraMaxima / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const jpeg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82))
  if (!jpeg) throw new Error('Não foi possível preparar uma imagem para o PDF.')
  return new Uint8Array(await jpeg.arrayBuffer())
}

async function baixarImagens(arquivos: Arquivo[]) {
  if (arquivos.length === 0) return new Map<string, Uint8Array>()
  const { data, error } = await supabase.storage.from('arquivos').createSignedUrls(
    arquivos.map((a) => a.caminho_storage),
    300,
  )
  if (error) throw error
  const imagens = new Map<string, Uint8Array>()
  for (const [i, link] of data.entries()) {
    if (!link.signedUrl) continue
    const resposta = await fetch(link.signedUrl)
    if (resposta.ok) imagens.set(arquivos[i].id, await paraJpeg(await resposta.blob()))
  }
  return imagens
}

/** Escreve o PDF página a página, abrindo uma nova quando acaba o espaço. */
class Escritor {
  pagina!: PDFPage
  y = 0
  private pdf: PDFDocument
  private normal: PDFFont
  private negrito: PDFFont
  private rodape: string

  constructor(pdf: PDFDocument, normal: PDFFont, negrito: PDFFont, rodape: string) {
    this.pdf = pdf
    this.normal = normal
    this.negrito = negrito
    this.rodape = rodape
    this.novaPagina()
  }

  novaPagina() {
    this.pagina = this.pdf.addPage([A4.largura, A4.altura])
    this.y = A4.altura - MARGEM
    this.pagina.drawLine({
      start: { x: MARGEM, y: 46 },
      end: { x: A4.largura - MARGEM, y: 46 },
      thickness: 0.6,
      color: BORDA,
    })
    const linhas = [...EMPRESA_RODAPE, this.rodape]
    for (const [i, linha] of linhas.entries()) {
      const t = textoSeguro(linha)
      const tamanho = i === linhas.length - 1 ? 6.5 : 7.5
      const fonte = i === 0 ? this.negrito : this.normal
      this.pagina.drawText(t, {
        x: (A4.largura - fonte.widthOfTextAtSize(t, tamanho)) / 2,
        y: 36 - i * 9,
        size: tamanho,
        font: fonte,
        color: i === 0 ? VERDE_ESCURO : CINZA,
      })
    }
  }

  garantir(altura: number) {
    if (this.y - altura < MARGEM + 20) this.novaPagina()
  }

  secao(titulo: string) {
    // O título nunca fica sozinho no pé da página: leva junto pelo menos uma linha.
    this.garantir(64)
    this.y -= 12
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - 16,
      width: LARGURA_UTIL,
      height: 18,
      color: VERDE,
    })
    this.pagina.drawText(textoSeguro(titulo.toUpperCase()), {
      x: MARGEM + 6,
      y: this.y - 11.5,
      size: 9.5,
      font: this.negrito,
      color: rgb(1, 1, 1),
    })
    this.y -= 24
  }

  /** "Rótulo: valor", com o valor quebrando em várias linhas se precisar. */
  campo(rotulo: string, valor: string | null | undefined) {
    const tamanho = 9.5
    const larguraRotulo = 110
    const linhas = quebrarLinhas(valor || '—', this.normal, tamanho, LARGURA_UTIL - larguraRotulo)
    // Rótulo longo (ex.: nome de área) fica numa linha só dele, em cima do valor.
    const rotuloLongo =
      this.negrito.widthOfTextAtSize(textoSeguro(rotulo), tamanho) > larguraRotulo - 6
    this.garantir(linhas.length * 13 + 2 + (rotuloLongo ? 13 : 0))
    this.pagina.drawText(textoSeguro(rotulo), {
      x: MARGEM,
      y: this.y - tamanho,
      size: tamanho,
      font: this.negrito,
      color: VERDE_ESCURO,
    })
    if (rotuloLongo) this.y -= 13
    for (const linha of linhas) {
      this.pagina.drawText(linha, {
        x: MARGEM + larguraRotulo,
        y: this.y - tamanho,
        size: tamanho,
        font: this.normal,
      })
      this.y -= 13
    }
    this.y -= 2
  }

  /** Texto corrido na largura toda (perguntas com resposta, avisos, listas). */
  item(texto: string, destaque?: string) {
    const tamanho = 9.5
    const linhas = quebrarLinhas(
      destaque ? `${texto}  ${destaque}` : texto,
      this.normal,
      tamanho,
      LARGURA_UTIL,
    )
    this.garantir(linhas.length * 13 + 2)
    for (const linha of linhas) {
      this.pagina.drawText(linha, {
        x: MARGEM,
        y: this.y - tamanho,
        size: tamanho,
        font: this.normal,
      })
      this.y -= 13
    }
    this.y -= 2
  }

  imagem(imagem: PDFImage, x: number, largura: number, alturaMaxima: number) {
    const escala = Math.min(largura / imagem.width, alturaMaxima / imagem.height)
    const w = imagem.width * escala
    const h = imagem.height * escala
    this.pagina.drawImage(imagem, { x: x + (largura - w) / 2, y: this.y - h, width: w, height: h })
    this.pagina.drawRectangle({
      x,
      y: this.y - alturaMaxima,
      width: largura,
      height: alturaMaxima,
      borderColor: BORDA,
      borderWidth: 0.8,
    })
  }

  texto(texto: string, x: number, tamanho = 9, negrito = false) {
    this.pagina.drawText(textoSeguro(texto), {
      x,
      y: this.y - tamanho,
      size: tamanho,
      font: negrito ? this.negrito : this.normal,
    })
  }
}

export async function gerarPdfOs(os: OsCompleta, arquivos: Arquivo[], pragas?: DadosPragas) {
  const ficha = fichaDaOs(os.ficha_cliente)
  const e = os.execucao
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${os.numero} - ${os.tipo?.nome ?? ''}`)
  pdf.setAuthor(UNIDADE.nome)
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)

  const assinaturaCliente = arquivos.find((a) => a.id === e?.assinatura_cliente_id)
  const assinaturaOperador = arquivos.find((a) => a.id === e?.assinatura_operador_id)
  // Na ordem em que foram tiradas: "Antes 1" e "Depois 1" costumam ser o mesmo lugar.
  const fotosDe = (categoria: Arquivo['categoria']) =>
    arquivos
      .filter((a) => a.categoria === categoria && a.tipo_mime?.startsWith('image/'))
      .sort((x, y) => x.criado_em.localeCompare(y.criado_em))
  const fotosAntes = fotosDe('foto_antes')
  const fotosDepois = fotosDe('foto_depois')
  const fotos = fotosDe('foto_os')
  const imagens = await baixarImagens(
    [assinaturaCliente, assinaturaOperador, ...fotosAntes, ...fotosDepois, ...fotos].filter(
      (a): a is Arquivo => !!a,
    ),
  )
  // Sem a assinatura escaneada da responsável técnica enviada, o PDF sai sem ela.
  const assinaturaRt = await baixarAssinatura('responsavel').catch(() => null)
  const logo = await pdf.embedJpg(await (await fetch('/logo-pdf.jpg')).arrayBuffer())

  const w = new Escritor(
    pdf,
    normal,
    negrito,
    `${os.numero} · gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
  )

  // Cabeçalho: logo à esquerda, número e serviço à direita
  const alturaLogo = 52
  const larguraLogo = (logo.width / logo.height) * alturaLogo
  w.pagina.drawImage(logo, {
    x: MARGEM,
    y: w.y - alturaLogo,
    width: larguraLogo,
    height: alturaLogo,
  })
  const direita = (texto: string, deslocamento: number, tamanho: number, fonte: PDFFont) => {
    const t = textoSeguro(texto)
    w.pagina.drawText(t, {
      x: A4.largura - MARGEM - fonte.widthOfTextAtSize(t, tamanho),
      y: w.y - deslocamento,
      size: tamanho,
      font: fonte,
      color: VERDE_ESCURO,
    })
  }
  direita('ORDEM DE SERVIÇO', 14, 14, negrito)
  direita(os.numero, 30, 11, negrito)
  direita(os.tipo?.nome ?? '', 44, 10, normal)
  w.y -= alturaLogo + 6

  w.secao('Cliente')
  w.campo('Cliente', [ficha.nome_fantasia, ficha.nome].filter(Boolean).join(' · '))
  if (ficha.razao_social && ficha.razao_social !== ficha.nome)
    w.campo('Razão social', ficha.razao_social)
  w.campo('CPF/CNPJ', documento(ficha.cpf_cnpj))
  if (ficha.unidade?.apelido) w.campo('Unidade', ficha.unidade.apelido)
  w.campo('Endereço', enderecoDaFicha(ficha))
  w.campo(
    'Telefone',
    [ficha.telefone, ficha.whatsapp].filter(Boolean).map(formatarTelefone).join(' · '),
  )
  for (const c of ficha.contatos ?? []) {
    w.campo(
      'Contato',
      [c.nome, c.cargo, formatarTelefone(c.telefone), c.email].filter(Boolean).join(' · '),
    )
  }

  w.secao('Serviço')
  w.campo('Agendado para', formatarData(os.data_agendada))
  w.campo('Descrição', os.descricao)
  w.campo(
    'Operadores',
    os.operadores
      .map((o) => o.operador?.nome)
      .filter(Boolean)
      .join(', '),
  )

  w.secao('Execução')
  w.campo('Data', formatarData(e?.data))
  w.campo('Veículo', os.veiculo ? nomeVeiculo(os.veiculo) : '')
  w.campo('KM na chegada', e?.km_chegada?.toLocaleString('pt-BR'))
  w.campo(
    'Horários',
    `Chegada ${hora(e?.hora_chegada ?? null)} · Início ${hora(e?.hora_inicio ?? null)} · Término ${hora(e?.hora_termino ?? null)} · Saída ${hora(e?.hora_saida ?? null)}`,
  )
  if (os.tipo?.formulario_os === 'generico') w.campo('Resultado', e?.resultado)
  w.campo('Observações', e?.observacoes)
  if (pragas && os.tipo?.formulario_os === 'pragas') escreverPragas(w, normal, negrito, os, pragas)
  if (pragas && os.tipo?.formulario_os === 'coifa') escreverCoifa(w, os, pragas.pontos)
  if (pragas && os.tipo?.formulario_os === 'bebedouro') escreverBebedouro(w, os, pragas.pontos)
  if (pragas && os.tipo?.formulario_os === 'telas') escreverTelas(w, os, pragas.pontos)

  /** Grade de fotos, 3 por linha; com legenda, cada uma leva "<legenda> 1, 2…" embaixo. */
  async function grade(titulo: string, lista: Arquivo[], legenda?: string) {
    const comImagem = lista.filter((f) => imagens.has(f.id))
    if (comImagem.length === 0) return
    const colunas = 3
    const espaco = 8
    const lado = (LARGURA_UTIL - espaco * (colunas - 1)) / colunas
    const alturaLegenda = legenda ? 14 : 0
    // O título não fica sozinho no pé da página: vai junto com a primeira linha de fotos.
    w.garantir(64 + lado + alturaLegenda + espaco)
    w.secao(titulo)
    for (let i = 0; i < comImagem.length; i += colunas) {
      w.garantir(lado + alturaLegenda + espaco)
      for (const [j, foto] of comImagem.slice(i, i + colunas).entries()) {
        const imagem = await pdf.embedJpg(imagens.get(foto.id)!)
        w.imagem(imagem, MARGEM + j * (lado + espaco), lado, lado)
      }
      if (legenda) {
        w.y -= lado + 3
        for (const j of comImagem.slice(i, i + colunas).keys()) {
          w.texto(`${legenda} ${i + j + 1}`, MARGEM + j * (lado + espaco), 8.5, true)
        }
        w.y -= alturaLegenda - 3 + espaco
      } else {
        w.y -= lado + espaco
      }
    }
  }
  await grade('Relatório fotográfico — antes do serviço', fotosAntes, 'Antes')
  await grade('Relatório fotográfico — após o serviço', fotosDepois, 'Depois')
  await grade(fotosAntes.length || fotosDepois.length ? 'Outras fotos' : 'Fotos', fotos)

  // Cliente e operador assinam no celular; a responsável técnica entra sozinha no PDF
  // pronto, com a assinatura escaneada (o operador nem vê esse quadro).
  const rt = UNIDADE.responsavelTecnico
  const quadros: { imagem: PDFImage | null; nome: string; rotulo: string; extra?: string }[] = []
  const acompanhou = e?.sem_acompanhamento
    ? 'Não houve acompanhamento'
    : [e?.responsavel_nome, e?.responsavel_setor].filter(Boolean).join(' · ')
  for (const [arquivo, rotulo, nome] of [
    [e?.sem_acompanhamento ? undefined : assinaturaCliente, 'Acompanhou pelo cliente', acompanhou],
    [assinaturaOperador, 'Operador', e?.operador_nome ?? ''],
  ] as const) {
    const bytes = arquivo && imagens.get(arquivo.id)
    quadros.push({ imagem: bytes ? await pdf.embedJpg(bytes) : null, nome, rotulo })
  }
  if (assinaturaRt) {
    quadros.push({
      imagem: await pdf.embedPng(assinaturaRt),
      nome: rt?.nome ?? '',
      rotulo: 'Responsável técnica',
      extra: rt?.registro,
    })
  }

  w.secao('Assinaturas')
  w.garantir(124)
  const espaco = 16
  const coluna = (LARGURA_UTIL - espaco * (quadros.length - 1)) / quadros.length
  const xDe = (i: number) => MARGEM + i * (coluna + espaco)
  for (const [i, q] of quadros.entries()) {
    if (!q.imagem) continue
    if (i < 2) {
      w.imagem(q.imagem, xDe(i), coluna, 70)
    } else {
      // Assinatura escaneada: sem moldura, com a linha embaixo.
      const escala = Math.min((coluna - 10) / q.imagem.width, 62 / q.imagem.height)
      const iw = q.imagem.width * escala
      const ih = q.imagem.height * escala
      w.pagina.drawImage(q.imagem, {
        x: xDe(i) + (coluna - iw) / 2,
        y: w.y - 66,
        width: iw,
        height: ih,
      })
      w.pagina.drawLine({
        start: { x: xDe(i), y: w.y - 70 },
        end: { x: xDe(i) + coluna, y: w.y - 70 },
        thickness: 0.6,
        color: CINZA,
      })
    }
  }
  w.y -= 76
  for (const [i, q] of quadros.entries()) w.texto(q.nome || '—', xDe(i), 9.5, true)
  w.y -= 12
  for (const [i, q] of quadros.entries()) w.texto(q.rotulo, xDe(i), 8.5)
  w.y -= 12
  if (quadros.some((q) => q.extra)) {
    for (const [i, q] of quadros.entries()) if (q.extra) w.texto(q.extra, xDe(i), 8.5)
    w.y -= 12
  }

  return pdf.save()
}

/** Gera, salva nos arquivos da OS e devolve o PDF para abrir/baixar. */
export async function gerarESalvarPdfOs(os: OsCompleta) {
  const { data: arquivos, error } = await supabase
    .from('arquivos')
    .select('*')
    .eq('os_id', os.id)
    .order('criado_em')
  if (error) throw error

  // Pragas, coifa e bebedouro têm itens próprios (pontos, produtos, insetos) além da execução.
  const pragas =
    os.tipo?.formulario_os === 'pragas' ||
    os.tipo?.formulario_os === 'coifa' ||
    os.tipo?.formulario_os === 'bebedouro' ||
    os.tipo?.formulario_os === 'telas'
      ? await buscarDadosPragas(os.id)
      : undefined
  const bytes = await gerarPdfOs(os, arquivos, pragas)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const nome = `${os.numero}.pdf`
  const id = crypto.randomUUID()
  const caminho = `clientes/${os.cliente_id}/os/${os.id}/${id}-${nome}`

  const envio = await supabase.storage
    .from('arquivos')
    .upload(caminho, blob, { contentType: 'application/pdf' })
  if (envio.error) throw envio.error
  const { error: erroRegistro } = await supabase.from('arquivos').insert({
    id,
    caminho_storage: caminho,
    nome_original: nome,
    tipo_mime: 'application/pdf',
    tamanho_bytes: blob.size,
    categoria: 'relatorio',
    cliente_id: os.cliente_id,
    os_id: os.id,
  })
  if (erroRegistro) {
    await supabase.storage.from('arquivos').remove([caminho])
    throw erroRegistro
  }
  return { blob, nome }
}
