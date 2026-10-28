import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Campo, Input, Select } from '@/components/ui/Campo'
import { buscarCep, formatarCep } from '@/lib/documentos'

import { UFS, type FormEndereco } from './esquemas'

/** Campos de endereço. Ao digitar o CEP, preenche rua, bairro, cidade e estado sozinho. */
export function EnderecoCampos({ form }: { form: UseFormReturn<FormEndereco> }) {
  const { errors } = form.formState
  const [buscando, setBuscando] = useState(false)
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false)

  async function aoMudarCep(valor: string) {
    const formatado = formatarCep(valor)
    form.setValue('cep', formatado)
    setCepNaoEncontrado(false)
    if (formatado.length !== 9) return

    setBuscando(true)
    const endereco = await buscarCep(formatado)
    setBuscando(false)
    if (!endereco) {
      setCepNaoEncontrado(true)
      return
    }
    const opcoes = { shouldValidate: true }
    if (endereco.logradouro) form.setValue('logradouro', endereco.logradouro, opcoes)
    if (endereco.bairro) form.setValue('bairro', endereco.bairro, opcoes)
    form.setValue('cidade', endereco.cidade, opcoes)
    form.setValue('uf', endereco.uf, opcoes)
    form.setFocus('numero')
  }

  return (
    <div className="grid grid-cols-6 gap-4">
      <Campo
        rotulo="CEP"
        htmlFor="cep"
        className="col-span-3 sm:col-span-2"
        erro={errors.cep?.message ?? (cepNaoEncontrado ? 'CEP não encontrado.' : undefined)}
      >
        <div className="relative">
          <Input
            id="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            {...form.register('cep')}
            onChange={(e) => void aoMudarCep(e.target.value)}
          />
          {buscando && (
            <LoaderCircle
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-texto-suave"
              aria-label="Buscando CEP"
            />
          )}
        </div>
      </Campo>
      <Campo
        rotulo="Identificação"
        htmlFor="apelido"
        className="col-span-3 sm:col-span-4"
        dica="Ex.: Matriz, Loja Centro"
      >
        <Input id="apelido" {...form.register('apelido')} />
      </Campo>
      <Campo
        rotulo="Rua"
        htmlFor="logradouro"
        obrigatorio
        className="col-span-6 sm:col-span-4"
        erro={errors.logradouro?.message}
      >
        <Input
          id="logradouro"
          autoComplete="address-line1"
          aria-invalid={!!errors.logradouro}
          {...form.register('logradouro')}
        />
      </Campo>
      <Campo rotulo="Número" htmlFor="numero" className="col-span-2">
        <Input id="numero" {...form.register('numero')} />
      </Campo>
      <Campo rotulo="Complemento" htmlFor="complemento" className="col-span-4 sm:col-span-3">
        <Input id="complemento" {...form.register('complemento')} />
      </Campo>
      <Campo rotulo="Bairro" htmlFor="bairro" className="col-span-6 sm:col-span-3">
        <Input id="bairro" {...form.register('bairro')} />
      </Campo>
      <Campo
        rotulo="Cidade"
        htmlFor="cidade"
        obrigatorio
        className="col-span-4"
        erro={errors.cidade?.message}
      >
        <Input id="cidade" aria-invalid={!!errors.cidade} {...form.register('cidade')} />
      </Campo>
      <Campo rotulo="UF" htmlFor="uf" obrigatorio className="col-span-2" erro={errors.uf?.message}>
        <Select id="uf" {...form.register('uf')}>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </Select>
      </Campo>
    </div>
  )
}
