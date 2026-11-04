// Edge Function "nfse": emite a NFS-e direto na Sefin Nacional, com o certificado A1 da
// empresa (segredos NFSE_CERTIFICADO e NFSE_SENHA). Só Admin e Financeiro chamam.
//
//   testar   confere o certificado e a conexão com a Sefin
//   modelo   baixa o XML de uma nota já emitida (só leitura), para comparar com a nossa DPS
//   ensaiar  manda o rascunho ao ambiente de testes do governo (nada vale, a nota não muda)
//   emitir   emite de verdade: número da DPS, envio, XML e PDF no Storage, nota emitida e
//            o PDF por e-mail ao cliente
//
// A configuração fica em configuracoes (nfse_*); nfse_ambiente diz se a emissão está
// desligada, em testes (homologacao) ou valendo (producao).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { enviarNotaPorEmail, emailDoCliente } from '../_shared/enviarNota.ts'
import { clienteAdmin, conferirFinanceiro, CORS, resposta } from '../_shared/servidor.ts'
import { certificadoDaEmpresa, type Certificado } from './certificado.ts'
import { gerarDanfse } from './danfse.ts'
import { agoraBrasilia, idDps, montarDpsAssinada, type DadosDps, type Endereco } from './dps.ts'
import { Sefin, tag, textoDosErros, type Ambiente } from './sefin.ts'

type Pedido =
  | { acao: 'testar' }
  | { acao: 'modelo'; notaId: string }
  | { acao: 'ensaiar'; notaId: string }
  | { acao: 'emitir'; notaId: string }

class Falha extends Error {}

const CST_COM_ALIQUOTA = ['01', '02']

async function configuracao(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await admin.from('configuracoes').select('chave, valor').like('chave', 'nfse_%')
  return Object.fromEntries((data ?? []).map((c) => [c.chave, (c.valor ?? '').trim()]))
}

/** Código IBGE pelo CEP (ViaCEP), para endereços cadastrados antes do campo existir. */
async function ibgePeloCep(cep: string): Promise<string | null> {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (!r.ok) return null
    const d = (await r.json()) as { ibge?: string; erro?: boolean }
    return !d.erro && /^\d{7}$/.test(d.ibge ?? '') ? d.ibge! : null
  } catch {
    return null
  }
}

/** Endereço do tomador: o do contrato, senão o principal do cliente, senão o primeiro ativo. */
async function enderecoDoTomador(
  admin: SupabaseClient,
  clienteId: string,
  enderecoContrato: string | null,
): Promise<Endereco> {
  let e: Record<string, string | null> | null = null
  if (enderecoContrato) {
    const { data } = await admin
      .from('enderecos')
      .select('*')
      .eq('id', enderecoContrato)
      .maybeSingle()
    e = data
  }
  if (!e) {
    const { data } = await admin
      .from('enderecos')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('principal', { ascending: false })
      .order('criado_em')
      .limit(1)
    e = data?.[0] ?? null
  }
  if (!e)
    throw new Falha('O cliente não tem endereço cadastrado (a nota exige o endereço do tomador).')
  if (!e.cep) throw new Falha('O endereço do cliente está sem CEP.')

  let ibge = e.codigo_ibge
  if (!ibge) {
    ibge = await ibgePeloCep(e.cep)
    if (!ibge)
      throw new Falha(`Não achei o município do CEP ${e.cep}. Confira o endereço do cliente.`)
    await admin.from('enderecos').update({ codigo_ibge: ibge }).eq('id', e.id)
  }
  return {
    codigoIbge: ibge,
    cep: e.cep,
    logradouro: e.logradouro ?? '',
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
  }
}

type NotaMontada = {
  nota: Record<string, any>
  dados: Omit<DadosDps, 'ambiente' | 'serie' | 'numero' | 'dhEmi'>
}

