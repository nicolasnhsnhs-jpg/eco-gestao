import type { ChangeEvent, ComponentProps } from 'react'
import { useController, type Control, type FieldValues, type Path } from 'react-hook-form'

import { Select } from './Campo'

type Props<T extends FieldValues> = Omit<ComponentProps<'select'>, 'name' | 'value'> & {
  control: Control<T>
  name: Path<T>
}

/**
 * Lista de opções ligada ao formulário e sempre "controlada" (value = valor do formulário).
 *
 * Por que existe: quando as opções vêm do banco (tipos de serviço, categorias, contas…),
 * elas chegam depois que o formulário já foi montado. Uma lista comum perderia o valor
 * pré-preenchido; esta mostra a opção certa assim que ela aparece.
 */
export function SelectForm<T extends FieldValues>({ control, name, onChange, ...props }: Props<T>) {
  // "aoMontar" é a função que o React Hook Form usa para pôr o foco no campo com erro.
  const {
    field: { ref: aoMontar, value, onChange: mudarValor, onBlur, name: nomeCampo },
  } = useController({ control, name })
  return (
    <Select
      {...props}
      ref={aoMontar}
      name={nomeCampo}
      value={value ?? ''}
      onBlur={onBlur}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        mudarValor(e.target.value)
        onChange?.(e)
      }}
    />
  )
}
