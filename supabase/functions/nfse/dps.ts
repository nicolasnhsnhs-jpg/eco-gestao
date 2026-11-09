// Montagem e assinatura da DPS (Declaração de Prestação de Serviço), o XML que a Sefin
// Nacional transforma em NFS-e. Leiaute 1.01 (esquemas XSD do Sistema Nacional NFS-e).
//
// O XML é escrito à mão, já na forma canônica (C14N): sem espaços entre as tags, na ordem
// exata do XSD, e com o texto escapado como o C14N escreve. Assim o resumo (digest) que
// assinamos é o mesmo que a Sefin calcula ao conferir.

import { assinarSha1, sha1Base64, type Certificado } from './certificado.ts'

const NS = 'http://www.sped.fazenda.gov.br/nfse'
const NS_ASSINATURA = 'http://www.w3.org/2000/09/xmldsig#'
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
export const VERSAO_DPS = '1.01'
export const VER_APLIC = 'EcoGestao-1.0' // até 20 caracteres

export type Endereco = {
  codigoIbge: string
  cep: string
  logradouro: string
  numero: string | null
  complemento: string | null
  bairro: string | null
}

/**
 * "nt009": leiaute da NT SE/CGNFS-e 009 (ambiente de testes desde 29/10/2026 e, pelo que
 * se sabe, produção a partir de 01/12/2026). "anterior": o da produção até a virada.
 */
export type Leiaute = 'nt009' | 'anterior'

export type DadosDps = {
  ambiente: 'producao' | 'homologacao'
  leiaute: Leiaute
  /** "2026-11-01T08:00:00-03:00" */
  dhEmi: string
  serie: string
  numero: string
  /** "2026-11-01" */
  competencia: string
  /** Substitui a NFS-e desta chave (grupo subst); a Sefin cancela a antiga por substituição. */
  substituicao?: { chave: string; motivo: string; justificativa: string | null } | null
  prestador: {
    cnpj: string
    inscricaoMunicipal: string | null
    municipioIbge: string
    regimeSimples: string // 1 não optante, 2 MEI, 3 ME/EPP
    regimeApuracaoSimples?: string | null
    regimeEspecial: string
  }
  tomador: {
    documento: string // CPF (11) ou CNPJ (14), só dígitos
    nome: string
    inscricaoMunicipal?: string | null
    endereco: Endereco | null
    email?: string | null
  }
  servico: {
    municipioPrestacao: string
    codigoTributacao: string // cTribNac, 6 dígitos
    /** cTribMun, 3 dígitos: o código do serviço na cidade, quando ela exige (E0312). */
    codigoMunicipal?: string | null
    descricao: string
    codigoNbs: string | null
  }
  valores: {
    servico: number
    issRetido: boolean
    /** Alíquota do ISS na nota. Só vai na DPS (pAliq) quando o município de incidência
     * não está no convênio e a Sefin pede (E0619); senão a alíquota é a parametrizada. */
    aliquotaIss?: number | null
    informarAliquotaIss?: boolean
    /** tribISSQN: 1 tributável, 2 imunidade, 3 exportação, 4 não incidência. */
    tributacaoIss: string
    /** tpImunidade (só com tributacaoIss 2). */
    imunidade: string | null
    pisCofins: {
      cst: string
      aliquotaPis: number | null
      aliquotaCofins: number | null
      valorPis: number | null
      valorCofins: number | null
      tipoRetencao: number | null
    } | null
    retencoes: { inss: number | null; irrf: number | null; csll: number | null }
  }
  ibsCbs: { indicadorOperacao: string; cst: string; classificacao: string } | null
}

// -----------------------------------------------------------------------------
// XML canônico
// -----------------------------------------------------------------------------

/** Texto como o XML lê e o C14N escreve: quebras \r\n viram \n; & < > escapados. */
function texto(v: string): string {
  return (
    v
      .replace(/\r\n?/g, '\n')
      // Caracteres de controle não existem em XML 1.0 (só tab e quebra de linha).
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  )
}

type No = string | null | undefined | false

function el(nome: string, conteudo: No | No[]): string {
  const partes = (Array.isArray(conteudo) ? conteudo : [conteudo]).filter(
    (p): p is string => typeof p === 'string',
  )
  return `<${nome}>${partes.join('')}</${nome}>`
}