/** Junta tudo o que a DPS precisa a partir do rascunho, do cliente e da configuração. */
async function montarDados(
  admin: SupabaseClient,
  notaId: string,
  cfg: Record<string, string>,
  cert: Certificado,
): Promise<NotaMontada> {
  const { data: nota } = await admin
    .from('notas_fiscais')
    .select('*, cliente:clientes(*), contrato:contratos(endereco_id)')
    .eq('id', notaId)
    .single()
  if (!nota) throw new Falha('Nota não encontrada.')
  if (nota.status !== 'rascunho') throw new Falha('Só o rascunho é emitido.')

  if (!cert.cnpj) throw new Falha('O certificado não é de pessoa jurídica (e-CNPJ).')
  if (!/^\d{7}$/.test(cfg.nfse_municipio_ibge ?? ''))
    throw new Falha('Falta o código IBGE do município da empresa nas configurações.')
  const cliente = nota.cliente
  const documento = (cliente?.cpf_cnpj ?? '').replace(/\D/g, '')
  if (documento.length !== 11 && documento.length !== 14)
    throw new Falha('O cliente está sem CPF/CNPJ.')
  if (!nota.codigo_tributacao) throw new Falha('Falta o código de tributação nacional na nota.')

  const hoje = agoraBrasilia().slice(0, 10)
  if (nota.competencia > hoje)
    throw new Falha('A competência ainda não começou: emita a partir do dia 1.')

  const endereco = await enderecoDoTomador(
    admin,
    nota.cliente_id,
    nota.contrato?.endereco_id ?? null,
  )
  const [email] = await emailDoCliente(admin, nota.cliente_id)

  const valor = Number(nota.valor_servico)
  const cst = nota.cst_piscofins || cfg.nfse_cst_piscofins || '01'
  const comAliquota = CST_COM_ALIQUOTA.includes(cst)
  const aliqPis = comAliquota && nota.aliquota_pis != null ? Number(nota.aliquota_pis) : null
  const aliqCofins =
    comAliquota && nota.aliquota_cofins != null ? Number(nota.aliquota_cofins) : null
  const csll = Number(nota.valor_csll ?? 0)
  const tipoRetencao = nota.tp_ret_piscofins ?? (nota.pis_cofins_retidos ? (csll > 0 ? 3 : 1) : 0)

  return {
    nota,
    dados: {
      competencia: nota.competencia,
      prestador: {
        cnpj: cert.cnpj,
        inscricaoMunicipal: cfg.nfse_inscricao_municipal || null,
        municipioIbge: cfg.nfse_municipio_ibge,
        regimeSimples: cfg.nfse_regime_simples || '1',
        regimeEspecial: cfg.nfse_regime_especial || '0',
      },
      tomador: {
        documento,
        nome: cliente.nome,
        endereco,
        email: email ?? null,
      },
      servico: {
        municipioPrestacao: nota.municipio_prestacao || endereco.codigoIbge,
        codigoTributacao: nota.codigo_tributacao.replace(/\D/g, ''),
        descricao: nota.descricao,
        codigoNbs: nota.codigo_nbs,
      },
      valores: {
        servico: valor,
        issRetido: !!nota.iss_retido,
        pisCofins: {
          cst,
          aliquotaPis: aliqPis,
          aliquotaCofins: aliqCofins,
          // O fisco confere: valor = base × alíquota (E0694).
          valorPis: aliqPis != null ? Math.round(valor * aliqPis) / 100 : null,
          valorCofins: aliqCofins != null ? Math.round(valor * aliqCofins) / 100 : null,
          tipoRetencao,
        },
        retencoes: {
          inss: nota.valor_inss != null ? Number(nota.valor_inss) : null,
          irrf: nota.valor_irrf != null ? Number(nota.valor_irrf) : null,
          csll: csll || null,
        },
      },
      ibsCbs: cfg.nfse_ibscbs_indicador_operacao
        ? {
            indicadorOperacao: cfg.nfse_ibscbs_indicador_operacao,
            cst: cfg.nfse_ibscbs_cst || '000',
            classificacao: cfg.nfse_ibscbs_classificacao || '000001',
          }
        : null,
    },
  }
}

async function guardarArquivo(
  admin: SupabaseClient,
  nota: Record<string, any>,
  usuarioId: string,
  nome: string,
  tipo: string,
  conteudo: Uint8Array,
): Promise<string> {
  const id = crypto.randomUUID()
  const caminho = `clientes/${nota.cliente_id}/${id}-${nome}`
  const envio = await admin.storage
    .from('arquivos')
    .upload(caminho, conteudo, { contentType: tipo })
  if (envio.error) throw new Error(`Não foi possível guardar ${nome}: ${envio.error.message}`)
  const { error } = await admin.from('arquivos').insert({
    id,
    caminho_storage: caminho,
    nome_original: nome,
    tipo_mime: tipo,
    tamanho_bytes: conteudo.byteLength,
    categoria: 'nota_fiscal',
    cliente_id: nota.cliente_id,
    lancamento_id: nota.lancamento_id,
    descricao: nome.replace(/\.\w+$/, ''),
    enviado_por: usuarioId,
  })
  if (error) {
    await admin.storage.from('arquivos').remove([caminho])
    throw new Error(`Não foi possível registrar ${nome}: ${error.message}`)
  }
  return id
}

