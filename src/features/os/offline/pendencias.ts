import type { CamposExecucao } from '../api'
import type { ChecklistAgua } from '../tipos/agua'
import { aparelhoIncompleto, type ChecklistAr } from '../tipos/arCondicionado'
import type { ChecklistBebedouro } from '../tipos/bebedouro'
import type { ChecklistCoifa } from '../tipos/coifa'
import { ESPECIES, type ChecklistPragas } from '../tipos/pragas'
import type { ChecklistTelas } from '../tipos/telas'

/*
 * O que falta para concluir a OS — a MESMA regra de privado.pendencias_os no banco
 * (migration 20261227120100_os_agua_ar_condicionado.sql). O celular usa esta cópia para concluir
 * sem internet; quando o sinal volta, o banco confere de novo e é quem garante.
 * Se mudar uma, mude a outra (os testes de pendencias.test.ts e de os*.sql ajudam).
 */

type Ponto = {
  tipo: string
  numero: number
  area: string
  situacao_armadilha?: string | null
  capturas?: unknown
  sujidade?: string | null
  limpo?: boolean | null
  coletado?: boolean | null
  hora_coleta?: string | null
  limpeza_serpentina?: string | null
  limpeza_gabinete?: string | null
  limpeza_dreno?: string | null
  foto_etiqueta?: boolean | null
  fotos_limpeza?: boolean | null
}

/** Todas as espécies da ficha com número (0 quando a armadilha não pegou nada). */
export function capturasCompletas(capturas: unknown) {
  const c = (capturas ?? {}) as Record<string, unknown>
  return Object.keys(ESPECIES).every((codigo) => typeof c[codigo] === 'number')
}

const vazio = (texto: unknown) => typeof texto !== 'string' || texto.trim() === ''

const ORDEM_HORARIOS = [
  ['hora_chegada', 'a chegada', 'da chegada'],
  ['hora_inicio', 'o início', 'do início'],
  ['hora_termino', 'o término', 'do término'],
  ['hora_saida', 'a saída', 'da saída'],
] as const

const hhmm = (valor: string) =>
  new Date(valor).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

/**
 * A mesma regra de os_execucao.horarios_em_ordem: chegada ≤ início ≤ término ≤
 * saída. Devolve o primeiro problema, em português, ou null.
 */
export function horariosForaDeOrdem(e: CamposExecucao): string | null {
  const preenchidos = ORDEM_HORARIOS.filter(([campo]) => !!e[campo])
  for (let i = 1; i < preenchidos.length; i++) {
    const [campoAntes, , nomeAntes] = preenchidos[i - 1]
    const [campo, nome] = preenchidos[i]
    const antes = e[campoAntes]!
    const depois = e[campo]!
    if (new Date(depois).getTime() < new Date(antes).getTime()) {
      return `${nome} (${hhmm(depois)}) está antes ${nomeAntes} (${hhmm(antes)})`
    }
  }
  return null
}

/** Fotos de antes e depois da OS (as que já subiram e as que estão no celular). */
export type FotosDaOs = { exigidas: boolean; antes: number; depois: number }

