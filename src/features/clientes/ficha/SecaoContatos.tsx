import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { ehCelular, formatarTelefone, linkWhatsapp } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'

import { useRemoverContato, useSalvarContato, type Contato } from '../api'
import { contatoParaBanco, esquemaContato, type FormContato } from '../esquemas'
import { Secao, Vazio } from './Secao'

type Props = { clienteId: string; contatos: Contato[]; podeEditar: boolean }

/** Pessoas de contato dentro do cliente (ex.: gerente, responsável pela manutenção). */
export function SecaoContatos({ clienteId, contatos, podeEditar }: Props) {
  const [editando, setEditando] = useState<Contato | null | undefined>(undefined)
  const remover = useRemoverContato(clienteId)

  async function aoRemover(contato: Contato) {
    if (!window.confirm(`Remover o contato "${contato.nome}"?`)) return
    try {
      await remover.mutateAsync(contato.id)
    } catch (erro) {
      window.alert(mensagemDeErro(erro))
    }
  }

  return (
    <Secao
      titulo="Pessoas de contato"
      acao={
        podeEditar && (
          <Button variante="secundario" onClick={() => setEditando(null)}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </Button>
        )
      }
    >
      {contatos.length === 0 && <Vazio>Nenhuma pessoa de contato cadastrada.</Vazio>}
      <ul className="flex flex-col gap-3">
        {contatos.map((c) => (
          <li key={c.id} className="flex gap-3 rounded-xl border border-borda p-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {c.nome}
                {c.cargo && <span className="font-normal text-texto-suave">· {c.cargo}</span>}
                {c.principal && <Etiqueta cor="verde">Principal</Etiqueta>}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {c.telefone && (
                  <>
                    <a
                      href={`tel:${c.telefone}`}
                      className="inline-flex items-center gap-1 text-verde"
                    >
                      <Phone className="size-4" aria-hidden />
                      {formatarTelefone(c.telefone)}
                    </a>
                    {ehCelular(c.telefone) && (
                      <a
                        href={linkWhatsapp(c.telefone)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-verde underline"
                      >
                        WhatsApp
                      </a>
                    )}
                  </>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center gap-1 text-verde"
                  >
                    <Mail className="size-4" aria-hidden />
                    {c.email}
                  </a>
                )}
              </div>
              {c.observacoes && <p className="mt-1 text-sm text-texto-suave">{c.observacoes}</p>}
            </div>
            {podeEditar && (
              <div className="flex shrink-0 gap-1">
                <BotaoIcone rotulo="Editar contato" onClick={() => setEditando(c)}>
                  <Pencil className="size-4" />
                </BotaoIcone>
                <BotaoIcone rotulo="Remover contato" onClick={() => void aoRemover(c)}>
                  <Trash2 className="size-4" />
                </BotaoIcone>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal
        aberto={editando !== undefined}
        aoFechar={() => setEditando(undefined)}
        titulo={editando ? 'Editar contato' : 'Nova pessoa de contato'}
      >
        <FormContatoModal
          clienteId={clienteId}
          contato={editando ?? null}
          aoTerminar={() => setEditando(undefined)}
        />
      </Modal>
    </Secao>
  )
}

function FormContatoModal({
  clienteId,
  contato,
  aoTerminar,
}: {
  clienteId: string
  contato: Contato | null
  aoTerminar: () => void
}) {
  const salvar = useSalvarContato(clienteId)
  const form = useForm<FormContato>({
    resolver: zodResolver(esquemaContato),
    defaultValues: {
      nome: contato?.nome ?? '',
      cargo: contato?.cargo ?? '',
      telefone: formatarTelefone(contato?.telefone),
      email: contato?.email ?? '',
      principal: contato?.principal ?? false,
      observacoes: contato?.observacoes ?? '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const telefone = form.register('telefone')

  async function enviar(dados: FormContato) {
    try {
      await salvar.mutateAsync({ id: contato?.id, dados: contatoParaBanco(dados) })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <Campo rotulo="Nome" htmlFor="contato-nome" obrigatorio erro={errors.nome?.message}>
        <Input id="contato-nome" aria-invalid={!!errors.nome} {...form.register('nome')} />
      </Campo>
      <Campo rotulo="Cargo / função" htmlFor="contato-cargo">
        <Input id="contato-cargo" {...form.register('cargo')} />
      </Campo>
      <Campo
        rotulo="Telefone / WhatsApp"
        htmlFor="contato-telefone"
        erro={errors.telefone?.message}
      >
        <Input
          id="contato-telefone"
          type="tel"
          inputMode="tel"
          aria-invalid={!!errors.telefone}
          {...telefone}
          onChange={(e) => {
            e.target.value = formatarTelefone(e.target.value)
            void telefone.onChange(e)
          }}
        />
      </Campo>
      <Campo rotulo="E-mail" htmlFor="contato-email" erro={errors.email?.message}>
        <Input
          id="contato-email"
          type="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          {...form.register('email')}
        />
      </Campo>
      <Campo rotulo="Observações" htmlFor="contato-obs">
        <Textarea id="contato-obs" {...form.register('observacoes')} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-verde" {...form.register('principal')} />
        Contato principal
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar contato'}
      </Button>
    </form>
  )
}
