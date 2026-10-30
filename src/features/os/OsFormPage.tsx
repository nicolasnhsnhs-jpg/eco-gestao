import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import type { Tables } from '@/lib/database.types'
import { hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { useCliente } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import { useAgendarOs, useModelo, useOperadores, useVeiculos } from './api'

/**
 * Nova OS: escolhe cliente → unidade → serviço. Se já existe um modelo para esse
 * local e serviço, a OS vem preenchida com ele; senão, o modelo é criado agora.
 */
export function OsFormPage() {
  const [parametros] = useSearchParams()
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null)
  const [enderecoId, setEnderecoId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const tipos = useTiposServico()

  const clienteId = cliente?.id ?? parametros.get('cliente') ?? ''
  const dadosCliente = useCliente(clienteId)
  const enderecos = dadosCliente.data?.enderecos.filter((e) => e.ativo) ?? []
  // Cliente com uma única unidade: a OS fica nela.
  const unidade = enderecoId || (enderecos.length === 1 ? enderecos[0].id : '')
  const modelo = useModelo(clienteId, unidade || null, tipoId)

  return (
    <>
      <PageHeader titulo="Nova ordem de serviço" />
      <Card className="flex flex-col gap-4">
        <Campo rotulo="Cliente" htmlFor="os-cliente" obrigatorio>
          {clienteId && !cliente && dadosCliente.data ? (
            <p className="flex min-h-11 items-center font-semibold">{dadosCliente.data.nome}</p>
          ) : (
            <ClienteSeletor
              id="os-cliente"
              valor={cliente}
              aoMudar={(c) => {
                setCliente(c)
                setEnderecoId('')
              }}
            />
          )}
        </Campo>

        {clienteId && (
          <Campo
            rotulo="Unidade"
            htmlFor="os-unidade"
            dica={enderecos.length === 0 ? 'O cliente não tem endereço cadastrado.' : undefined}
          >
            <Select id="os-unidade" value={unidade} onChange={(e) => setEnderecoId(e.target.value)}>
              {enderecos.length !== 1 && <option value="">Escolha…</option>}
              {enderecos.map((e) => (
                <option key={e.id} value={e.id}>
                  {[e.apelido, `${e.logradouro}, ${e.numero ?? 's/n'}`, e.cidade]
                    .filter(Boolean)
                    .join(' · ')}
                </option>
              ))}
            </Select>
          </Campo>
        )}

        <Campo rotulo="Serviço" htmlFor="os-tipo" obrigatorio>
          <Select id="os-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
            <option value="">Escolha…</option>
            {tipos.data
              ?.filter((t) => t.ativo)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
          </Select>
        </Campo>
      </Card>

      {clienteId && tipoId && (enderecos.length === 0 || unidade) && (
        <>
          {modelo.isPending && <Carregando />}
          {modelo.isError && <Aviso tipo="erro">{mensagemDeErro(modelo.error)}</Aviso>}
          {modelo.isSuccess && (
            <FormAgendamento
              key={modelo.data?.id ?? 'novo'}
              clienteId={clienteId}
              enderecoId={unidade || null}
              tipoId={tipoId}
              modelo={modelo.data}
            />
          )}
        </>
      )}
    </>
  )
}

function FormAgendamento({
  clienteId,
  enderecoId,
  tipoId,
  modelo,
}: {
  clienteId: string
  enderecoId: string | null
  tipoId: string
  modelo: Tables<'os_modelos'> | null
}) {
  const navigate = useNavigate()
  const operadores = useOperadores()
  const veiculos = useVeiculos()
  const agendar = useAgendarOs()
  const [data, setData] = useState(hojeISO())
  const [hora, setHora] = useState('')
  const [escolhidos, setEscolhidos] = useState<string[]>(modelo?.operadores_padrao ?? [])
  const [veiculoId, setVeiculoId] = useState(modelo?.veiculo_padrao_id ?? '')
  const [descricao, setDescricao] = useState(modelo?.descricao ?? '')
  const [observacoes, setObservacoes] = useState(modelo?.observacoes_adm_padrao ?? '')
  const [salvarComoPadrao, setSalvarComoPadrao] = useState(!modelo)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
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
      const id = await agendar.mutateAsync({
        clienteId,
        enderecoId,
        tipoId,
        data,
        hora: hora || null,
        operadores: escolhidos,
        veiculoId: veiculoId || null,
        descricao: descricao.trim(),
        observacoesAdm: observacoes.trim(),
        salvarComoPadrao,
      })
      navigate(`/os/${id}`)
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        {modelo ? (
          <Aviso tipo="sucesso">
            Este local já tem um modelo. A OS vem preenchida com o escopo da última visita.
          </Aviso>
        ) : (
          <Aviso tipo="info">Primeira OS deste serviço neste local: o escopo vira o modelo.</Aviso>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data" htmlFor="os-data" obrigatorio>
            <Input
              id="os-data"
              type="date"
              required
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Horário" htmlFor="os-hora">
            <Input
              id="os-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </Campo>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">
            Operadores <span className="text-perigo">*</span>
          </legend>
          {operadores.data?.length === 0 && (
            <p className="text-sm text-texto-suave">
              Nenhum operador cadastrado. Crie em Usuários → Novo operador.
            </p>
          )}
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

        <Campo rotulo="Veículo" htmlFor="os-veiculo">
          <Select id="os-veiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
            <option value="">Sem veículo definido</option>
            {veiculos.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} · {v.descricao}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo rotulo="Descrição do serviço" htmlFor="os-descricao" obrigatorio>
          <Textarea
            id="os-descricao"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Campo>

        <Campo
          rotulo="Observações ADM"
          htmlFor="os-observacoes"
          dica='Ex.: "Portaria libera às 08h30, falar com Fulana (48) 99999-0000".'
        >
          <Textarea
            id="os-observacoes"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </Campo>

        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={salvarComoPadrao}
            onChange={(e) => setSalvarComoPadrao(e.target.checked)}
          />
          Usar operadores, veículo e observações como padrão das próximas visitas
        </label>
      </Card>

      <Button type="submit" disabled={agendar.isPending}>
        {agendar.isPending ? 'Agendando…' : 'Agendar OS'}
      </Button>
    </form>
  )
}
