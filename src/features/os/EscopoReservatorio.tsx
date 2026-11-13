import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { usePontosModelo, useSalvarPontos, type AlvoEscopo } from './pragasApi'

/** "2 × 20.000 L" */
export const descreverReservatorio = (r: {
  quantidade: number | null
  capacidade_litros: number | null
}) =>
  [
    `${r.quantidade ?? 1} ×`,
    r.capacidade_litros ? `${r.capacidade_litros.toLocaleString('pt-BR')} L` : 'capacidade —',
  ].join(' ')

/** Quantas etapas o reservatório ocupa na tela do operador. */
export const ETAPAS_RESERVATORIO = 1

/**
 * Escopo da limpeza de reservatórios (escritório): os reservatórios do local, com
 * localização, quantidade e capacidade. Ficam no modelo e valem para as próximas
 * visitas; a data da última limpeza vem das OS concluídas.
 */
export function EscopoReservatorio({ alvo }: { alvo: AlvoEscopo }) {
  const { modeloId, antesDeComecar } = alvo
  const pontos = usePontosModelo(modeloId)
  const salvarPontos = useSalvarPontos(alvo.osId, antesDeComecar)
  const [area, setArea] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [capacidade, setCapacidade] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const todos = (pontos.data ?? []).filter((p) => p.tipo === 'reservatorio')
  const ativos = todos.filter((p) => p.ativo)

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    setErro(null)
    setSucesso(null)
    try {
      await acao()
      setSucesso(mensagem)
      return true
    } catch (e) {
      setErro(mensagemDeErro(e))
      return false
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">
        Reservatórios ({ativos.reduce((s, r) => s + (r.quantidade ?? 1), 0)})
      </h2>
      {alvo.osId && !antesDeComecar && (
        <Aviso tipo="info">A execução já começou: mudanças valem a partir da próxima visita.</Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      {pontos.isPending && <Carregando />}
      <ul className="flex flex-col gap-1">
        {ativos.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="flex-1">
              <strong>{r.area}</strong> · {descreverReservatorio(r)}
            </span>
            <Button
              variante="fantasma"
              disabled={salvarPontos.isPending}
              onClick={() =>
                void executar(
                  () =>
                    salvarPontos.mutateAsync({ alterar: { id: r.id, dados: { ativo: false } } }),
                  `${r.area} retirado.`,
                )
              }
            >
              Retirar
            </Button>
          </li>
        ))}
        {pontos.isSuccess && ativos.length === 0 && (
          <li className="text-texto-suave">Nenhum reservatório cadastrado.</li>
        )}
      </ul>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end">
        <div className="col-span-2 sm:col-span-1">
          <Campo rotulo="Localização" htmlFor="res-area" dica='Ex.: "Subsolo" ou "Terraço".'>
            <Input id="res-area" value={area} onChange={(e) => setArea(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Qtde" htmlFor="res-qtde">
          <Input
            id="res-qtde"
            inputMode="numeric"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
          />
        </Campo>
        <Campo rotulo="Litros (cada)" htmlFor="res-litros">
          <Input
            id="res-litros"
            inputMode="numeric"
            placeholder="20000"
            value={capacidade}
            onChange={(e) => setCapacidade(e.target.value.replace(/\D/g, ''))}
          />
        </Campo>
        <Button
          disabled={!area.trim() || salvarPontos.isPending}
          onClick={() => {
            const nome = area.trim()
            void executar(
              () =>
                salvarPontos.mutateAsync({
                  novos: [
                    {
                      modelo_id: modeloId,
                      tipo: 'reservatorio',
                      numero: Math.max(0, ...todos.map((p) => p.numero)) + 1,
                      area: nome,
                      quantidade: Math.max(1, Number(quantidade) || 1),
                      capacidade_litros: Number(capacidade) || null,
                    },
                  ],
                }),
              `${nome} cadastrado.`,
            ).then((ok) => {
              if (ok) {
                setArea('')
                setCapacidade('')
                setQuantidade('1')
              }
            })
          }}
        >
          Adicionar
        </Button>
      </div>
    </Card>
  )
}

/** "Última limpeza: 10/05/2026" (vale também para o PDF). */
export const ultimaLimpeza = (data: string | null) =>
  `Última limpeza: ${data ? formatarData(data) : 'sem registro'}`
