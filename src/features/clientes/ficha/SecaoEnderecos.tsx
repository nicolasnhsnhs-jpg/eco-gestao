import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarCep } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'

import { useRemoverEndereco, useSalvarEndereco, type Endereco } from '../api'
import { EnderecoCampos } from '../EnderecoCampos'
import { ENDERECO_VAZIO, enderecoParaBanco, esquemaEndereco, type FormEndereco } from '../esquemas'
import { Secao, Vazio } from './Secao'

type Props = { clienteId: string; enderecos: Endereco[]; podeEditar: boolean }

export function SecaoEnderecos({ clienteId, enderecos, podeEditar }: Props) {
  // undefined = fechado; null = novo; Endereco = editando
  const [editando, setEditando] = useState<Endereco | null | undefined>(undefined)
  const remover = useRemoverEndereco(clienteId)

  async function aoRemover(endereco: Endereco) {
    if (!window.confirm(`Remover o endereço "${endereco.apelido || endereco.logradouro}"?`)) return
    try {
      await remover.mutateAsync(endereco.id)
    } catch (erro) {
      window.alert(mensagemDeErro(erro))
    }
  }

  return (
    <Secao
      titulo="Endereços"
      acao={
        podeEditar && (
          <Button variante="secundario" onClick={() => setEditando(null)}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </Button>
        )
      }
    >
      {enderecos.length === 0 && <Vazio>Nenhum endereço cadastrado.</Vazio>}
      <ul className="flex flex-col gap-3">
        {enderecos.map((e) => (
          <li key={e.id} className="flex gap-3 rounded-xl border border-borda p-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-verde" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {e.apelido || 'Endereço'}
                {e.principal && <Etiqueta cor="verde">Principal</Etiqueta>}
              </p>
              <p className="text-sm text-texto-suave">
                {[e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ')}
                <br />
                {[e.bairro, `${e.cidade}/${e.uf}`, e.cep && formatarCep(e.cep)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <a
                className="text-sm font-semibold text-verde underline"
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${e.logradouro} ${e.numero ?? ''}, ${e.cidade} - ${e.uf}`,
                )}`}
              >
                Abrir no mapa
              </a>
            </div>
            {podeEditar && (
              <div className="flex shrink-0 gap-1">
                <BotaoIcone rotulo="Editar endereço" onClick={() => setEditando(e)}>
                  <Pencil className="size-4" />
                </BotaoIcone>
                <BotaoIcone rotulo="Remover endereço" onClick={() => void aoRemover(e)}>
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
        titulo={editando ? 'Editar endereço' : 'Novo endereço'}
      >
        <FormEnderecoModal
          clienteId={clienteId}
          endereco={editando ?? null}
          primeiro={enderecos.length === 0}
          aoTerminar={() => setEditando(undefined)}
        />
      </Modal>
    </Secao>
  )
}

function FormEnderecoModal({
  clienteId,
  endereco,
  primeiro,
  aoTerminar,
}: {
  clienteId: string
  endereco: Endereco | null
  primeiro: boolean
  aoTerminar: () => void
}) {
  const salvar = useSalvarEndereco(clienteId)
  const form = useForm<FormEndereco>({
    resolver: zodResolver(esquemaEndereco),
    defaultValues: endereco
      ? {
          apelido: endereco.apelido ?? '',
          cep: formatarCep(endereco.cep),
          logradouro: endereco.logradouro,
          numero: endereco.numero ?? '',
          complemento: endereco.complemento ?? '',
          bairro: endereco.bairro ?? '',
          cidade: endereco.cidade,
          uf: endereco.uf,
          principal: endereco.principal,
        }
      : { ...ENDERECO_VAZIO, principal: primeiro },
  })

  async function enviar(dados: FormEndereco) {
    try {
      await salvar.mutateAsync({ id: endereco?.id, dados: enderecoParaBanco(dados) })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {form.formState.errors.root && (
        <Aviso tipo="erro">{form.formState.errors.root.message}</Aviso>
      )}
      <EnderecoCampos form={form} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-verde" {...form.register('principal')} />
        Endereço principal
      </label>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Salvando…' : 'Salvar endereço'}
      </Button>
    </form>
  )
}