/** A nota foi autorizada: guarda XML e PDF, marca como emitida e manda o e-mail. */
async function concluir(
  admin: SupabaseClient,
  montada: NotaMontada,
  usuarioId: string,
  chave: string,
  xml: string,
  origem: string | null,
) {
  const { nota, dados } = montada
  const numero = tag(xml, 'nNFSe') ?? ''
  const pdf = await gerarDanfse(xml)
  const enc = new TextEncoder()
  const xmlId = await guardarArquivo(
    admin,
    nota,
    usuarioId,
    `NFSe-${numero}.xml`,
    'application/xml',
    enc.encode(xml),
  )
  const pdfId = await guardarArquivo(
    admin,
    nota,
    usuarioId,
    `NFSe-${numero}.pdf`,
    'application/pdf',
    pdf,
  )
  const pc = dados.valores.pisCofins!

  const { error } = await admin
    .from('notas_fiscais')
    .update({
      status: 'emitida',
      numero,
      chave_acesso: chave,
      data_emissao: (tag(xml, 'dhProc') ?? agoraBrasilia()).slice(0, 10),
      emitida_sistema: true,
      emitindo_em: null,
      erro_emissao: null,
      arquivo_xml_id: xmlId,
      arquivo_pdf_id: pdfId,
      municipio_prestacao: dados.servico.municipioPrestacao,
      cst_piscofins: pc.cst,
      tp_ret_piscofins: pc.tipoRetencao,
      valor_pis: pc.valorPis,
      valor_cofins: pc.valorCofins,
      atualizado_por: usuarioId,
    })
    .eq('id', nota.id)
  if (error) {
    // A nota existe no governo: não pode se perder. Fica o registro para acertar à mão.
    console.error('Nota autorizada mas não gravada', nota.id, chave, error)
    throw new Error(
      `A NFS-e ${numero} foi emitida (chave ${chave}), mas não consegui gravar no sistema: ${error.message}`,
    )
  }

  const envio = await enviarNotaPorEmail(admin, nota.id, { origem })
  return { numero, chave, envio }
}

async function emitir(
  admin: SupabaseClient,
  notaId: string,
  usuarioId: string,
  origem: string | null,
) {
  const cfg = await configuracao(admin)
  if (cfg.nfse_ambiente !== 'producao')
    throw new Falha('A emissão pelo sistema ainda não está ligada (configuração nfse_ambiente).')

  const { data: pegou } = await admin.rpc('travar_emissao_nota', { p_nota_id: notaId })
  if (!pegou) throw new Falha('Esta nota já está sendo emitida, ou não é mais rascunho.')

  const soltar = (erro: string) =>
    admin.from('notas_fiscais').update({ emitindo_em: null, erro_emissao: erro }).eq('id', notaId)

  try {
    const cert = certificadoDaEmpresa()
    const montada = await montarDados(admin, notaId, cfg, cert)
    const jaTinhaNumero = !!montada.nota.numero_dps && montada.nota.ambiente_nfse === 'producao'
    const { data: reserva, error: erroReserva } = await admin.rpc('reservar_numero_dps', {
      p_nota_id: notaId,
      p_ambiente: 'producao',
      p_serie: cfg.nfse_serie || '2',
    })
    if (erroReserva || !reserva?.[0])
      throw new Error(`Não reservei o número da DPS: ${erroReserva?.message}`)
    const { serie, numero } = reserva[0] as { serie: string; numero: string }

    const sefin = new Sefin('producao', cert)
    const id = idDps({ prestador: montada.dados.prestador, serie, numero })

    // Nova tentativa: a DPS pode já ter virado nota num envio que ficou sem resposta.
    if (jaTinhaNumero) {
      const chave = await sefin.chaveDaDps(id)
      if (chave) {
        const xml = await sefin.xmlDaNota(chave)
        if (xml) return await concluir(admin, montada, usuarioId, chave, xml, origem)
      }
    }

    const { xml: dps } = montarDpsAssinada(
      { ...montada.dados, ambiente: 'producao', serie, numero, dhEmi: agoraBrasilia() },
      cert,
    )
    let r
    try {
      r = await sefin.emitir(dps)
    } catch (e) {
      // Sem resposta (queda, tempo esgotado): confere se a nota saiu mesmo assim.
      const chave = await sefin.chaveDaDps(id).catch(() => null)
      const xml = chave ? await sefin.xmlDaNota(chave).catch(() => null) : null
      if (chave && xml) return await concluir(admin, montada, usuarioId, chave, xml, origem)
      throw new Falha(`A Sefin Nacional não respondeu (${(e as Error).message}). Tente de novo.`)
    }
    if (!r.ok) throw new Falha(`Recusada pela Sefin: ${textoDosErros(r.erros)}`)
    return await concluir(admin, montada, usuarioId, r.chaveAcesso, r.xml, origem)
  } catch (e) {
    await soltar((e as Error).message)
    throw e
  }
}

