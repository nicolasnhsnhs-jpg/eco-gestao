import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { DataUltimaLimpeza } from './EscopoBebedouro'
import { usePontosModelo, useSalvarPontos, type AlvoEscopo } from './pragasApi'

/**
 * A capacidade fica guardada em litros (número inteiro); a tela e o PDF usam m³,
 * com vírgula ("139,70 m³" = 139.700 L).
 */
export const litrosParaM3 = (litros: number | null) =>
  litros ? (litros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : ''

/** "139,7" ou "139,70" → 139700 litros; vazio ou inválido → null. */
export function m3ParaLitros(texto: string): number | null {
  const n = Number(texto.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null
}

/** Deixa só números e uma vírgula enquanto a pessoa digita a capacidade. */
export const mascaraM3 = (texto: string) => {
  const [inteiro, ...resto] = texto
    .replace(/\./g, ',')
    .replace(/[^\d,]/g, '')
    .split(',')
  return resto.length ? `${inteiro},${resto.join('').slice(0, 3)}` : inteiro
}

/** "Pode com chuva" / "Não pode com chuva" (vazio quando não informado). */
export const textoChuva = (comChuva: boolean | null | undefined) =>
  comChuva == null ? '' : comChuva ? 'pode com chuva' : 'não pode com chuva'

/** "2 × 139,7 m³ · não pode com chuva" */
export const descreverReservatorio = (r: {
  quantidade: number | null
  capacidade_litros: number | null
  com_chuva?: boolean | null
}) =>
  [
    `${r.quantidade ?? 1} × ${r.capacidade_litros ? `${litrosParaM3(r.capacidade_litros)} m³` : 'capacidade —'}`,
    textoChuva(r.com_chuva),
  ]
    .filter(Boolean)
    .join(' · ')

/** Quantas etapas o reservatório ocupa na tela do operador. */
export const ETAPAS_RESERVATORIO = 1

/**
 * Escopo da limpeza de reservatórios (escritório): os reservatórios do local, com
 * localização, quantidade, capacidade (m³) e se dá para limpar com chuva. Ficam no modelo e valem para as próximas
 * visitas; a data da última limpeza vem das OS concluídas ou do escritório
 * (DataUltimaLimpeza), a mais recente das duas.
 */
export function EscopoReservatorio({ alvo }: { alvo: AlvoEscopo }) {
  const { modeloId, antesDeComecar } = alvo
  const pontos = usePontosModelo(modeloId)
  const salvarPontos = useSalvarPontos(alvo.osId, antesDeComecar || !!alvo.emExecucao)
  const [area, setArea] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [capacidade, setCapacidade] = useState('')
  const [comChuva, setComChuva] = useState('')
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
        <Aviso tipo="info">
          A execução já começou: o que for <strong>adicionado</strong> entra nesta OS (o técnico
          recebe quando tiver sinal). Mudanças no que já está nela valem a partir da próxima visita.
        </Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      {pontos.isPending && <Carregando />}
      <ul className="flex flex-col gap-1">
        {ativos.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              <strong>{r.area}</strong> · {descreverReservatorio(r)}
            </span>
            <Select
              aria-label={`Com chuva: ${r.area}`}
              className="w-auto"
              value={r.com_chuva == null ? '' : r.com_chuva ? 'sim' : 'nao'}
              disabled={salvarPontos.isPending}
              onChange={(e) => {
                const v = e.target.value
                void executar(
                  () =>
                    salvarPontos.mutateAsync({
                      alterar: { id: r.id, dados: { com_chuva: v === '' ? null : v === 'sim' } },
                    }),
                  `${r.area}: ${v === '' ? 'chuva não informada' : textoChuva(v === 'sim')}.`,
                )
              }}
            >
              <option value="">Com chuva?</option>
              <option value="sim">Com chuva: Sim</option>
              <option value="nao">Com chuva: Não</option>
            </Select>
            <DataUltimaLimpeza
              ponto={r}
              ocupado={salvarPontos.isPending}
              aoSalvar={(data, mensagem) =>
                executar(
                  () =>
                    salvarPontos.mutateAsync({
                      alterar: { id: r.id, dados: { limpeza_informada: data } },
                    }),
                  mensagem,
                )
              }
            />
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
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[1fr_5rem_8rem_8rem_auto] sm:items-end">
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
        <Campo rotulo="Capacidade (m³)" htmlFor="res-m3">
          <Input
            id="res-m3"
            inputMode="decimal"
            placeholder="139,70"
            value={capacidade}
            onChange={(e) => setCapacidade(mascaraM3(e.target.value))}
          />
        </Campo>
        <Campo rotulo="Com chuva?" htmlFor="res-chuva">
          <Select id="res-chuva" value={comChuva} onChange={(e) => setComChuva(e.target.value)}>
            <option value="">—</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </Select>
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
                      capacidade_litros: m3ParaLitros(capacidade),
                      com_chuva: comChuva === '' ? null : comChuva === 'sim',
                    },
                  ],
                }),
              `${nome} cadastrado.`,
            ).then((ok) => {
              if (ok) {
                setArea('')
                setCapacidade('')
                setComChuva('')
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
