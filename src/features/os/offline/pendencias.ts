import type { CamposExecucao } from '../api'
import type { ChecklistCoifa } from '../tipos/coifa'
import type { ChecklistPragas } from '../tipos/pragas'

/*
 * O que falta para concluir a OS — a MESMA regra de privado.pendencias_os no banco
 * (migration 20261106120100_os_coifa.sql). O celular usa esta cópia para concluir
 * sem internet; quando o sinal volta, o banco confere de novo e é quem garante.
 * Se mudar uma, mude a outra (os testes de pendencias.test.ts e de os*.sql ajudam).
 */

type Ponto = {
  tipo: string
  numero: number
  area: string
  situacao_armadilha?: string | null
  sujidade?: string | null
}

const vazio = (texto: unknown) => typeof texto !== 'string' || texto.trim() === ''

export function pendenciasLocais(
  formulario: 'generico' | 'pragas' | 'coifa' | string | undefined,
  e: CamposExecucao,
  pontos: Ponto[],
): string[] {
  const falta: string[] = []
  if (!e.data) falta.push('data')
  if (!e.hora_chegada) falta.push('horário de chegada')
  if (!e.hora_inicio) falta.push('horário de início')
  if (!e.hora_termino) falta.push('horário de término')
  if (!e.hora_saida) falta.push('horário de saída')
  if (formulario === 'generico' && vazio(e.resultado)) falta.push('resultado do serviço')
  if (vazio(e.operador_nome)) falta.push('nome do operador')
  if (!e.assinatura_operador_id) falta.push('visto do operador')
  if (vazio(e.responsavel_nome)) falta.push('nome de quem acompanhou')
  if (!e.assinatura_cliente_id) falta.push('assinatura de quem acompanhou')

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
  return falta
}