export function pendenciasLocais(
  formulario:
    | 'generico'
    | 'pragas'
    | 'coifa'
    | 'bebedouro'
    | 'telas'
    | 'agua'
    | 'ar_condicionado'
    | string
    | undefined,
  e: CamposExecucao,
  pontos: Ponto[],
  fotos?: FotosDaOs,
  /** Ocorrência que o escritório escreveu na OS (o técnico confirma que resolveu). */
  ocorrencia?: string | null,
): string[] {
  const falta: string[] = []
  if (!e.data) falta.push('data')
  if (!e.hora_chegada) falta.push('horário de chegada')
  if (!e.hora_inicio) falta.push('horário de início')
  if (!e.hora_termino) falta.push('horário de término')
  if (!e.hora_saida) falta.push('horário de saída')
  if ((formulario === 'generico' || formulario === 'pragas_simples') && vazio(e.resultado)) {
    falta.push('resultado do serviço')
  }
  if (vazio(e.operador_nome)) falta.push('nome do operador')
  if (!e.assinatura_operador_id) falta.push('visto do operador')
  // Quem acompanhou: nome, setor e assinatura, a não ser que ninguém tenha acompanhado.
  if (!e.sem_acompanhamento) {
    if (vazio(e.responsavel_nome)) falta.push('nome de quem acompanhou')
    if (vazio(e.responsavel_setor)) falta.push('setor de quem acompanhou')
    if (!e.assinatura_cliente_id) falta.push('assinatura de quem acompanhou')
  }
  if (!vazio(ocorrencia) && !e.ocorrencia_resolvida) falta.push('confirmação da ocorrência')

  if (formulario === 'pragas') {
    const c = (e.checklist ?? {}) as ChecklistPragas
    if (!c.nivel_infestacao || !['B', 'M', 'A'].includes(c.nivel_infestacao)) {
      falta.push('nível de infestação de roedores')
    }
    const semSituacao = pontos
      .filter((p) => p.tipo === 'armadilha_luminosa' && !p.situacao_armadilha)
      .map((p) => p.numero)
      .sort((a, b) => a - b)
    if (semSituacao.length) falta.push(`situação das armadilhas ${semSituacao.join(', ')}`)
    const semCapturas = pontos
      .filter((p) => p.tipo === 'armadilha_luminosa' && !capturasCompletas(p.capturas))
      .map((p) => p.numero)
      .sort((a, b) => a - b)
    if (semCapturas.length) falta.push(`capturas das armadilhas ${semCapturas.join(', ')}`)
  }

  if (formulario === 'coifa') {
    const c = (e.checklist ?? {}) as ChecklistCoifa
    const l = c.liberacao ?? {}
    const perguntas = [
      'area_isolada',
      'producao_livre',
      'pintada',
      'risco_pintura',
      'equipamentos_desligados',
      'motor_desligado',
      'gas_fechado',
    ] as const
    if (perguntas.some((p) => typeof l[p]?.sim !== 'boolean')) falta.push('liberação para trabalho')
    if (!l.condicoes || !['LE', 'LR', 'LI'].includes(l.condicoes))
      falta.push('condições do ambiente')
    if (!l.escoamento || !['eficiente', 'regular', 'ineficiente'].includes(l.escoamento)) {
      falta.push('escoamento do piso')
    }
    const semSujidade = pontos
      .filter((p) => p.tipo === 'coifa' && !p.sujidade)
      .sort((a, b) => a.numero - b.numero)
      .map((p) => p.area)
    if (semSujidade.length) falta.push(`sujidade de: ${semSujidade.join(', ')}`)
    if (typeof c.produto_ml !== 'number') falta.push('quantidade de produto')
    const finais = ['limpeza_eficiente', 'equipamentos_religados', 'ambiente_liberado'] as const
    if (finais.some((p) => typeof c.conferencia?.[p]?.sim !== 'boolean')) {
      falta.push('conferência final com o cliente')
    }
  }

  if (formulario === 'bebedouro') {
    const c = (e.checklist ?? {}) as ChecklistBebedouro
    if (!c.trabalho || !['preventivo', 'corretivo'].includes(c.trabalho)) {
      falta.push('preventivo ou corretivo')
    }
    const semResposta = pontos
      .filter((p) => (p.tipo === 'bebedouro' || p.tipo === 'bebedouro_garrafao') && p.limpo == null)
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero - b.numero)
      .map((p) => p.area)
    if (semResposta.length) falta.push(`limpeza de: ${semResposta.join(', ')}`)
    const finais = ['todos_limpos', 'danificados'] as const
    if (finais.some((p) => typeof c.conferencia?.[p]?.sim !== 'boolean')) {
      falta.push('conferência com o cliente')
    }
  }

  if (formulario === 'telas') {
    const c = (e.checklist ?? {}) as ChecklistTelas
    if (typeof c.autorizado?.sim !== 'boolean') falta.push('liberação para instalação de telas')
    if (typeof c.instaladas?.sim !== 'boolean') falta.push('conferência com o cliente')
  }

  if (formulario === 'reservatorio') {
    const sem = pontos
      .filter((p) => p.tipo === 'reservatorio' && p.limpo == null)
      .sort((a, b) => a.numero - b.numero)
      .map((p) => p.area)
    if (sem.length) falta.push(`reservatórios: ${sem.join(', ')}`)
  }

  if (formulario === 'agua') {
    const c = (e.checklist ?? {}) as ChecklistAgua
    if (c.procedimento !== true) falta.push('confirmação do procedimento de coleta')
    const semColeta = pontos
      .filter(
        (p) => p.tipo === 'ponto_coleta' && (p.coletado == null || (p.coletado && !p.hora_coleta)),
      )
      .sort((a, b) => a.numero - b.numero)
      .map((p) => p.area)
    if (semColeta.length) falta.push(`coleta de: ${semColeta.join(', ')}`)
    if (typeof c.refrigeradas?.sim !== 'boolean') falta.push('conservação das amostras')
  }

  if (formulario === 'ar_condicionado') {
    const c = (e.checklist ?? {}) as ChecklistAr
    const incompletos = pontos
      .filter((p) => p.tipo === 'ar_condicionado' && aparelhoIncompleto(p))
      .map((p) => p.numero)
      .sort((a, b) => a - b)
      .map((n) => String(n).padStart(2, '0'))
    if (incompletos.length) falta.push(`ar-condicionado: ${incompletos.join(', ')}`)
    if (typeof c.produto_ml !== 'number') falta.push('quantidade de produto')
  }

  // Serviços de limpeza: pelo menos uma foto de antes e uma de depois.
  if (fotos?.exigidas) {
    if (fotos.antes === 0) falta.push('foto antes do serviço')
    if (fotos.depois === 0) falta.push('foto após o serviço')
  }
  return falta
}

