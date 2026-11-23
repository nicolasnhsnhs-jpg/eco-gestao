import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import {
  fichaDaOs,
  useInformarPedidoCompra,
  useMarcarOsFaturada,
  useOsAFaturar,
  type OsAFaturar,
} from '../os/api'

/**
 * Serviços a faturar: as OS que o escritório conferiu e deu o OK para o financeiro.
 * Saem da lista ao faturar (na própria OS) ou ao marcar como já faturadas.
 */
export function AFaturarPage() {
  const lista = useOsAFaturar()
  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Serviços a faturar</h1>
        <p className="text-texto-suave">
          OS conferidas pelo escritório, com o OK para o financeiro. As mais antigas primeiro.
        </p>
      </div>
      {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}
      {lista.isPending && <Carregando />}
      {lista.isSuccess && lista.data.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">Nenhum serviço a faturar.</Card>
      )}
      <ul className="flex flex-col gap-2">
        {lista.data?.map((item) => (
          <li key={item.os_id}>
            <CartaoAFaturar item={item} />
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * O valor vem da proposta de onde a OS saiu: o item do mesmo serviço em destaque
 * e o total da proposta. OS sem proposta ligada: o valor é combinado com o ADM.
 */
function ValorDaProposta({ item }: { item: OsAFaturar }) {
  const proposta = item.os.proposta
  if (!proposta) {
    return (
      <p className="rounded-xl bg-fundo-suave p-3 text-sm text-texto-suave">
        Sem proposta ligada a esta OS: confira o valor com o ADM.
      </p>
    )
  }
  const itens = [...proposta.itens].sort((a, b) => a.ordem - b.ordem)
  const doServico = itens.filter((i) => i.tipo_servico_id === item.os.tipo_servico_id)
  return (
    <div className="flex flex-col gap-1 rounded-xl border-2 border-verde/40 bg-lima-claro p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-verde-escuro">Proposta nº {proposta.numero}</span>
        <span className="ml-auto text-lg font-bold">{formatarReais(proposta.valor_total)}</span>
      </div>
      {itens.length > 1 &&
        (doServico.length > 0 ? doServico : itens).map((i) => (
          <p key={i.id} className="text-sm">
            {i.descricao}
            {i.quantidade !== 1 && ` · ${i.quantidade} × ${formatarReais(i.valor_unitario)}`}
            {' = '}
            <strong>{formatarReais(i.quantidade * i.valor_unitario)}</strong>
          </p>
        ))}
      <Link className="text-sm text-verde underline" to={`/propostas/${proposta.id}`}>
        Ver proposta
      </Link>
    </div>
  )
}

function CartaoAFaturar({ item }: { item: OsAFaturar }) {
  const marcar = useMarcarOsFaturada()
  const [confirmando, setConfirmando] = useState(false)
  const os = item.os
  const ficha = fichaDaOs(os.ficha_cliente)
  const nome = ficha.nome_fantasia || ficha.nome || ''
  const operadores = os.operadores.map((o) => o.operador?.nome).filter(Boolean)

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-verde-escuro">{formatarData(os.data_agendada)}</span>
        <span className="ml-auto text-sm text-texto-suave">{os.numero}</span>
      </div>
      <p className="font-semibold">
        {nome}
        {ficha.unidade?.apelido && ` · ${ficha.unidade.apelido}`}
      </p>
      <p className="text-sm text-texto-suave">
        {os.tipo?.nome}
        {operadores.length > 0 && ` · ${operadores.join(', ')}`}
      </p>
      {item.aguardando_pedido_compra && <AguardandoPedido osId={os.id} />}
      {item.tem_pedido_compra && !item.aguardando_pedido_compra && (
        <div className="rounded-xl border-2 border-alerta bg-alerta/10 p-3 text-lg font-bold">
          Emitir com pedido de compra nº {item.pedido_compra}
        </div>
      )}
      <ValorDaProposta item={item} />
      {item.adicional_valor != null && (
        <div className="flex flex-col gap-1 rounded-xl border-2 border-alerta bg-alerta/10 p-3">
          <p className="font-bold">
            Serviço adicional (fora da proposta): + {formatarReais(item.adicional_valor)}
          </p>
          {item.adicional_descricao && (
            <p className="text-sm whitespace-pre-line">{item.adicional_descricao}</p>
          )}
        </div>
      )}
      {item.observacoes && (
        <p className="text-sm">
          <strong>Obs. do escritório:</strong> {item.observacoes}
        </p>
      )}
      <p className="text-xs text-texto-suave">
        OK para o financeiro em {formatarDataHora(item.liberada_financeiro_em)}
      </p>
      {marcar.isError && <Aviso tipo="erro">{mensagemDeErro(marcar.error)}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Link to={`/os/${os.id}`}>
          <Button>
            <FileText className="size-4" aria-hidden /> Abrir OS e faturar
          </Button>
        </Link>
        {confirmando ? (
          <>
            <Button disabled={marcar.isPending} onClick={() => marcar.mutate(os.id)}>
              {marcar.isPending ? 'Marcando…' : 'Confirmar: já faturada'}
            </Button>
            <Button variante="fantasma" onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
          </>
        ) : (
          <Button variante="fantasma" onClick={() => setConfirmando(true)}>
            Já faturada (tirar da lista)
          </Button>
        )}
      </div>
    </Card>
  )
}

/** O serviço precisa de pedido de compra e o cliente ainda não mandou: não emitir ainda. */
function AguardandoPedido({ osId }: { osId: string }) {
  const informar = useInformarPedidoCompra()
  const [numero, setNumero] = useState('')
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-alerta bg-alerta/10 p-3">
      <p className="text-lg font-bold">Aguardando pedido de compra: não emitir a nota ainda</p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (numero.trim()) informar.mutate({ osId, numero })
        }}
      >
        <Input
          aria-label="Número do pedido de compra"
          placeholder="Chegou? Número do pedido"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          maxLength={60}
          className="max-w-64 flex-1"
        />
        <Button type="submit" variante="secundario" disabled={!numero.trim() || informar.isPending}>
          {informar.isPending ? 'Salvando…' : 'Salvar número'}
        </Button>
      </form>
      {informar.isError && <p className="text-sm text-perigo">{mensagemDeErro(informar.error)}</p>}
    </div>
  )
}
