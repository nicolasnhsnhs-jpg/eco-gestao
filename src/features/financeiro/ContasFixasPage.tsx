import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Repeat } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import {
  useCategorias,
  useContas,
  useContasFixas,
  useSalvarContaFixa,
  type ContaFixaCompleta,
} from './api'
import { FORMAS, NOME_FORMA, type FormaPagamento } from './rotulos'

/** /financeiro/contas-fixas — aluguel, internet… lançados sozinhos todo mês. */
export function ContasFixasPage() {
  const fixas = useContasFixas()
  const [editando, setEditando] = useState<ContaFixaCompleta | null>(null)

  if (fixas.isPending) return <Carregando />
  if (fixas.isError) return <Aviso tipo="erro">{mensagemDeErro(fixas.error)}</Aviso>

  const ativas = fixas.data.filter((f) => f.ativo)
  const encerradas = fixas.data.filter((f) => !f.ativo)
  const somar = (tipo: 'entrada' | 'saida') =>
    ativas.filter((f) => f.tipo === tipo).reduce((s, f) => s + Number(f.valor), 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-texto-suave">
          Cadastradas uma vez, as contas fixas aparecem sozinhas nos lançamentos de cada mês,
          pendentes e com o vencimento no mesmo dia. No dia, é só confirmar o pagamento.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/financeiro/lancamentos/novo?tipo=saida&fixa=1"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden /> Conta fixa a pagar
          </Link>
          <Link
            to="/financeiro/lancamentos/novo?tipo=entrada&fixa=1"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Plus className="size-5" aria-hidden /> Receita fixa
          </Link>
        </div>
      </div>

      {fixas.data.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhuma conta fixa ainda. Ao lançar uma conta, marque “Repete todo mês”.
        </Card>
      )}

      {ativas.length > 0 && (
        <>
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
            {ativas.map((f) => (
              <LinhaContaFixa key={f.id} fixa={f} aoEditar={() => setEditando(f)} />
            ))}
          </ul>
          <div className="-mt-2 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
            <span>
              Por mês · A receber:{' '}
              <strong className="text-verde">{formatarReais(somar('entrada'))}</strong>
            </span>
            <span>
              A pagar: <strong className="text-perigo">{formatarReais(somar('saida'))}</strong>
            </span>
          </div>
        </>
      )}

      {encerradas.length > 0 && (
        <details className="rounded-2xl border border-borda bg-white">
          <summary className="cursor-pointer px-4 py-3 font-semibold">
            Encerradas ({encerradas.length})
          </summary>
          <ul className="divide-y divide-borda border-t border-borda">
            {encerradas.map((f) => (
              <LinhaContaFixa key={f.id} fixa={f} aoEditar={() => setEditando(f)} />
            ))}
          </ul>
        </details>
      )}

      <Modal aberto={!!editando} aoFechar={() => setEditando(null)} titulo="Editar conta fixa">
        {editando && (
          <FormContaFixa key={editando.id} fixa={editando} aoTerminar={() => setEditando(null)} />
        )}
      </Modal>
    </div>
  )
}

function LinhaContaFixa({ fixa, aoEditar }: { fixa: ContaFixaCompleta; aoEditar: () => void }) {
  const entrada = fixa.tipo === 'entrada'
  const contraparte = fixa.cliente?.nome_fantasia || fixa.cliente?.nome || fixa.fornecedor?.nome

  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', !fixa.ativo && 'opacity-70')}>
      <Repeat
        className={cn('size-5 shrink-0', entrada ? 'text-verde' : 'text-perigo')}
        aria-label={entrada ? 'A receber' : 'A pagar'}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{fixa.descricao}</p>
        <p className="truncate text-sm text-texto-suave">
          {[
            `Todo dia ${fixa.dia_vencimento}`,
            contraparte,
            fixa.categoria?.nome,
            fixa.forma_pagamento && NOME_FORMA[fixa.forma_pagamento],
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('font-bold', entrada ? 'text-verde' : 'text-perigo')}>
          {entrada ? '' : '− '}
          {formatarReais(fixa.valor)}
        </span>
        {!fixa.ativo && <Etiqueta>Encerrada</Etiqueta>}
      </div>
      <BotaoIcone rotulo={`Editar ${fixa.descricao}`} onClick={aoEditar}>
        <Pencil className="size-4" />
      </BotaoIcone>
    </li>
  )
}

const esquemaContaFixa = z.object({
  descricao: z.string().trim().min(2, 'Descreva a conta.'),
  valor: z.string().refine((v) => (lerValor(v) ?? 0) > 0, 'Informe o valor.'),
  dia_vencimento: z
    .number({ error: 'Informe o dia.' })
    .int('Use um número inteiro.')
    .min(1, 'Entre 1 e 31.')
    .max(31, 'Entre 1 e 31.'),
  categoria_id: z.string().min(1, 'Escolha a categoria.'),
  conta_bancaria_id: z.string(),
  forma_pagamento: z.string(),
  observacoes: z.string().trim(),
})
type DadosContaFixa = z.infer<typeof esquemaContaFixa>

