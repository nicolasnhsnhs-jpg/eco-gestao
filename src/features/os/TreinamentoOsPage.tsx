import { GraduationCap, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import {
  fichaDaOs,
  useApagarTreinamentos,
  useCriarTreinamento,
  useOperadores,
  useOrdensServico,
  type OsResumo,
} from './api'
import { CartaoOs } from './OsListaPage'

const nomeDaOs = (os: OsResumo) => {
  const ficha = fichaDaOs(os.ficha_cliente)
  return [
    os.numero,
    ficha.nome_fantasia || ficha.nome,
    os.tipo?.nome,
    formatarData(os.data_agendada),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Treinamento: o escritório pega uma OS de verdade e manda um teste para os
 * técnicos. Cada técnico recebe a sua cópia (não fica ligada à dos outros) e
 * preenche no celular igual a uma OS real. Nada vai para o cliente: não aparece
 * na lista de OS, não registra serviço realizado, não gera PDF nem vai para o Drive.
 */
export function TreinamentoOsPage() {
  const hoje = hojeISO()
  const reais = useOrdensServico({
    de: somarDias(hoje, -60),
    ate: somarDias(hoje, 30),
    treinamento: false,
  })
  const testes = useOrdensServico({ treinamento: true })
  const operadores = useOperadores()
  const criar = useCriarTreinamento()
  const apagar = useApagarTreinamentos()
  const [origem, setOrigem] = useState('')
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const todos = operadores.data?.map((o) => o.id) ?? []
  const todosMarcados = todos.length > 0 && todos.every((id) => escolhidos.includes(id))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    if (!origem) return setErro('Escolha a OS que vai servir de teste.')
    if (escolhidos.length === 0) return setErro('Escolha pelo menos um técnico.')
    try {
      const total = await criar.mutateAsync({ origem, operadores: escolhidos })
      setAviso(
        `Teste enviado para ${total} técnico(s). Aparece hoje no celular de cada um, marcado como teste.`,
      )
      setEscolhidos([])
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  async function apagarTestes(os?: OsResumo) {
    const pergunta = os
      ? `Apagar o teste ${os.numero}? O que o técnico preencheu some junto.`
      : 'Apagar TODOS os testes de treinamento? O que os técnicos preencheram some junto.'
    if (!window.confirm(pergunta)) return
    setErro(null)
    setAviso(null)
    try {
      await apagar.mutateAsync(os?.id)
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <>
      <PageHeader
        titulo="Treinamento da OS"
        descricao="Mande uma OS de teste para os técnicos aprenderem a preencher no celular. Nada vai para o cliente."
      />

      {erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mb-4">
          <Aviso tipo="sucesso">{aviso}</Aviso>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <h2 className="font-titulo text-lg font-bold text-verde-escuro">Montar teste</h2>
            <p className="text-sm text-texto-suave">
              Cada técnico recebe a sua cópia da OS e preenche sozinho. Ao concluir, o celular
              confere o que falta igual a uma OS de verdade. A OS escolhida não muda.
            </p>

            <Campo rotulo="OS que vai servir de teste" htmlFor="tr-origem" obrigatorio>
              <Select id="tr-origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>
                <option value="">Escolha…</option>
                {reais.data?.map((os) => (
                  <option key={os.id} value={os.id}>
                    {nomeDaOs(os)}
                  </option>
                ))}
              </Select>
            </Campo>

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 font-semibold">
                Técnicos <span className="text-perigo">*</span>
              </legend>
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-verde"
                  checked={todosMarcados}
                  onChange={(e) => setEscolhidos(e.target.checked ? todos : [])}
                />
                Todos os técnicos
              </label>
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

            <Button type="submit" className="self-start" disabled={criar.isPending}>
              <GraduationCap className="size-5" aria-hidden />
              {criar.isPending
                ? 'Enviando…'
                : `Enviar teste${escolhidos.length ? ` para ${escolhidos.length} técnico(s)` : ''}`}
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-titulo text-lg font-bold text-verde-escuro">Testes enviados</h2>
            {!!testes.data?.length && (
              <Button
                variante="fantasma"
                className="ml-auto"
                disabled={apagar.isPending}
                onClick={() => void apagarTestes()}
              >
                <Trash2 className="size-4" aria-hidden /> Apagar todos
              </Button>
            )}
          </div>
          {testes.isPending && <Carregando />}
          {testes.isError && <Aviso tipo="erro">{mensagemDeErro(testes.error)}</Aviso>}
          {testes.data?.length === 0 && (
            <p className="text-sm text-texto-suave">Nenhum teste enviado.</p>
          )}
          <ul className="flex flex-col gap-2">
            {testes.data?.map((os) => (
              <li key={os.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <CartaoOs os={os} para={`/os/${os.id}`} />
                </div>
                <BotaoIcone
                  rotulo={`Apagar o teste ${os.numero}`}
                  onClick={() => void apagarTestes(os)}
                >
                  <Trash2 className="size-4" />
                </BotaoIcone>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
