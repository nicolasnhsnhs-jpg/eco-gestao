import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import type { Json } from '@/lib/database.types'
import { mensagemDeErro } from '@/lib/erros'

import { usePontosModelo, useSalvarEscopo, useSalvarPontos, type AlvoEscopo } from './pragasApi'
import { PARAMETROS_PADRAO, quantosPontos, type EscopoAgua as Escopo } from './tipos/agua'

/**
 * Escopo da análise de água (escritório): os pontos de coleta do local, os
 * parâmetros e os frascos. Ficam no modelo e valem para as próximas visitas.
 */
export function EscopoAgua({ alvo }: { alvo: AlvoEscopo }) {
  const { modeloId, antesDeComecar } = alvo
  const pontos = usePontosModelo(modeloId)
  const salvarPontos = useSalvarPontos(alvo.osId, antesDeComecar)
  const salvarEscopo = useSalvarEscopo(alvo.osId, alvo.modeloId)
  const escopo = (alvo.escopo ?? {}) as Escopo
  const [parametros, setParametros] = useState(escopo.parametros ?? PARAMETROS_PADRAO)
  const [frascos, setFrascos] = useState(escopo.frascos ?? '')
  const [area, setArea] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const todos = (pontos.data ?? []).filter((p) => p.tipo === 'ponto_coleta')
  const ativos = todos.filter((p) => p.ativo)

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

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">Escopo da análise de água</h2>
      {alvo.osId && !antesDeComecar && (
        <Aviso tipo="info">A execução já começou: mudanças valem a partir da próxima visita.</Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      <div className="flex flex-col gap-2">
        <Campo rotulo="Parâmetros" htmlFor="agua-parametros">
          <Textarea
            id="agua-parametros"
            rows={2}
            value={parametros}
            onChange={(e) => setParametros(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Frascos" htmlFor="agua-frascos" dica='Ex.: "Grupo 05 (grandes e pequenos)".'>
          <Input id="agua-frascos" value={frascos} onChange={(e) => setFrascos(e.target.value)} />
        </Campo>
        <Button
          variante="secundario"
          disabled={salvarEscopo.isPending}
          onClick={() =>
            void executar(
              () =>
                salvarEscopo.mutateAsync({
                  ...escopo,
                  parametros: parametros.trim(),
                  frascos: frascos.trim(),
                } as Json),
              'Parâmetros e frascos salvos neste local.',
            )
          }
        >
          Salvar parâmetros e frascos
        </Button>
      </div>

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <h3 className="font-semibold text-verde-escuro">
          Pontos de coleta ({quantosPontos(ativos.length)})
        </h3>
        {pontos.isPending && <Carregando />}
        <ul className="flex flex-col gap-1">
          {ativos.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="flex-1">
                <strong>{String(p.numero).padStart(2, '0')}</strong> · {p.area}
              </span>
              <Button
                variante="fantasma"
                disabled={salvarPontos.isPending}
                onClick={() =>
                  void executar(
                    () =>
                      salvarPontos.mutateAsync({ alterar: { id: p.id, dados: { ativo: false } } }),
                    `${p.area} retirado.`,
                  )
                }
              >
                Retirar
              </Button>
            </li>
          ))}
          {pontos.isSuccess && ativos.length === 0 && (
            <li className="text-texto-suave">Nenhum ponto de coleta cadastrado.</li>
          )}
        </ul>
        <div className="grid gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Campo
            rotulo="Ponto de coleta"
            htmlFor="agua-ponto"
            dica='Ex.: "Reservatório superior" ou "Torneira da cozinha".'
          >
            <Input id="agua-ponto" value={area} onChange={(e) => setArea(e.target.value)} />
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
                        tipo: 'ponto_coleta',
                        numero: Math.max(0, ...todos.map((p) => p.numero)) + 1,
                        area: nome,
                      },
                    ],
                  }),
                `${nome} cadastrado.`,
              ).then(() => setArea(''))
            }}
          >
            Adicionar
          </Button>
        </div>
      </section>
    </Card>
  )
}
