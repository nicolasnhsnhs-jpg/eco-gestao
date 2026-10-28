import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { useConfirmarLancamento, useContas, type LancamentoCompleto } from './api'
import { FORMAS, type FormaPagamento } from './rotulos'

const esquema = z.object({
  data_pagamento: z.string().min(1, 'Informe a data.'),
  valor_pago: z.string().refine((v) => (lerValor(v) ?? -1) >= 0, 'Informe o valor.'),
  conta_bancaria_id: z.string().min(1, 'Escolha a conta.'),
  forma_pagamento: z.enum(FORMAS.map((f) => f.valor) as [FormaPagamento, ...FormaPagamento[]]),
})
type Dados = z.infer<typeof esquema>

type Props = {
  lancamento: LancamentoCompleto | null
  aoFechar: () => void
}

/** "O dinheiro entrou?" — confirma o recebimento (ou pagamento) e atualiza o saldo. */
export function ConfirmarModal({ lancamento, aoFechar }: Props) {
  const entrada = lancamento?.tipo === 'entrada'
  return (
    <Modal
      aberto={!!lancamento}
      aoFechar={aoFechar}
      titulo={entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
    >
      {lancamento && <Formulario lancamento={lancamento} aoTerminar={aoFechar} />}
    </Modal>
  )
}

function Formulario({
  lancamento,
  aoTerminar,
}: {
  lancamento: LancamentoCompleto
  aoTerminar: () => void
}) {
  const contas = useContas()
  const confirmar = useConfirmarLancamento()
  const ativas = (contas.data ?? []).filter((c) => c.ativo)

  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    values: {
      data_pagamento: hojeISO(),
      valor_pago: valorParaCampo(lancamento.valor),
      conta_bancaria_id: lancamento.conta_bancaria_id ?? ativas[0]?.id ?? '',
      forma_pagamento: lancamento.forma_pagamento ?? 'pix',
    },
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isSubmitting } = form.formState
  const valorCampo = form.register('valor_pago')

  async function enviar(dados: Dados) {
    try {
      await confirmar.mutateAsync({
        id: lancamento.id!,
        dados: { ...dados, valor_pago: lerValor(dados.valor_pago)! },
      })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  const nomeContraparte =
    lancamento.cliente?.nome_fantasia || lancamento.cliente?.nome || lancamento.fornecedor?.nome

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      <div className="rounded-xl bg-fundo-suave p-3 text-sm">
        <p className="font-semibold">{lancamento.descricao}</p>
        <p className="text-texto-suave">
          {[nomeContraparte, `vence ${formatarData(lancamento.vencimento)}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1 text-lg font-bold">{formatarReais(lancamento.valor)}</p>
      </div>

      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      {contas.isSuccess && ativas.length === 0 && (
        <Aviso tipo="erro">
          Cadastre uma conta bancária antes de confirmar.{' '}
          <Link to="/financeiro/cadastros" className="font-semibold underline">
            Ir para cadastros
          </Link>
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo={lancamento.tipo === 'entrada' ? 'Data em que entrou' : 'Data em que saiu'}
          htmlFor="data_pagamento"
          erro={errors.data_pagamento?.message}
        >
          <Input id="data_pagamento" type="date" {...form.register('data_pagamento')} />
        </Campo>
        <Campo
          rotulo="Valor (R$)"
          htmlFor="valor_pago"
          erro={errors.valor_pago?.message}
          dica="Com juros ou desconto, ajuste aqui."
        >
          <Input
            id="valor_pago"
            inputMode="numeric"
            {...valorCampo}
            onChange={(e) => {
              e.target.value = mascaraValor(e.target.value)
              void valorCampo.onChange(e)
            }}
          />
        </Campo>
        <Campo rotulo="Conta" htmlFor="conta" erro={errors.conta_bancaria_id?.message}>
          <Select id="conta" {...form.register('conta_bancaria_id')}>
            <option value="">Escolha…</option>
            {ativas.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Forma" htmlFor="forma">
          <Select id="forma" {...form.register('forma_pagamento')}>
            {FORMAS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </Select>
        </Campo>
      </div>

      <Button type="submit" disabled={isSubmitting || ativas.length === 0}>
        {isSubmitting
          ? 'Confirmando…'
          : lancamento.tipo === 'entrada'
            ? 'Confirmar que entrou'
            : 'Confirmar que foi pago'}
      </Button>
    </form>
  )
}
