import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import type { Json } from '@/lib/database.types'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import type { OsCompleta } from './api'
import { usePontosModelo, useSalvarPontos } from './pragasApi'
import { MATERIAIS, PRODUTO_PADRAO, type EscopoCoifa as Escopo } from './tipos/coifa'

/**
 * Escopo da limpeza de coifa (escritório): as coifas do local e o produto padrão.
 * Como os porta-iscas, as coifas ficam no modelo e valem para as próximas visitas.
 */
export function EscopoCoifa({ os }: { os: OsCompleta }) {
  const pontos = usePontosModelo(os.modelo_id)
  const antesDeComecar = os.status === 'rascunho' || os.status === 'agendada'
  const salvarPontos = useSalvarPontos(os.id, antesDeComecar)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const coifas = pontos.data?.filter((p) => p.tipo === 'coifa' && p.ativo) ?? []

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    setErro(null)
    setSucesso(null)
    try {
      await acao()
      setSucesso(mensagem)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (!os.modelo_id) return <Aviso tipo="info">Esta OS não tem modelo, então não tem coifas.</Aviso>

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">
        Escopo da limpeza de coifa
      </h2>
      {!antesDeComecar && (
        <Aviso tipo="info">A execução já começou: mudanças valem a partir da próxima visita.</Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      <Produto os={os} aoSalvar={executar} />

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <h3 className="font-semibold text-verde-escuro">Coifas ({coifas.length})</h3>
        {pontos.isPending && <Carregando />}
        <ul className="flex flex-col gap-1">
          {coifas.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="flex-1">
                {c.quantidade ?? 1}× <strong>{c.area}</strong> ·{' '}
                {MATERIAIS[c.material as keyof typeof MATERIAIS]} · {c.quantidade_telas ?? 0}{' '}
                tela(s)
              </span>
              <Button
                variante="fantasma"
                disabled={salvarPontos.isPending}
                onClick={() =>
                  void executar(
                    () =>
                      salvarPontos.mutateAsync({ alterar: { id: c.id, dados: { ativo: false } } }),
                    `${c.area} retirada.`,
                  )
                }
              >
                Retirar
              </Button>
            </li>
          ))}
          {pontos.isSuccess && coifas.length === 0 && (
            <li className="text-texto-suave">Nenhuma coifa cadastrada.</li>
          )}
        </ul>
        <NovaCoifa
          proximoNumero={
            Math.max(
              0,
              ...(pontos.data ?? []).filter((p) => p.tipo === 'coifa').map((p) => p.numero),
            ) + 1
          }
          ocupado={salvarPontos.isPending}
          aoAdicionar={(nova) =>
            executar(
              () =>
                salvarPontos.mutateAsync({
                  novos: [{ ...nova, modelo_id: os.modelo_id!, tipo: 'coifa' }],
                }),
              `${nova.area} cadastrada.`,
            )
          }
        />
      </section>
    </Card>
  )
}

function Produto({
  os,
  aoSalvar,
}: {
  os: OsCompleta
  aoSalvar: (acao: () => Promise<unknown>, mensagem: string) => Promise<void>
}) {
  const queryClient = useQueryClient()
  const [produto, setProduto] = useState(((os.escopo ?? {}) as Escopo).produto ?? PRODUTO_PADRAO)

  async function salvar() {
    const escopo = { ...((os.escopo ?? {}) as Escopo), produto: produto.trim() } as Json
    const r = await supabase.from('ordens_servico').update({ escopo }).eq('id', os.id)
    if (r.error) throw r.error
    if (os.modelo_id) {
      const m = await supabase.from('os_modelos').update({ escopo }).eq('id', os.modelo_id)
      if (m.error) throw m.error
    }
    void queryClient.invalidateQueries({ queryKey: ['os'] })
  }

  return (
    <div className="flex flex-col gap-2">
      <Campo rotulo="Produto padrão" htmlFor="coifa-produto">
        <Textarea
          id="coifa-produto"
          rows={2}
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
        />
      </Campo>
      <Button
        variante="secundario"
        onClick={() => void aoSalvar(salvar, 'Produto salvo neste local.')}
      >
        Salvar produto
      </Button>
    </div>
  )
}

function NovaCoifa({
  proximoNumero,
  ocupado,
  aoAdicionar,
}: {
  proximoNumero: number
  ocupado: boolean
  aoAdicionar: (nova: {
    numero: number
    area: string
    material: string
    quantidade: number
    quantidade_telas: number
  }) => Promise<void>
}) {
  const [area, setArea] = useState('')
  const [material, setMaterial] = useState('inox')
  const [quantidade, setQuantidade] = useState('1')
  const [telas, setTelas] = useState('0')

  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[1fr_8rem_6rem_6rem_auto] sm:items-end">
      <div className="col-span-2 sm:col-span-1">
        <Campo rotulo="Localização da coifa" htmlFor="coifa-area" dica='Ex.: "Coifa do fogão".'>
          <Input id="coifa-area" value={area} onChange={(e) => setArea(e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Material" htmlFor="coifa-material">
        <Select id="coifa-material" value={material} onChange={(e) => setMaterial(e.target.value)}>
          {Object.entries(MATERIAIS).map(([codigo, nome]) => (
            <option key={codigo} value={codigo}>
              {nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Qtde" htmlFor="coifa-quantidade">
        <Input
          id="coifa-quantidade"
          inputMode="numeric"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
        />
      </Campo>
      <Campo rotulo="Telas" htmlFor="coifa-telas">
        <Input
          id="coifa-telas"
          inputMode="numeric"
          value={telas}
          onChange={(e) => setTelas(e.target.value.replace(/\D/g, ''))}
        />
      </Campo>
      <Button
        disabled={!area.trim() || ocupado}
        onClick={() =>
          void aoAdicionar({
            numero: proximoNumero,
            area: area.trim(),
            material,
            quantidade: Math.max(1, Number(quantidade) || 1),
            quantidade_telas: Number(telas) || 0,
          }).then(() => setArea(''))
        }
      >
        Adicionar
      </Button>
    </div>
  )
}