function FormContaFixa({ fixa, aoTerminar }: { fixa: ContaFixaCompleta; aoTerminar: () => void }) {
  const categorias = useCategorias()
  const contas = useContas()
  const salvar = useSalvarContaFixa()
  const form = useForm<DadosContaFixa>({
    resolver: zodResolver(esquemaContaFixa),
    defaultValues: {
      descricao: fixa.descricao,
      valor: valorParaCampo(fixa.valor),
      dia_vencimento: fixa.dia_vencimento,
      categoria_id: fixa.categoria_id,
      conta_bancaria_id: fixa.conta_bancaria_id ?? '',
      forma_pagamento: fixa.forma_pagamento ?? '',
      observacoes: fixa.observacoes ?? '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const valorCampo = form.register('valor')
  const tipoCategoria = fixa.tipo === 'entrada' ? 'receita' : 'despesa'

  async function enviar(d: DadosContaFixa) {
    try {
      await salvar.mutateAsync({
        id: fixa.id,
        dados: {
          descricao: d.descricao,
          valor: lerValor(d.valor)!,
          dia_vencimento: d.dia_vencimento,
          categoria_id: d.categoria_id,
          conta_bancaria_id: d.conta_bancaria_id || null,
          forma_pagamento: (d.forma_pagamento || null) as FormaPagamento | null,
          observacoes: d.observacoes || null,
        },
      })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  async function mudarAtivo(ativo: boolean) {
    const pergunta = ativo
      ? `Reativar “${fixa.descricao}”? Ela volta a ser lançada todo mês.`
      : `Encerrar “${fixa.descricao}”? Os lançamentos dos próximos meses ainda em aberto são cancelados; o deste mês continua na lista.`
    if (!window.confirm(pergunta)) return
    try {
      await salvar.mutateAsync({ id: fixa.id, dados: { ativo } })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <Campo
        rotulo="Descrição"
        htmlFor="fixa-descricao"
        obrigatorio
        erro={errors.descricao?.message}
      >
        <Input id="fixa-descricao" {...form.register('descricao')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo="Valor por mês (R$)"
          htmlFor="fixa-valor"
          obrigatorio
          erro={errors.valor?.message}
        >
          <Input
            id="fixa-valor"
            inputMode="numeric"
            {...valorCampo}
            onChange={(e) => {
              e.target.value = mascaraValor(e.target.value)
              void valorCampo.onChange(e)
            }}
          />
        </Campo>
        <Campo
          rotulo="Dia do vencimento"
          htmlFor="fixa-dia"
          obrigatorio
          erro={errors.dia_vencimento?.message}
          dica="29 a 31: nos meses curtos, vence no último dia."
        >
          <Input
            id="fixa-dia"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            {...form.register('dia_vencimento', { valueAsNumber: true })}
          />
        </Campo>
        <Campo
          rotulo="Categoria"
          htmlFor="fixa-categoria"
          obrigatorio
          erro={errors.categoria_id?.message}
          className="col-span-2"
        >
          <Select id="fixa-categoria" {...form.register('categoria_id')}>
            {(categorias.data ?? [])
              .filter((c) => c.tipo === tipoCategoria && (c.ativo || c.id === fixa.categoria_id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </Select>
        </Campo>
        <Campo rotulo="Conta" htmlFor="fixa-conta">
          <Select id="fixa-conta" {...form.register('conta_bancaria_id')}>
            <option value="">Escolher na hora</option>
            {(contas.data ?? [])
              .filter((c) => c.ativo || c.id === fixa.conta_bancaria_id)
              .map((c) => (
                <option key={c.id} value={c.id!}>
                  {c.nome}
                </option>
              ))}
          </Select>
        </Campo>
        <Campo rotulo="Forma de pagamento" htmlFor="fixa-forma">
          <Select id="fixa-forma" {...form.register('forma_pagamento')}>
            <option value="">—</option>
            {FORMAS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo rotulo="Observações" htmlFor="fixa-obs">
        <Textarea id="fixa-obs" {...form.register('observacoes')} />
      </Campo>
      <p className="text-sm text-texto-suave">
        As mudanças valem para os próximos meses e para os lançamentos em aberto que ainda não
        venceram. Os já pagos não mudam.
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          variante="secundario"
          disabled={isSubmitting || salvar.isPending}
          onClick={() => void mudarAtivo(!fixa.ativo)}
        >
          {fixa.ativo ? 'Encerrar conta fixa' : 'Reativar'}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