/** Elemento de texto; vazio/nulo = elemento omitido (campo opcional). */
function campo(nome: string, valor: string | number | null | undefined): string | null {
  if (valor == null) return null
  const s = String(valor).trim()
  return s === '' ? null : `<${nome}>${texto(s)}</${nome}>`
}

/** Valor com 2 casas, no formato do XSD (TSDec15V2): "1200.00", "0.00". */
export function dec(v: number): string {
  return (Math.round(Number(v) * 100) / 100).toFixed(2)
}

const digitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')
const corta = (v: string, max: number) => (v.length > max ? v.slice(0, max) : v)

export function idDps(d: Pick<DadosDps, 'prestador' | 'serie' | 'numero'>): string {
  const doc = digitos(d.prestador.cnpj)
  return (
    'DPS' +
    d.prestador.municipioIbge +
    (doc.length === 14 ? '2' : '1') +
    doc.padStart(14, '0') +
    d.serie.padStart(5, '0') +
    d.numero.padStart(15, '0')
  )
}

function endereco(e: Endereco): string {
  return el('end', [
    el('endNac', [campo('cMun', e.codigoIbge), campo('CEP', digitos(e.cep))]),
    campo('xLgr', corta(e.logradouro.trim(), 255)),
    campo('nro', corta(e.numero?.trim() || 'S/N', 60)),
    campo('xCpl', e.complemento ? corta(e.complemento.trim(), 156) : null),
    campo('xBairro', corta(e.bairro?.trim() || 'Não informado', 60)),
  ])
}

/**
 * O vRetCSLL leva a soma das contribuições retidas que o tpRetPisCofins indica, não só a
 * CSLL: "indica quais contribuições retidas na fonte compõem o campo vRetCSLL" (Anexo I).
 * É ele que a Sefin desconta do líquido (vTotalRet = vRetCP + vRetIRRF + vRetCSLL + ISS).
 * Com 0 ou 2 (nada retido) o campo não pode ir (E0720).
 */
export function valorRetCsll(
  tipo: number | null,
  pis: number | null | undefined,
  cofins: number | null | undefined,
  csll: number | null | undefined,
): number {
  // Tipo → [PIS, COFINS, CSLL] retidos.
  const RETIDOS: Record<number, [boolean, boolean, boolean]> = {
    1: [true, true, false],
    3: [true, true, true],
    4: [true, true, false],
    5: [true, false, false],
    6: [false, true, false],
    7: [false, true, true],
    8: [false, false, true],
    9: [true, false, true],
  }
  const r = tipo == null ? undefined : RETIDOS[tipo]
  if (!r) return 0
  const soma = (r[0] ? (pis ?? 0) : 0) + (r[1] ? (cofins ?? 0) : 0) + (r[2] ? (csll ?? 0) : 0)
  return Math.round(soma * 100) / 100
}

