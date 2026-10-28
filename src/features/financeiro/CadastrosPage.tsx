import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { formatarTelefone } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'

import {
  useCategorias,
  useContas,
  useFornecedores,
  useSalvarCategoria,
  useSalvarConta,
  useSalvarFornecedor,
  type ContaBancaria,
  type Fornecedor,
} from './api'
import { SecaoConfiguracoes, SecaoFeriados } from './ConfiguracoesSecoes'
import { NovoFornecedorModal } from './NovoFornecedorModal'
import { NOME_TIPO_CONTA, type TipoConta } from './rotulos'

export function CadastrosPage() {
  return (
    <div className="flex flex-col gap-5">
      <SecaoConfiguracoes />
      <SecaoContas />
      <SecaoCategorias />
      <SecaoFornecedores />
      <SecaoFeriados />
    </div>
  )
}

function Cabecalho({ titulo, acao }: { titulo: string; acao: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {acao}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Contas bancárias
// -----------------------------------------------------------------------------

function SecaoContas() {
  const contas = useContas()
  const [editando, setEditando] = useState<ContaBancaria | null | undefined>(undefined)

  return (
    <Card>
      <Cabecalho
        titulo="Contas bancárias e caixa"
        acao={
          <Button variante="secundario" onClick={() => setEditando(null)}>
            <Plus className="size-4" aria-hidden /> Nova conta
          </Button>
        }
      />
      {contas.isPending && <Carregando />}
      {contas.data?.length === 0 && (
        <p className="text-sm text-texto-suave">
          Cadastre cada conta do banco e também o caixa (dinheiro), com o saldo do dia em que
          começar a usar o sistema.
        </p>
      )}
      <ul className="divide-y divide-borda">
        {contas.data?.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {c.nome}
                {!c.ativo && <Etiqueta>Inativa</Etiqueta>}
              </p>
              <p className="text-sm text-texto-suave">
                {[c.tipo && NOME_TIPO_CONTA[c.tipo], c.banco].filter(Boolean).join(' · ')} · saldo
                inicial {formatarReais(c.saldo_inicial)} em {formatarData(c.data_saldo_inicial)}
              </p>
            </div>
            <strong>{formatarReais(c.saldo_atual)}</strong>
            <BotaoIcone rotulo={`Editar ${c.nome}`} onClick={() => setEditando(c)}>
              <Pencil className="size-4" />
            </BotaoIcone>
          </li>
        ))}
      </ul>
      <Modal
        aberto={editando !== undefined}
        aoFechar={() => setEditando(undefined)}
        titulo={editando ? 'Editar conta' : 'Nova conta'}
      >
        <FormConta conta={editando ?? null} aoTerminar={() => setEditando(undefined)} />
      </Modal>
    </Card>
  )
}

const esquemaConta = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  banco: z.string().trim(),
  tipo: z.enum(['corrente', 'poupanca', 'caixa', 'outro']),
  saldo_inicial: z.string().refine((v) => v === '' || lerValor(v) !== null, 'Valor inválido.'),
  saldo_negativo: z.boolean(),
  data_saldo_inicial: z.string().min(1, 'Informe a data.'),
  ativo: z.boolean(),
})
type DadosConta = z.infer<typeof esquemaConta>

