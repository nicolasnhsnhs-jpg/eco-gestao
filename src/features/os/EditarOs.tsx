import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { mensagemDeErro } from '@/lib/erros'

import { useAtualizarOs, useOperadores, useVeiculos, type OsCompleta } from './api'
import { nomeVeiculo } from './nomeVeiculo'

/**
 * Edição da OS antes de começar (rascunho ou agendada): troca de técnicos de
 * última hora, data, horário, veículo, descrição e observações.
 */
export function EditarOs({
  os,
  aberto,
  aoFechar,
}: {
  os: OsCompleta
  aberto: boolean
  aoFechar: () => void
}) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={`Editar ${os.numero}`}>
      <Formulario os={os} aoFechar={aoFechar} />
    </Modal>
  )
}

function Formulario({ os, aoFechar }: { os: OsCompleta; aoFechar: () => void }) {
  const operadores = useOperadores()
  const veiculos = useVeiculos()
  const atualizar = useAtualizarOs(os.id)
  const [data, setData] = useState(os.data_agendada ?? '')
  const [hora, setHora] = useState(os.hora_agendada?.slice(0, 5) ?? '')
  const [escolhidos, setEscolhidos] = useState<string[]>(
    os.operadores.flatMap((x) => (x.operador ? [x.operador.id] : [])),
  )
  const [veiculoId, setVeiculoId] = useState(os.veiculo_id ?? '')
  const [descricao, setDescricao] = useState(os.descricao ?? '')
  const [observacoes, setObservacoes] = useState(os.observacoes_adm ?? '')
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (escolhidos.length === 0) {
      setErro('Escolha pelo menos um operador.')
      return
    }
    if (descricao.trim().length < 3) {
      setErro('Descreva o serviço a ser feito.')
      return
    }
    try {
      await atualizar.mutateAsync({
        dados: {
          data_agendada: data,
          hora_agendada: hora || null,
          veiculo_id: veiculoId || null,
          descricao: descricao.trim(),
          observacoes_adm: observacoes.trim() || null,
        },
        operadores: escolhidos,
      })
      aoFechar()
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data" htmlFor="ed-data" obrigatorio>
          <Input
            id="ed-data"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Horário" htmlFor="ed-hora">
          <Input id="ed-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">
          Operadores <span className="text-perigo">*</span>
        </legend>
        {operadores.data?.map((o) => (
          <label key={o.id} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-verde"
              checked={escolhidos.includes(o.id)}
              onChange={(e) =>
                setEscolhidos((atual) =>
                  e.target.checked ? [...atual, o.id] : atual.filter((id) => id !== o.id),
                )
              }
            />
            {o.nome}
          </label>
        ))}
      </fieldset>

      <Campo rotulo="Veículo" htmlFor="ed-veiculo">
        <Select id="ed-veiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
          <option value="">Sem veículo definido</option>
          {veiculos.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {nomeVeiculo(v)}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo rotulo="Descrição do serviço" htmlFor="ed-descricao" obrigatorio>
        <Textarea
          id="ed-descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </Campo>

      <Campo rotulo="Observações ADM" htmlFor="ed-observacoes">
        <Textarea
          id="ed-observacoes"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </Campo>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variante="fantasma" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={atualizar.isPending}>
          {atualizar.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}