/** O conteúdo do infDPS (sem a tag dele), na ordem do XSD (TCInfDPS). */
function corpoInfDps(d: DadosDps): string {
  const p = d.prestador
  const t = d.tomador
  const v = d.valores
  const docTomador = digitos(t.documento)
  const nt009 = d.leiaute === 'nt009'
  const descricao = campo('xDescServ', corta(d.servico.descricao.trim(), 2000))

  const regTrib = el('regTrib', [
    campo('opSimpNac', p.regimeSimples),
    // Regime de apuração só para ME/EPP optante (E0162).
    p.regimeSimples === '3' ? campo('regApTribSN', p.regimeApuracaoSimples) : null,
    campo('regEspTrib', p.regimeEspecial),
  ])

  const toma = el('toma', [
    campo(docTomador.length === 14 ? 'CNPJ' : 'CPF', docTomador),
    campo('IM', digitos(t.inscricaoMunicipal) || null),
    campo('xNome', corta(t.nome.trim(), 150)),
    t.endereco && endereco(t.endereco),
    t.email && t.email.length <= 80 ? campo('email', t.email) : null,
  ])

  const serv = el('serv', [
    el('locPrest', campo('cLocPrestacao', d.servico.municipioPrestacao)),
    el('cServ', [
      campo('cTribNac', d.servico.codigoTributacao),
      campo('cTribMun', digitos(d.servico.codigoMunicipal ?? '') || null),
      // Na NT 009 a descrição vai depois do NBS.
      nt009 ? null : descricao,
      campo('cNBS', digitos(d.servico.codigoNbs) || null),
      nt009 ? descricao : null,
    ]),
  ])

  const pc = v.pisCofins
  const tpRet = pc?.tipoRetencao ?? null
  const contribuicoesRetidas = valorRetCsll(tpRet, pc?.valorPis, pc?.valorCofins, v.retencoes.csll)
  const temRetFederal =
    (v.retencoes.inss ?? 0) > 0 || (v.retencoes.irrf ?? 0) > 0 || contribuicoesRetidas > 0
  const tribFed =
    pc || temRetFederal
      ? el('tribFed', [
          pc &&
            el('piscofins', [
              campo('CST', pc.cst),
              // Base, alíquotas e valores só quando há PIS/COFINS a destacar.
              pc.aliquotaPis != null || pc.aliquotaCofins != null
                ? campo('vBCPisCofins', dec(v.servico))
                : null,
              pc.aliquotaPis != null ? campo('pAliqPis', dec(pc.aliquotaPis)) : null,
              pc.aliquotaCofins != null ? campo('pAliqCofins', dec(pc.aliquotaCofins)) : null,
              pc.valorPis != null ? campo('vPis', dec(pc.valorPis)) : null,
              pc.valorCofins != null ? campo('vCofins', dec(pc.valorCofins)) : null,
              tpRet != null ? campo('tpRetPisCofins', tpRet) : null,
            ]),
          (v.retencoes.inss ?? 0) > 0 ? campo('vRetCP', dec(v.retencoes.inss!)) : null,
          (v.retencoes.irrf ?? 0) > 0 ? campo('vRetIRRF', dec(v.retencoes.irrf!)) : null,
          contribuicoesRetidas > 0 ? campo('vRetCSLL', dec(contribuicoesRetidas)) : null,
        ])
      : null

  const valores = el('valores', [
    el('vServPrest', campo('vServ', dec(v.servico))),
    el('trib', [
      el('tribMun', [
        campo('tribISSQN', v.tributacaoIss),
        v.tributacaoIss === '2' ? campo('tpImunidade', v.imunidade ?? '0') : null,
        campo('tpRetISSQN', v.issRetido ? '2' : '1'), // 2 = retido pelo tomador
        // A alíquota vem da parametrização do município no Sistema Nacional; só vai
        // quando o município não está no convênio (E0619).
        v.informarAliquotaIss && v.aliquotaIss != null ? campo('pAliq', dec(v.aliquotaIss)) : null,
      ]),
      tribFed,
      // Não optante do Simples: valor aproximado dos tributos (indTotTrib é proibido, E0713).
      el(
        'totTrib',
        p.regimeSimples === '3'
          ? campo('pTotTribSN', '0.00')
          : p.regimeSimples === '2'
            ? campo('indTotTrib', '0')
            : el('vTotTrib', [
                campo('vTotTribFed', '0.00'),
                campo('vTotTribEst', '0.00'),
                campo('vTotTribMun', '0.00'),
              ]),
      ),
    ]),
  ])

  const ibscbs = d.ibsCbs
    ? el('IBSCBS', [
        nt009 ? null : campo('finNFSe', '0'), // NFS-e regular
        campo('indFinal', '0'),
        campo('cIndOp', d.ibsCbs.indicadorOperacao),
        campo('indDest', '0'), // destinatário = o próprio tomador
        el(
          'valores',
          // Na NT 009, CST e classificação ficam direto em trib.
          nt009
            ? el('trib', [campo('CST', d.ibsCbs.cst), campo('cClassTrib', d.ibsCbs.classificacao)])
            : el(
                'trib',
                el('gIBSCBS', [
                  campo('CST', d.ibsCbs.cst),
                  campo('cClassTrib', d.ibsCbs.classificacao),
                ]),
              ),
        ),
      ])
    : null

  return [
    campo('tpAmb', d.ambiente === 'producao' ? '1' : '2'),
    campo('dhEmi', d.dhEmi),
    campo('verAplic', VER_APLIC),
    campo('serie', d.serie),
    campo('nDPS', d.numero),
    campo('dCompet', d.competencia),
    campo('tpEmit', '1'), // o prestador é o emitente
    nt009 ? campo('finNFSe', '0') : null, // NFS-e regular
    campo('cLocEmi', p.municipioIbge),
    d.substituicao
      ? el('subst', [
          campo('chSubstda', d.substituicao.chave),
          campo('cMotivo', d.substituicao.motivo),
          d.substituicao.justificativa ? campo('xMotivo', d.substituicao.justificativa) : null,
        ])
      : null,
    // Prestador emitente: CNPJ, IM e regime — sem nome nem endereço (E0121/E0128).
    el('prest', [
      campo('CNPJ', digitos(p.cnpj)),
      campo('IM', digitos(p.inscricaoMunicipal) || null),
      regTrib,
    ]),
    toma,
    serv,
    valores,
    ibscbs,
  ]
    .filter(Boolean)
    .join('')
}

