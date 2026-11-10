import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import { usePontosModelo, useSalvarPontos, type AlvoEscopo, type PontoControle } from './pragasApi'
import { etiqueta, TIPOS_BEBEDOURO, type TipoBebedouro } from './tipos/bebedouro'

/**
 * Escopo da limpeza de bebedouros (escritório): os bebedouros industriais e os de
 * garrafão do local. Como as coifas, ficam no modelo e valem para as próximas visitas.
 */
export function EscopoBebedouro({ alvo }: { alvo: AlvoEscopo }) {
  const { modeloId, antesDeComecar } = alvo
  const pontos = usePontosModelo(modeloId)
  const salvarPontos = useSalvarPontos(alvo.osId, antesDeComecar)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

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
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">
        Escopo da limpeza de bebedouros
      </h2>
      {alvo.osId && !antesDeComecar && (
        <Aviso tipo="info">A execução já começou: mudanças valem a partir da próxima visita.</Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      {pontos.isPending && <Carregando />}

      {(Object.keys(TIPOS_BEBEDOURO) as TipoBebedouro[]).map((tipo) => {
        const todos = (pontos.data ?? []).filter((p) => p.tipo === tipo)
        const ativos = todos.filter((p) => p.ativo)
        return (
          <section key={tipo} className="flex flex-col gap-2 border-t border-borda pt-3">
            <h3 className="font-semibold text-verde-escuro">
              {TIPOS_BEBEDOURO[tipo].titulo} ({ativos.length})
            </h3>
            <ul className="flex flex-col gap-1">
              {ativos.map((b) => (
                <Bebedouro
                  key={b.id}
                  bebedouro={b}
                  ocupado={salvarPontos.isPending}
                  aoAlterar={(dados, mensagem) =>
                    executar(
                      () => salvarPontos.mutateAsync({ alterar: { id: b.id, dados } }),
                      mensagem,
                    )
                  }
                />
              ))}
              {pontos.isSuccess && ativos.length === 0 && (
                <li className="text-texto-suave">Nenhum cadastrado.</li>
              )}
            </ul>
            <NovoBebedouro
              tipo={tipo}
              proximoNumero={Math.max(0, ...todos.map((p) => p.numero)) + 1}
              ocupado={salvarPontos.isPending}
              aoAdicionar={(novo) =>
                executar(
                  () =>
                    salvarPontos.mutateAsync({ novos: [{ ...novo, modelo_id: modeloId, tipo }] }),
                  `${etiqueta(novo.numero)} · ${novo.area} cadastrado.`,
                )
              }
            />
          </section>
        )
      })}
    </Card>
  )
}

function Bebedouro({
  bebedouro,
  ocupado,
  aoAlterar,
}: {
  bebedouro: PontoControle
  ocupado: boolean
  aoAlterar: (
    dados: { ativo?: boolean; codigo_filtro?: string | null },
    mensagem: string,
  ) => Promise<void>
}) {
  const [filtro, setFiltro] = useState(bebedouro.codigo_filtro ?? '')
  const mudou = filtro.trim() !== (bebedouro.codigo_filtro ?? '')
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1">
        <strong>{etiqueta(bebedouro.numero)}</strong> · {bebedouro.area}
      </span>
      <Input
        className="w-44"
        aria-label={`Código do filtro de ${bebedouro.area}`}
        placeholder="Cód. do filtro"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      {mudou && (
        <Button
          variante="secundario"
          disabled={ocupado}
          onClick={() =>
            void aoAlterar(
              { codigo_filtro: filtro.trim() || null },
              `Filtro de ${bebedouro.area} salvo.`,
            )
          }
        >
          Salvar
        </Button>
      )}
      <Button
        variante="fantasma"
        disabled={ocupado}
        onClick={() => void aoAlterar({ ativo: false }, `${bebedouro.area} retirado.`)}
      >
        Retirar
      </Button>
    </li>
  )
}

function NovoBebedouro({
  tipo,
  proximoNumero,
  ocupado,
  aoAdicionar,
}: {
  tipo: TipoBebedouro
  proximoNumero: number
  ocupado: boolean
  aoAdicionar: (novo: {
    numero: number
    area: string
    codigo_filtro: string | null
  }) => Promise<void>
}) {
  const [numero, setNumero] = useState('')
  const [area, setArea] = useState('')
  const [filtro, setFiltro] = useState('')
  const id = `beb-${tipo}`

  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[5rem_1fr_12rem_auto] sm:items-end">
      <Campo rotulo="Etiqueta" htmlFor={`${id}-numero`}>
        <Input
          id={`${id}-numero`}
          inputMode="numeric"
          placeholder={etiqueta(proximoNumero)}
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
        />
      </Campo>
      <Campo rotulo="Setor" htmlFor={`${id}-area`} dica='Ex.: "Montagem".'>
        <Input id={`${id}-area`} value={area} onChange={(e) => setArea(e.target.value)} />
      </Campo>
      <div className="col-span-2 sm:col-span-1">
        <Campo
          rotulo="Cód. do filtro"
          htmlFor={`${id}-filtro`}
          dica={TIPOS_BEBEDOURO[tipo].dicaFiltro}
        >
          <Input id={`${id}-filtro`} value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </Campo>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Button
          disabled={!area.trim() || ocupado}
          onClick={() =>
            void aoAdicionar({
              numero: Number(numero) || proximoNumero,
              area: area.trim(),
              codigo_filtro: filtro.trim() || null,
            }).then(() => {
              setNumero('')
              setArea('')
              setFiltro('')
            })
          }
        >
          Adicionar
        </Button>
      </div>
    </div>
  )
}
