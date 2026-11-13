import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import type { Json } from '@/lib/database.types'
import { mensagemDeErro } from '@/lib/erros'

import {
  usePontosModelo,
  useSalvarEscopo,
  useSalvarPontos,
  type AlvoEscopo,
  type PontoControle,
} from './pragasApi'
import { PRODUTO_PADRAO_AR, type EscopoAr } from './tipos/arCondicionado'
import { etiqueta } from './tipos/bebedouro'

type DadosAparelho = {
  area: string
  btu: number | null
  marca: string | null
  numero_serie: string | null
}

const soNumero = (texto: string) => texto.replace(/\D/g, '')

/**
 * Escopo da limpeza de ar-condicionado (escritório): os aparelhos do local (nº da
 * etiqueta, localização, BTU, marca/modelo e nº de série) e o produto. Ficam no
 * modelo e valem para as próximas visitas.
 */
export function EscopoArCondicionado({ alvo }: { alvo: AlvoEscopo }) {
  const { modeloId, antesDeComecar } = alvo
  const pontos = usePontosModelo(modeloId)
  const salvarPontos = useSalvarPontos(alvo.osId, antesDeComecar)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const todos = (pontos.data ?? []).filter((p) => p.tipo === 'ar_condicionado')
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
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">
        Escopo da limpeza de ar-condicionado
      </h2>
      {alvo.osId && !antesDeComecar && (
        <Aviso tipo="info">A execução já começou: mudanças valem a partir da próxima visita.</Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      <Produto alvo={alvo} aoSalvar={executar} />

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <h3 className="font-semibold text-verde-escuro">Aparelhos ({ativos.length})</h3>
        {pontos.isPending && <Carregando />}
        <ul className="flex flex-col gap-2">
          {ativos.map((a) => (
            <Aparelho
              key={a.id}
              aparelho={a}
              ocupado={salvarPontos.isPending}
              aoAlterar={(dados, mensagem) =>
                executar(() => salvarPontos.mutateAsync({ alterar: { id: a.id, dados } }), mensagem)
              }
            />
          ))}
          {pontos.isSuccess && ativos.length === 0 && (
            <li className="text-texto-suave">Nenhum aparelho cadastrado.</li>
          )}
        </ul>
        <NovoAparelho
          proximoNumero={Math.max(0, ...todos.map((p) => p.numero)) + 1}
          ocupado={salvarPontos.isPending}
          aoAdicionar={(novo) =>
            executar(
              () =>
                salvarPontos.mutateAsync({
                  novos: [{ ...novo, modelo_id: modeloId, tipo: 'ar_condicionado' }],
                }),
              `${etiqueta(novo.numero)} · ${novo.area} cadastrado.`,
            )
          }
        />
      </section>
    </Card>
  )
}

function Produto({
  alvo,
  aoSalvar,
}: {
  alvo: AlvoEscopo
  aoSalvar: (acao: () => Promise<unknown>, mensagem: string) => Promise<void>
}) {
  const salvarEscopo = useSalvarEscopo(alvo.osId, alvo.modeloId)
  const escopo = (alvo.escopo ?? {}) as EscopoAr
  const [produto, setProduto] = useState(escopo.produto ?? PRODUTO_PADRAO_AR)

  return (
    <div className="flex flex-col gap-2">
      <Campo
        rotulo="Produto utilizado"
        htmlFor="ar-produto"
        dica="Nome, notificação da ANVISA, lote, fabricação e validade."
      >
        <Textarea
          id="ar-produto"
          rows={2}
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
        />
      </Campo>
      <Button
        variante="secundario"
        disabled={salvarEscopo.isPending}
        onClick={() =>
          void aoSalvar(
            () => salvarEscopo.mutateAsync({ ...escopo, produto: produto.trim() } as Json),
            'Produto salvo neste local.',
          )
        }
      >
        Salvar produto
      </Button>
    </div>
  )
}

/** Campos do aparelho (os mesmos no cadastro e na alteração). */
function CamposAparelho({
  id,
  valor,
  aoMudar,
}: {
  id: string
  valor: { area: string; btu: string; marca: string; serie: string }
  aoMudar: (v: Partial<{ area: string; btu: string; marca: string; serie: string }>) => void
}) {
  return (
    <>
      <div className="col-span-2 sm:col-span-1">
        <Campo rotulo="Localização" htmlFor={`${id}-area`} dica='Ex.: "Prédio Adm - Sala TST".'>
          <Input
            id={`${id}-area`}
            value={valor.area}
            onChange={(e) => aoMudar({ area: e.target.value })}
          />
        </Campo>
      </div>
      <Campo rotulo="BTU" htmlFor={`${id}-btu`}>
        <Input
          id={`${id}-btu`}
          inputMode="numeric"
          placeholder="18000"
          value={valor.btu}
          onChange={(e) => aoMudar({ btu: soNumero(e.target.value) })}
        />
      </Campo>
      <Campo rotulo="Marca/modelo" htmlFor={`${id}-marca`}>
        <Input
          id={`${id}-marca`}
          placeholder="Midea"
          value={valor.marca}
          onChange={(e) => aoMudar({ marca: e.target.value })}
        />
      </Campo>
      <div className="col-span-2 sm:col-span-1">
        <Campo rotulo="Nº de série e fabricante" htmlFor={`${id}-serie`}>
          <Input
            id={`${id}-serie`}
            value={valor.serie}
            onChange={(e) => aoMudar({ serie: e.target.value })}
          />
        </Campo>
      </div>
    </>
  )
}

const paraTela = (a?: Pick<PontoControle, 'area' | 'btu' | 'marca' | 'numero_serie'>) => ({
  area: a?.area ?? '',
  btu: a?.btu ? String(a.btu) : '',
  marca: a?.marca ?? '',
  serie: a?.numero_serie ?? '',
})

const paraBanco = (v: ReturnType<typeof paraTela>): DadosAparelho => ({
  area: v.area.trim(),
  btu: Number(v.btu) || null,
  marca: v.marca.trim() || null,
  numero_serie: v.serie.trim() || null,
})

const GRADE = 'grid grid-cols-2 gap-2 sm:grid-cols-[1fr_6rem_8rem_10rem_auto] sm:items-end'

function Aparelho({
  aparelho,
  ocupado,
  aoAlterar,
}: {
  aparelho: PontoControle
  ocupado: boolean
  aoAlterar: (
    dados: Partial<DadosAparelho> & { ativo?: boolean },
    mensagem: string,
  ) => Promise<void>
}) {
  const original = paraTela(aparelho)
  const [valor, setValor] = useState(original)
  const mudou = JSON.stringify(valor) !== JSON.stringify(original)
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-borda p-3">
      <p className="font-semibold">Etiqueta {etiqueta(aparelho.numero)}</p>
      <div className={GRADE}>
        <CamposAparelho
          id={`ar-${aparelho.id}`}
          valor={valor}
          aoMudar={(v) => setValor({ ...valor, ...v })}
        />
        <div className="col-span-2 flex gap-1 sm:col-span-1">
          {mudou && (
            <Button
              variante="secundario"
              disabled={ocupado || !valor.area.trim()}
              onClick={() => void aoAlterar(paraBanco(valor), `${valor.area.trim()} salvo.`)}
            >
              Salvar
            </Button>
          )}
          <Button
            variante="fantasma"
            disabled={ocupado}
            onClick={() => void aoAlterar({ ativo: false }, `${aparelho.area} retirado.`)}
          >
            Retirar
          </Button>
        </div>
      </div>
    </li>
  )
}

function NovoAparelho({
  proximoNumero,
  ocupado,
  aoAdicionar,
}: {
  proximoNumero: number
  ocupado: boolean
  aoAdicionar: (novo: DadosAparelho & { numero: number }) => Promise<void>
}) {
  const [numero, setNumero] = useState('')
  const [valor, setValor] = useState(paraTela())

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-fundo-suave p-3">
      <div className="w-24">
        <Campo rotulo="Etiqueta" htmlFor="ar-novo-numero">
          <Input
            id="ar-novo-numero"
            inputMode="numeric"
            placeholder={etiqueta(proximoNumero)}
            value={numero}
            onChange={(e) => setNumero(soNumero(e.target.value))}
          />
        </Campo>
      </div>
      <div className={GRADE}>
        <CamposAparelho id="ar-novo" valor={valor} aoMudar={(v) => setValor({ ...valor, ...v })} />
        <div className="col-span-2 sm:col-span-1">
          <Button
            disabled={!valor.area.trim() || ocupado}
            onClick={() =>
              void aoAdicionar({
                ...paraBanco(valor),
                numero: Number(numero) || proximoNumero,
              }).then(() => {
                setNumero('')
                setValor(paraTela())
              })
            }
          >
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}