/**
 * Em que etapa da tela do operador se preenche cada pendência de pendenciasLocais
 * (o título da etapa, como aparece na tela). Serve para levar o operador até lá.
 */
export function etapaDaPendencia(pendencia: string): string | null {
  if (pendencia === 'horário de término' || pendencia === 'horário de saída') {
    return 'Término e saída'
  }
  if (pendencia === 'data' || pendencia.startsWith('horário de')) return 'Chegada e horários'
  if (pendencia === 'resultado do serviço') return 'Serviço realizado'
  if (pendencia === 'nome do operador' || pendencia === 'visto do operador') return 'Operador'
  if (pendencia.includes('quem acompanhou')) return 'Quem acompanhou (cliente)'
  if (pendencia === 'confirmação da ocorrência') return 'Ocorrência'
  if (pendencia === 'nível de infestação de roedores') return 'Porta-iscas'
  if (
    pendencia.startsWith('situação das armadilhas') ||
    pendencia.startsWith('capturas das armadilhas')
  ) {
    return 'Armadilhas luminosas'
  }
  if (
    pendencia === 'liberação para trabalho' ||
    pendencia === 'condições do ambiente' ||
    pendencia === 'escoamento do piso'
  ) {
    return 'Liberação para trabalho'
  }
  if (pendencia === 'liberação para instalação de telas') {
    return 'Liberação para instalação de telas'
  }
  if (pendencia.startsWith('sujidade de')) return 'Coifas'
  if (pendencia === 'quantidade de produto') return 'Produto utilizado'
  if (
    pendencia === 'conferência final com o cliente' ||
    pendencia === 'conferência com o cliente'
  ) {
    return 'Conferência com o cliente'
  }
  if (pendencia === 'preventivo ou corretivo') return 'Trabalho a ser realizado'
  if (pendencia.startsWith('limpeza de:')) return 'Bebedouros'
  if (pendencia === 'confirmação do procedimento de coleta') return 'Procedimento de coleta'
  if (pendencia.startsWith('coleta de:')) return 'Pontos de coleta'
  if (pendencia === 'conservação das amostras') return 'Amostras'
  if (pendencia.startsWith('reservatórios:')) return 'Reservatórios'
  if (pendencia.startsWith('ar-condicionado:')) return 'Aparelhos de ar-condicionado'
  // A foto de antes fica na chegada (para não esquecer); a de depois, no fim.
  if (pendencia === 'foto antes do serviço') return 'Chegada e horários'
  if (pendencia === 'foto após o serviço') return 'Relatório fotográfico'
  return null
}