function FormConta({ conta, aoTerminar }: { conta: ContaBancaria | null; aoTerminar: () => void }) {
  const salvar = useSalvarConta()
  const saldo = Number(conta?.saldo_inicial ?? 0)
  const form = useForm<DadosConta>({
    resolver: zodResolver(esquemaConta),
    defaultValues: {
      nome: conta?.nome ?? '',
      banco: conta?.banco ?? '',
      tipo: conta?.tipo ?? 'corrente',
      saldo_inicial: valorParaCampo(Math.abs(saldo)),
      saldo_negativo: saldo < 0,
      data_saldo_inicial: conta?.data_saldo_inicial ?? hojeISO(),
      ativo: conta?.ativo ?? true,
    },
  })
  const { errors, isSubmitting } = form.formState
  const saldoCampo = form.register('saldo_inicial')

  async function enviar(d: DadosConta) {
    const valor = lerValor(d.saldo_inicial) ?? 0
    try {
      await salvar.mutateAsync({
        id: conta?.id ?? undefined,
        dados: {
          nome: d.nome,
          banco: d.banco || null,
          tipo: d.tipo as TipoConta,
          saldo_inicial: d.saldo_negativo ? -valor : valor,
          data_saldo_inicial: d.data_saldo_inicial,
          ativo: d.ativo,
        },
      })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <Campo rotulo="Nome" htmlFor="conta-nome" obrigatorio erro={errors.nome?.message}>
        <Input
          id="conta-nome"
          placeholder="Ex.: Sicredi, Caixa da empresa"
          {...form.register('nome')}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Tipo" htmlFor="conta-tipo">
          <Select id="conta-tipo" {...form.register('tipo')}>
            {Object.entries(NOME_TIPO_CONTA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Banco" htmlFor="conta-banco">
          <Input id="conta-banco" {...form.register('banco')} />
        </Campo>
        <Campo
          rotulo="Saldo inicial (R$)"
          htmlFor="conta-saldo"
          erro={errors.saldo_inicial?.message}
        >
          <Input
            id="conta-saldo"
            inputMode="numeric"
            placeholder="0,00"
            {...saldoCampo}
            onChange={(e) => {
              e.target.value = mascaraValor(e.target.value)
              void saldoCampo.onChange(e)
            }}
          />
        </Campo>
        <Campo rotulo="Saldo em" htmlFor="conta-data" erro={errors.data_saldo_inicial?.message}>
          <Input id="conta-data" type="date" {...form.register('data_saldo_inicial')} />
        </Campo>
      </div>
      <p className="text-sm text-texto-suave">
        Informe o saldo da conta nesta data. Só os recebimentos e pagamentos a partir dela mudam o
        saldo.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-verde"
          {...form.register('saldo_negativo')}
        />
        Saldo inicial negativo
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-verde" {...form.register('ativo')} />
        Conta ativa
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar conta'}
      </Button>
    </form>
  )
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------

function SecaoCategorias() {
  const categorias = useCategorias()
  const salvar = useSalvarCategoria()
  const [erro, setErro] = useState<string | null>(null)
  const [nova, setNova] = useState({ nome: '', tipo: 'despesa' as 'receita' | 'despesa' })

  async function executar(acao: () => Promise<unknown>) {
    setErro(null)
    try {
      await acao()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <Card>
      <Cabecalho titulo="Categorias" acao={null} />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (nova.nome.trim().length < 2) return
          void executar(async () => {
            await salvar.mutateAsync({ dados: { nome: nova.nome.trim(), tipo: nova.tipo } })
            setNova({ ...nova, nome: '' })
          })
        }}
      >
        <Input
          aria-label="Nome da nova categoria"
          placeholder="Nova categoria"
          value={nova.nome}
          onChange={(e) => setNova({ ...nova, nome: e.target.value })}
        />
        <Select
          aria-label="Tipo da nova categoria"
          className="sm:w-44"
          value={nova.tipo}
          onChange={(e) => setNova({ ...nova, tipo: e.target.value as 'receita' | 'despesa' })}
        >
          <option value="despesa">Despesa</option>
          <option value="receita">Receita</option>
        </Select>
        <Button type="submit" variante="secundario" disabled={salvar.isPending}>
          <Plus className="size-4" aria-hidden /> Adicionar
        </Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['receita', 'despesa'] as const).map((tipo) => (
          <div key={tipo}>
            <h3 className="mb-2 text-sm font-bold text-texto-suave uppercase">
              {tipo === 'receita' ? 'Receitas' : 'Despesas'}
            </h3>
            <ul className="flex flex-col gap-1">
              {categorias.data
                ?.filter((c) => c.tipo === tipo)
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className={c.ativo ? 'flex-1' : 'flex-1 text-texto-suave line-through'}>
                      {c.nome}
                    </span>
                    <BotaoIcone
                      rotulo={`Renomear ${c.nome}`}
                      onClick={() => {
                        const nome = window.prompt('Nome da categoria:', c.nome)?.trim()
                        if (nome && nome !== c.nome) {
                          void executar(() =>
                            salvar.mutateAsync({ id: c.id, dados: { nome, tipo: c.tipo } }),
                          )
                        }
                      }}
                    >
                      <Pencil className="size-4" />
                    </BotaoIcone>
                    <button
                      type="button"
                      className="text-xs font-semibold text-verde underline"
                      onClick={() =>
                        void executar(() =>
                          salvar.mutateAsync({
                            id: c.id,
                            dados: { nome: c.nome, tipo: c.tipo, ativo: !c.ativo },
                          }),
                        )
                      }
                    >
                      {c.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Fornecedores
// -----------------------------------------------------------------------------

function SecaoFornecedores() {
  const fornecedores = useFornecedores()
  const salvar = useSalvarFornecedor()
  const [editando, setEditando] = useState<Fornecedor | null | undefined>(undefined)

  return (
    <Card>
      <Cabecalho
        titulo="Fornecedores"
        acao={
          <Button variante="secundario" onClick={() => setEditando(null)}>
            <Plus className="size-4" aria-hidden /> Novo fornecedor
          </Button>
        }
      />
      {fornecedores.data?.length === 0 && (
        <p className="text-sm text-texto-suave">Nenhum fornecedor cadastrado.</p>
      )}
      <ul className="divide-y divide-borda">
        {fornecedores.data?.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {f.nome}
                {!f.ativo && <Etiqueta>Inativo</Etiqueta>}
              </p>
              <p className="text-sm text-texto-suave">
                {[formatarTelefone(f.telefone), f.email].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-verde underline"
              onClick={() =>
                void salvar.mutateAsync({ id: f.id, dados: { nome: f.nome, ativo: !f.ativo } })
              }
            >
              {f.ativo ? 'Desativar' : 'Reativar'}
            </button>
            <BotaoIcone rotulo={`Editar ${f.nome}`} onClick={() => setEditando(f)}>
              <Pencil className="size-4" />
            </BotaoIcone>
          </li>
        ))}
      </ul>
      <NovoFornecedorModal
        aberto={editando !== undefined}
        fornecedor={editando}
        aoFechar={() => setEditando(undefined)}
      />
    </Card>
  )
}
