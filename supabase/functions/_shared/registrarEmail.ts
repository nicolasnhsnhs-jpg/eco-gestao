// Guarda o e-mail que acabou de sair (tabela emails_enviados), para a aba "E-mails
// enviados" de cada setor. Se a gravação falhar, o e-mail já foi: só fica no log,
// nunca vira erro para quem enviou.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type RegistroEmail = {
  setor: 'financeiro' | 'administrativo' | 'comercial'
  tipo: 'nota' | 'proposta' | 'certificado' | 'os'
  clienteId: string | null
  clienteNome: string
  para: string[]
  copiaOculta?: string[]
  remetente?: string | null
  assunto: string
  descricao: string
  valor?: number | null
  anexos: string[]
  notaId?: string | null
  propostaId?: string | null
  certificadoId?: string | null
  osIds?: string[]
  enviadoPor?: string | null
  automatico?: boolean
  /** Resposta do Resend ({ id }). */
  respostaResend?: unknown
}

export async function registrarEmailEnviado(admin: SupabaseClient, r: RegistroEmail) {
  const resendId =
    r.respostaResend && typeof r.respostaResend === 'object' && 'id' in r.respostaResend
      ? String((r.respostaResend as { id: unknown }).id)
      : null
  const { error } = await admin.from('emails_enviados').insert({
    setor: r.setor,
    tipo: r.tipo,
    cliente_id: r.clienteId,
    cliente_nome: r.clienteNome,
    para: r.para.join('; '),
    copia_oculta: r.copiaOculta?.length ? r.copiaOculta.join('; ') : null,
    remetente: r.remetente ?? null,
    assunto: r.assunto,
    descricao: r.descricao,
    valor: r.valor ?? null,
    anexos: r.anexos,
    nota_id: r.notaId ?? null,
    proposta_id: r.propostaId ?? null,
    certificado_id: r.certificadoId ?? null,
    os_ids: r.osIds ?? [],
    enviado_por: r.enviadoPor ?? null,
    automatico: r.automatico ?? false,
    resend_id: resendId,
  })
  if (error) console.error('emails_enviados', error.message)
}
