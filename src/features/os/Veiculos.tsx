import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import { useSalvarVeiculo, useVeiculos } from './api'

/** Cadastro simples dos veículos usados nas OS (Admin e Financeiro). */
export function Veiculos() {
  const veiculos = useVeiculos(true)
  const salvar = useSalvarVeiculo()
  const [placa, setPlaca] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    setErro(null)
    const p = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p)) {
      setErro('Placa inválida. Use o formato ABC1D23 ou ABC1234.')
      return
    }
    if (descricao.trim().length < 2) {
      setErro('Descreva o veículo (ex.: Strada branca).')
      return
    }
    try {
      await salvar.mutateAsync({ placa: p, descricao: descricao.trim(), ativo: true })
      setPlaca('')
      setDescricao('')
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {veiculos.isPending && <Carregando />}
      <ul className="divide-y divide-borda rounded-xl border border-borda">
        {veiculos.data?.map((v) => (
          <li key={v.id} className="flex items-center gap-3 p-3">
            <span className={v.ativo ? 'font-semibold' : 'text-texto-suave line-through'}>
              {v.placa}
            </span>
            <span className="flex-1 truncate text-texto-suave">{v.descricao}</span>
            <Button
              variante="fantasma"
              disabled={salvar.isPending}
              onClick={() => salvar.mutate({ ...v, ativo: !v.ativo })}
            >
              {v.ativo ? 'Desativar' : 'Reativar'}
            </Button>
          </li>
        ))}
        {veiculos.data?.length === 0 && (
          <li className="p-3 text-texto-suave">Nenhum veículo cadastrado.</li>
        )}
      </ul>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <Campo rotulo="Placa" htmlFor="veiculo-placa">
          <Input
            id="veiculo-placa"
            autoCapitalize="characters"
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Descrição" htmlFor="veiculo-descricao">
          <Input
            id="veiculo-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Campo>
        <Button onClick={adicionar} disabled={salvar.isPending}>
          Adicionar
        </Button>
      </div>
    </div>
  )
}
