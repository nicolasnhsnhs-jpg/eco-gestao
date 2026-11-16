import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { fichaDaOs, useMarcarOsFaturada, useOsAFaturar, type OsAFaturar } from '../os/api'

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

function CartaoAFaturar({ item }: { item: OsAFaturar }) {
  const marcar = useMarcarOsFaturada()
  const [confirmando, setConfirmando] = useState(false)
  const os = item.os
  const ficha = fichaDaOs(os.ficha_cliente)
  const nome = ficha.nome_fantasia || ficha.nome || ''
  const operadores = os.operadores.map((o) => o.operador?.nome).filter(Boolean)
  const nota = new URLSearchParams({ cliente: os.cliente_id, cliente_nome: ficha.nome ?? nome })

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
      {item.tem_pedido_compra && (
        <div className="rounded-xl border-2 border-alerta bg-alerta/10 p-3 text-lg font-bold">
          Emitir com pedido de compra nº {item.pedido_compra}
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
          <Button variante="secundario">Abrir OS e faturar</Button>
        </Link>
        <Link to={`/financeiro/notas/nova?${nota}`}>
          <Button variante="secundario">
            <FileText className="size-4" aria-hidden /> Emitir nota
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