// -----------------------------------------------------------------------------
// Assinatura (XMLDSig enveloped, RSA-SHA1, C14N 1.0), como no padrão NF-e/NFS-e.
// -----------------------------------------------------------------------------

function signedInfo(id: string, digest: string, comNamespace: boolean): string {
  return (
    `<SignedInfo${comNamespace ? ` xmlns="${NS_ASSINATURA}"` : ''}>` +
    `<CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="${NS_ASSINATURA}rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${id}"><Transforms>` +
    `<Transform Algorithm="${NS_ASSINATURA}enveloped-signature"></Transform>` +
    `<Transform Algorithm="${C14N}"></Transform>` +
    `</Transforms><DigestMethod Algorithm="${NS_ASSINATURA}sha1"></DigestMethod>` +
    `<DigestValue>${digest}</DigestValue></Reference></SignedInfo>`
  )
}

/** A DPS assinada, pronta para enviar, e o Id dela. */
export function montarDpsAssinada(d: DadosDps, cert: Certificado): { xml: string; id: string } {
  const id = idDps(d)
  const corpo = corpoInfDps(d)
  // Forma canônica do infDPS: o namespace herdado da raiz aparece nele.
  const digest = sha1Base64(`<infDPS xmlns="${NS}" Id="${id}">${corpo}</infDPS>`)
  const valorAssinatura = assinarSha1(cert, signedInfo(id, digest, true))
  const assinatura =
    `<Signature xmlns="${NS_ASSINATURA}">${signedInfo(id, digest, false)}` +
    `<SignatureValue>${valorAssinatura}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${cert.certBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DPS xmlns="${NS}" versao="${VERSAO_DPS}"><infDPS Id="${id}">${corpo}</infDPS>${assinatura}</DPS>`
  return { xml, id }
}

/** "2026-11-01T08:00:00-03:00", um minuto atrás (a Sefin recusa emissão "no futuro", E0008). */
export function agoraBrasilia(): string {
  const d = new Date(Date.now() - 60_000 - 3 * 3600_000)
  return d.toISOString().slice(0, 19) + '-03:00'
}

// -----------------------------------------------------------------------------
// Cancelamento (evento e101101), pelo pedRegEvento v1.01.
// -----------------------------------------------------------------------------

export type MotivoCancelamento = '1' | '2' | '9'

/** O pedido de cancelamento da NFS-e, assinado: vai em POST /nfse/{chave}/eventos. */
export function montarCancelamentoAssinado(
  d: {
    ambiente: 'producao' | 'homologacao'
    cnpj: string
    chave: string
    /** 1 erro na emissão, 2 serviço não prestado, 9 outros */
    motivo: MotivoCancelamento
    /** 15 a 255 caracteres */
    justificativa: string
  },
  cert: Certificado,
): string {
  const id = `PRE${d.chave}101101`
  const corpo = [
    campo('tpAmb', d.ambiente === 'producao' ? '1' : '2'),
    campo('verAplic', VER_APLIC),
    campo('dhEvento', agoraBrasilia()),
    campo('CNPJAutor', digitos(d.cnpj)),
    campo('chNFSe', d.chave),
    el('e101101', [
      campo('xDesc', 'Cancelamento de NFS-e'),
      campo('cMotivo', d.motivo),
      campo('xMotivo', corta(d.justificativa.replace(/\s+/g, ' ').trim(), 255)),
    ]),
  ].join('')
  const digest = sha1Base64(`<infPedReg xmlns="${NS}" Id="${id}">${corpo}</infPedReg>`)
  const valorAssinatura = assinarSha1(cert, signedInfo(id, digest, true))
  const assinatura =
    `<Signature xmlns="${NS_ASSINATURA}">${signedInfo(id, digest, false)}` +
    `<SignatureValue>${valorAssinatura}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${cert.certBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<pedRegEvento xmlns="${NS}" versao="${VERSAO_DPS}"><infPedReg Id="${id}">${corpo}</infPedReg>${assinatura}</pedRegEvento>`
  )
}
