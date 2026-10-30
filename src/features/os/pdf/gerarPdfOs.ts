import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'

import type { Arquivo } from '@/features/arquivos/api'
import { formatarData } from '@/lib/datas'
import { formatarCnpj, formatarCpf, formatarTelefone } from '@/lib/documentos'
import { supabase } from '@/lib/supabase'

import { enderecoDaFicha, fichaDaOs, type OsCompleta } from '../api'

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

/** Dados da empresa no rodapé de todas as páginas. */
export const EMPRESA_RODAPE = [
  'Eco Ambiental Serviços Ambientais LTDA · CNPJ 69.636.469/0001-18',
  'Rua Albino Dias, 51 - Caminho Novo, Palhoça/SC - CEP 88132-592 · adm@ecoambientalsc.com.br',
]

/** As fontes padrão do PDF só têm os caracteres do português "comum". */
export function textoSeguro(texto: string | null | undefined) {
  return (texto ?? '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
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
    this.garantir(40)
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
    this.garantir(linhas.length * 13 + 2)
    this.pagina.drawText(textoSeguro(rotulo), {
      x: MARGEM,
      y: this.y - tamanho,
      size: tamanho,
      font: this.negrito,
      color: VERDE_ESCURO,
    })
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

export async function gerarPdfOs(os: OsCompleta, arquivos: Arquivo[]) {
  const ficha = fichaDaOs(os.ficha_cliente)
  const e = os.execucao
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${os.numero} - ${os.tipo?.nome ?? ''}`)
  pdf.setAuthor('Eco Ambiental SC')
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)

  const assinaturaCliente = arquivos.find((a) => a.id === e?.assinatura_cliente_id)
  const assinaturaOperador = arquivos.find((a) => a.id === e?.assinatura_operador_id)
  const fotos = arquivos.filter(
    (a) => a.categoria === 'foto_os' && a.tipo_mime?.startsWith('image/'),
  )
  const imagens = await baixarImagens(
    [assinaturaCliente, assinaturaOperador, ...fotos].filter((a): a is Arquivo => !!a),
  )
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
  w.campo('Veículo', os.veiculo ? `${os.veiculo.placa} · ${os.veiculo.descricao}` : '')
  w.campo('KM na chegada', e?.km_chegada?.toLocaleString('pt-BR'))
  w.campo(
    'Horários',
    `Chegada ${hora(e?.hora_chegada ?? null)} · Início ${hora(e?.hora_inicio ?? null)} · Término ${hora(e?.hora_termino ?? null)} · Saída ${hora(e?.hora_saida ?? null)}`,
  )
  w.campo('Resultado', e?.resultado)
  w.campo('Observações', e?.observacoes)

  const fotosComImagem = fotos.filter((f) => imagens.has(f.id))
  if (fotosComImagem.length > 0) {
    w.secao('Fotos')
    const colunas = 3
    const espaco = 8
    const lado = (LARGURA_UTIL - espaco * (colunas - 1)) / colunas
    for (let i = 0; i < fotosComImagem.length; i += colunas) {
      w.garantir(lado + espaco)
      for (const [j, foto] of fotosComImagem.slice(i, i + colunas).entries()) {
        const imagem = await pdf.embedJpg(imagens.get(foto.id)!)
        w.imagem(imagem, MARGEM + j * (lado + espaco), lado, lado)
      }
      w.y -= lado + espaco
    }
  }

  w.secao('Assinaturas')
  w.garantir(110)
  const metade = (LARGURA_UTIL - 20) / 2
  const quadros: [Arquivo | undefined, string, string][] = [
    [
      assinaturaCliente,
      'Acompanhou pelo cliente',
      [e?.responsavel_nome, e?.responsavel_setor].filter(Boolean).join(' · '),
    ],
    [assinaturaOperador, 'Operador', e?.operador_nome ?? ''],
  ]
  for (const [i, [arquivo]] of quadros.entries()) {
    const bytes = arquivo && imagens.get(arquivo.id)
    if (bytes) w.imagem(await pdf.embedJpg(bytes), MARGEM + i * (metade + 20), metade, 70)
  }
  w.y -= 76
  for (const [i, [, , nome]] of quadros.entries()) {
    w.texto(nome || '—', MARGEM + i * (metade + 20), 9.5, true)
  }
  w.y -= 12
  for (const [i, [, rotulo]] of quadros.entries()) {
    w.texto(rotulo, MARGEM + i * (metade + 20), 8.5)
  }
  w.y -= 12

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

  const bytes = await gerarPdfOs(os, arquivos)
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
