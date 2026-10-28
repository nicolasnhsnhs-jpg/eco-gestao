import { zodResolver } from '@hookform/resolvers/zod'
import { MessageSquarePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarDataHora, paraCampoDataHora } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { usePerfil } from '../../auth/useAuth'
import { useAtendimentos, useRegistrarAtendimento, useRemoverAtendimento } from '../api'
import { CANAIS, esquemaAtendimento, type FormAtendimento } from '../esquemas'
import { Secao, Vazio } from './Secao'

const NOME_CANAL = Object.fromEntries(CANAIS.map((c) => [c.valor, c.rotulo]))

/** Linha do tempo dos contatos com o cliente: quem atendeu, quando e o que foi tratado. */
export function SecaoAtendimentos({ clienteId }: { clienteId: string }) {
  const perfil = usePerfil()
  const atendimentos = useAtendimentos(clienteId)
  const remover = useRemoverAtendimento(clienteId)
  const [novo, setNovo] = useState(false)

  async function aoRemover(id: string) {
    if (!window.confirm('Apagar este registro de atendimento?')) return
    try {
      await remover.mutateAsync(id)
    } catch (erro) {
      window.alert(mensagemDeErro(erro))
    }
  }

  return (
    <Secao
      titulo="Atendimentos"
      acao={
        <Button variante="secundario" onClick={() => setNovo(true)}>
          <MessageSquarePlus className="size-4" aria-hidden /> Registrar
        </Button>
      }
    >
      {atendimentos.isPending && <Carregando />}
      {atendimentos.isError && <Aviso tipo="erro">{mensagemDeErro(atendimentos.error)}</Aviso>}
      {atendimentos.data?.length === 0 && (
        <Vazio>Nenhum atendimento registrado. Registre cada contato com o cliente aqui.</Vazio>
      )}

      <ol className="flex flex-col gap-4 border-l-2 border-lima-claro pl-4">
        {atendimentos.data?.map((a) => {
          const podeApagar =
            a.usuario_id === perfil.id || PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
          return (
            <li key={a.id} className="relative">
              <span className="absolute top-1.5 -left-[23px] size-3 rounded-full bg-verde" />
              <div className="flex items-start justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
                  <strong className="text-texto">{a.usuario?.nome ?? 'Usuário'}</strong>
                  {formatarDataHora(a.data_hora)}
                  <Etiqueta>{NOME_CANAL[a.canal]}</Etiqueta>
                </p>
                {podeApagar && (
                  <BotaoIcone rotulo="Apagar atendimento" onClick={() => void aoRemover(a.id)}>
                    <Trash2 className="size-4" />
                  </BotaoIcone>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line">{a.resumo}</p>
            </li>
          )
        })}
      </ol>

      <Modal aberto={novo} aoFechar={() => setNovo(false)} titulo="Registrar atendimento">
        <FormAtendimentoModal clienteId={clienteId} aoTerminar={() => setNovo(false)} />
      </Modal>
    </Secao>
  )
}

function FormAtendimentoModal({
  clienteId,
  aoTerminar,
}: {
  clienteId: string
  aoTerminar: () => void
}) {
  const registrar = useRegistrarAtendimento(clienteId)
  const form = useForm<FormAtendimento>({
    resolver: zodResolver(esquemaAtendimento),
    defaultValues: { canal: 'whatsapp', data_hora: paraCampoDataHora(), resumo: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function enviar(dados: FormAtendimento) {
    try {
      await registrar.mutateAsync({
        canal: dados.canal,
        resumo: dados.resumo,
        data_hora: new Date(dados.data_hora).toISOString(),
      })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Canal" htmlFor="canal">
          <Select id="canal" {...form.register('canal')}>
            {CANAIS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Quando" htmlFor="data_hora" erro={errors.data_hora?.message}>
          <Input id="data_hora" type="datetime-local" {...form.register('data_hora')} />
        </Campo>
      </div>
      <Campo rotulo="O que foi tratado" htmlFor="resumo" obrigatorio erro={errors.resumo?.message}>
        <Textarea
          id="resumo"
          rows={5}
          data-autofocus
          aria-invalid={!!errors.resumo}
          {...form.register('resumo')}
        />
      </Campo>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar atendimento'}
      </Button>
    </form>
  )
}