/** Manda o rascunho ao ambiente de testes do governo. Nada na nota muda. */
async function ensaiar(admin: SupabaseClient, notaId: string) {
  const cfg = await configuracao(admin)
  const cert = certificadoDaEmpresa()
  const montada = await montarDados(admin, notaId, cfg, cert)
  const { data: reserva, error } = await admin.rpc('reservar_numero_dps', {
    p_nota_id: notaId,
    p_ambiente: 'homologacao',
    p_serie: cfg.nfse_serie || '2',
  })
  if (error || !reserva?.[0]) throw new Error(`Não reservei o número da DPS: ${error?.message}`)
  const { serie, numero } = reserva[0] as { serie: string; numero: string }
  const { xml: dps } = montarDpsAssinada(
    { ...montada.dados, ambiente: 'homologacao', serie, numero, dhEmi: agoraBrasilia() },
    cert,
  )
  const r = await new Sefin('homologacao', cert).emitir(dps)
  if (!r.ok) return { ok: false, erro: textoDosErros(r.erros), dps }
  const pdf = await gerarDanfse(r.xml)
  return {
    ok: true,
    numero: tag(r.xml, 'nNFSe'),
    chave: r.chaveAcesso,
    alertas: r.alertas,
    xml: r.xml,
    pdfBase64: btoa(Array.from(pdf, (b) => String.fromCharCode(b)).join('')),
  }
}

async function testar(admin: SupabaseClient) {
  const cfg = await configuracao(admin)
  const cert = certificadoDaEmpresa()
  const ambiente: Ambiente = cfg.nfse_ambiente === 'producao' ? 'producao' : 'homologacao'
  // Consulta uma DPS que não existe: "não encontrada" prova que o certificado foi aceito.
  let conexao: string
  try {
    await new Sefin(ambiente, cert).chaveDaDps(
      idDps({
        prestador: {
          cnpj: cert.cnpj ?? '0',
          municipioIbge: cfg.nfse_municipio_ibge || '0000000',
        } as DadosDps['prestador'],
        serie: '49999',
        numero: '1',
      }),
    )
    conexao = 'ok'
  } catch (e) {
    conexao = (e as Error).message
  }
  return {
    titular: cert.titular,
    cnpj: cert.cnpj,
    validoAte: cert.validoAte.toISOString(),
    ambiente: cfg.nfse_ambiente || 'desligado',
    conexao,
  }
}

/** XML de uma nota já emitida (pela chave de acesso), sem mudar nada. */
async function modelo(admin: SupabaseClient, notaId: string) {
  const { data: nota } = await admin
    .from('notas_fiscais')
    .select('chave_acesso')
    .eq('id', notaId)
    .single()
  if (!nota?.chave_acesso) throw new Falha('Esta nota não tem chave de acesso.')
  const xml = await new Sefin('producao', certificadoDaEmpresa()).xmlDaNota(nota.chave_acesso)
  if (!xml) throw new Falha('A Sefin não achou a nota com esta chave.')
  return { xml }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const admin = clienteAdmin()
  const quem = await conferirFinanceiro(req, admin)
  if (quem instanceof Response) return quem

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' })
  }

  try {
    switch (pedido.acao) {
      case 'testar':
        return resposta(200, await testar(admin))
      case 'modelo':
        return resposta(200, await modelo(admin, pedido.notaId))
      case 'ensaiar':
        return resposta(200, await ensaiar(admin, pedido.notaId))
      case 'emitir':
        return resposta(
          200,
          await emitir(admin, pedido.notaId, quem.usuarioId, req.headers.get('origin')),
        )
      default:
        return resposta(400, { erro: 'Ação desconhecida.' })
    }
  } catch (e) {
    const falha = e instanceof Falha
    if (!falha) console.error(e)
    return resposta(falha ? 400 : 500, { erro: (e as Error).message })
  }
})
