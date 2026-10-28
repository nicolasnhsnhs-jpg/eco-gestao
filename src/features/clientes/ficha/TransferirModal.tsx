import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { mensagemDeErro } from '@/lib/erros'

import { equipeComercial, useEquipe, useTransferirCliente } from '../api'

type Props = {
  aberto: boolean
  aoFechar: () => void
  clienteId: string
  vendedorAtualId: string | null
}

/** Troca o vendedor responsável de um cliente (só o administrador). */
export function TransferirModal({ aberto, aoFechar, clienteId, vendedorAtualId }: Props) {
  const equipe = useEquipe()
  const transferir = useTransferirCliente(clienteId)
  const [novoVendedor, setNovoVendedor] = useState('')
  const [motivo, setMotivo] = useState('')

  const opcoes = equipeComercial(equipe.data).filter((p) => p.id !== vendedorAtualId)

  async function confirmar() {
    try {
      await transferir.mutateAsync({ novoVendedor, motivo })
      setNovoVendedor('')
      setMotivo('')
      aoFechar()
    } catch {
      // O erro aparece abaixo, pelo estado da mutação.
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Transferir cliente">
      <div className="flex flex-col gap-4">
        {transferir.isError && <Aviso tipo="erro">{mensagemDeErro(transferir.error)}</Aviso>}
        <Campo rotulo="Novo vendedor responsável" htmlFor="novo-vendedor" obrigatorio>
          <Select
            id="novo-vendedor"
            value={novoVendedor}
            onChange={(e) => setNovoVendedor(e.target.value)}
          >
            <option value="">Escolha…</option>
            {opcoes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Motivo" htmlFor="motivo" dica="Ex.: vendedor saiu da empresa">
          <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <Button disabled={!novoVendedor || transferir.isPending} onClick={() => void confirmar()}>
          {transferir.isPending ? 'Transferindo…' : 'Transferir'}
        </Button>
      </div>
    </Modal>
  )
}
