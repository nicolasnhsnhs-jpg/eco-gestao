import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useProdutosCatalogo, useSalvarProdutoCatalogo, type ProdutoCatalogo } from './api'
import { linhasDoProduto } from './modelos'

/** Abas da área de certificados. */
export function AbasCertificados() {
  const abas = [
    { rotulo: 'Certificados', caminho: '/certificados', fim: true },
    { rotulo: 'Produtos', caminho: '/certificados/produtos', fim: false },
    { rotulo: 'Assinaturas', caminho: '/certificados/assinaturas', fim: false },
  ]
  return (
    <nav
      aria-label="Certificados"
      className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1"
    >
      {abas.map((aba) => (
        <NavLink
          key={aba.caminho}
          to={aba.caminho}
          end={aba.fim}
          className={({ isActive }) =>
            cn(
              'flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap',
              isActive ? 'bg-verde text-white' : 'text-texto-suave hover:bg-lima-claro',
            )
          }
        >
          {aba.rotulo}
        </NavLink>
      ))}
    </nav>
  )
}

const comoProduto = (p: ProdutoCatalogo) => ({
  nome_comercial: p.nome_comercial ?? '',
  principio_ativo: p.principio_ativo,
  registro: p.registro ?? '',
  quantidade: p.quantidade_padrao ?? '',
  lote: p.lote ?? '',
  fabricacao: p.fabricacao ?? '',
  validade: p.validade ?? '',
})

/** /certificados/produtos: produtos e lotes que aparecem nos certificados. */
export function ProdutosCertificadoPage() {
  const produtos = useProdutosCatalogo()
  const [editando, setEditando] = useState<ProdutoCatalogo | 'novo' | null>(null)
  const hoje = hojeISO()

  return (
    <>
      <AbasCertificados />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-texto-suave">
          Cadastre cada produto com o lote em uso. Na emissão, é só escolher e informar a
          quantidade. Trocar o lote aqui não muda os certificados já emitidos.
        </p>
        <Button onClick={() => setEditando('novo')}>
          <Plus className="size-5" aria-hidden /> Novo produto
        </Button>
      </div>
      {produtos.isPending && <Carregando />}
      {produtos.isError && <Aviso tipo="erro">{mensagemDeErro(produtos.error)}</Aviso>}
      {produtos.isSuccess && produtos.data.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          Nenhum produto cadastrado ainda.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {produtos.data?.map((p) => {
          const [linha1, linha2] = linhasDoProduto(comoProduto(p))
          // A validade do lote é o mês inteiro: vence depois do último dia daquele mês.
          const vencido = !!p.validade && p.validade.slice(0, 7) < hoje.slice(0, 7)
          return (
            <li
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border border-borda bg-white p-4',
                !p.ativo && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{linha1}</p>
                {linha2 && <p className="text-sm text-texto-suave">{linha2}</p>}
              </div>
              {!p.ativo && <Etiqueta>Desativado</Etiqueta>}
              {p.ativo && vencido && <Etiqueta cor="perigo">Lote vencido</Etiqueta>}
              <BotaoIcone rotulo={`Editar ${p.principio_ativo}`} onClick={() => setEditando(p)}>
                <Pencil className="size-5" aria-hidden />
              </BotaoIcone>
            </li>
          )
        })}
      </ul>
      <Modal
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={editando === 'novo' ? 'Novo produto' : 'Editar produto'}
      >
        {editando !== null && (
          <FormProduto
            key={editando === 'novo' ? 'novo' : editando.id}
            produto={editando === 'novo' ? undefined : editando}
            aoTerminar={() => setEditando(null)}
          />
        )}
      </Modal>
    </>
  )
}

/** "2024-07-01" ↔ "2024-07" (campo de mês do navegador) */
const paraMes = (iso: string | null) => (iso ? iso.slice(0, 7) : '')
const doMes = (mes: string) => (mes ? `${mes}-01` : null)

function FormProduto({
  produto,
  aoTerminar,
}: {
  produto?: ProdutoCatalogo
  aoTerminar: () => void
}) {
  const salvar = useSalvarProdutoCatalogo()
  const [erro, setErro] = useState<string | null>(null)
  const [v, setV] = useState({
    nome_comercial: produto?.nome_comercial ?? '',
    principio_ativo: produto?.principio_ativo ?? '',
    registro: produto?.registro ?? '',
    lote: produto?.lote ?? '',
    fabricacao: paraMes(produto?.fabricacao ?? null),
    validade: paraMes(produto?.validade ?? null),
    quantidade_padrao: produto?.quantidade_padrao ?? '',
    ativo: produto?.ativo ?? true,
  })
  const campo = (nome: keyof typeof v) => ({
    value: v[nome] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [nome]: e.target.value }),
  })
  const ouNulo = (t: string) => (t.trim() ? t.trim() : null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (v.principio_ativo.trim().length < 2) {
      setErro('Informe o princípio ativo.')
      return
    }
    try {
      await salvar.mutateAsync({
        id: produto?.id,
        dados: {
          nome_comercial: ouNulo(v.nome_comercial),
          principio_ativo: v.principio_ativo.trim(),
          registro: ouNulo(v.registro),
          lote: ouNulo(v.lote),
          fabricacao: doMes(v.fabricacao),
          validade: doMes(v.validade),
          quantidade_padrao: ouNulo(v.quantidade_padrao),
          ativo: v.ativo,
        },
      })
      aoTerminar()
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome comercial" htmlFor="p-nome" dica="Ex.: FENDONA (pode ficar vazio).">
          <Input id="p-nome" {...campo('nome_comercial')} />
        </Campo>
        <Campo rotulo="Princípio ativo" htmlFor="p-principio" obrigatorio>
          <Input id="p-principio" placeholder="Alfa-Cipermetrina" {...campo('principio_ativo')} />
        </Campo>
        <Campo
          rotulo="Registro"
          htmlFor="p-registro"
          dica='Ex.: "MS 304040031" ou "Isento de Registro".'
        >
          <Input id="p-registro" {...campo('registro')} />
        </Campo>
        <Campo rotulo="Quantidade mais usada" htmlFor="p-qtd" dica="Já vem preenchida na emissão.">
          <Input id="p-qtd" placeholder="100ml" {...campo('quantidade_padrao')} />
        </Campo>
        <Campo rotulo="Lote" htmlFor="p-lote">
          <Input id="p-lote" {...campo('lote')} />
        </Campo>
        <span />
        <Campo rotulo="Fabricação (mês)" htmlFor="p-fab">
          <Input id="p-fab" type="month" {...campo('fabricacao')} />
        </Campo>
        <Campo rotulo="Validade (mês)" htmlFor="p-val">
          <Input id="p-val" type="month" {...campo('validade')} />
        </Campo>
      </div>
      {produto && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={v.ativo}
            onChange={(e) => setV({ ...v, ativo: e.target.checked })}
          />
          Produto em uso (desmarque para tirar da lista de emissão)
        </label>
      )}
      <Button type="submit" disabled={salvar.isPending}>
        {salvar.isPending ? 'Salvando…' : 'Salvar produto'}
      </Button>
    </form>
  )
}
