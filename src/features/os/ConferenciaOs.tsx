import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import {
  useConferencia,
  useConferirOs,
  useFaturarOs,
  useSalvarConferencia,
  type Conferencia,
  type StatusOs,
} from './api'

/**
 * Conferência interna da OS (3ª camada): administrativo, logística, financeiro e
 * envio. Só o escritório vê; o banco nem devolve esta parte para o operador.
 */
export function ConferenciaOs({ osId, status }: { osId: string; status: StatusOs }) {
  const conferencia = useConferencia(osId, true)
  if (conferencia.isPending) return <Carregando />
  if (conferencia.isError) return <Aviso tipo="erro">{mensagemDeErro(conferencia.error)}</Aviso>
  if (!conferencia.data) return null
  return (
    <FormConferencia
      key={conferencia.data.os_id}
      osId={osId}
      status={status}
      inicial={conferencia.data}
    />
  )
}

type SimNao = boolean | null

function FormConferencia({
  osId,
  status,
  inicial,
}: {
  osId: string
  status: StatusOs
  inicial: Conferencia
}) {
  const perfil = usePerfil()
  const salvar = useSalvarConferencia(osId)
  const conferir = useConferirOs(osId)
  const [dados, setDados] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const concluida = status === 'concluida' || status === 'conferida'
  const muda = <K extends keyof Conferencia>(campo: K, valor: Conferencia[K]) =>
    setDados((d) => ({ ...d, [campo]: valor }))

  async function gravar(conferirDepois: boolean) {
    setErro(null)
    setSucesso(null)
    try {
      await salvar.mutateAsync({
        certificado: dados.certificado,
        cronograma: dados.cronograma,
        alteracoes: dados.alteracoes || null,
        solicitacao: dados.solicitacao,
        destinacao: dados.destinacao || null,
        logistica: dados.logistica || null,
        envio_scanner: dados.envio_scanner,
        envio_email: dados.envio_email,
        envio_relatorios: dados.envio_relatorios,
        envio_arquivo: dados.envio_arquivo,
        observacoes: dados.observacoes || null,
      })
      if (conferirDepois) await conferir.mutateAsync()
      setSucesso(conferirDepois ? 'OS conferida.' : 'Conferência salva.')
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Conferência interna</h2>
        <Etiqueta cor="cinza">Só o escritório vê</Etiqueta>
      </div>
      {!concluida && (
        <Aviso tipo="info">
          Dá para preencher já, mas só se confere depois que o operador concluir.
        </Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      <Grupo titulo="Administrativo">
        <div className="grid gap-3 sm:grid-cols-3">
          <SimNaoCampo
            rotulo="Certificado"
            valor={dados.certificado}
            aoMudar={(v) => muda('certificado', v)}
          />
          <SimNaoCampo
            rotulo="Cronograma"
            valor={dados.cronograma}
            aoMudar={(v) => muda('cronograma', v)}
          />
          <SimNaoCampo
            rotulo="Solicitação"
            valor={dados.solicitacao}
            aoMudar={(v) => muda('solicitacao', v)}
          />
        </div>
        <Campo rotulo="Alterações" htmlFor="conf-alteracoes">
          <Input
            id="conf-alteracoes"
            value={dados.alteracoes ?? ''}
            onChange={(e) => muda('alteracoes', e.target.value)}
          />
        </Campo>
        <Campo rotulo="Destinação" htmlFor="conf-destinacao">
          <Input
            id="conf-destinacao"
            value={dados.destinacao ?? ''}
            onChange={(e) => muda('destinacao', e.target.value)}
          />
        </Campo>
      </Grupo>

      <Grupo titulo="Logística">
        <Textarea
          aria-label="Logística"
          rows={2}
          value={dados.logistica ?? ''}
          onChange={(e) => muda('logistica', e.target.value)}
        />
      </Grupo>

      <Grupo titulo="Envio">
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['envio_scanner', 'Scanner da OS'],
              ['envio_email', 'OS por e-mail'],
              ['envio_relatorios', 'Relatórios'],
              ['envio_arquivo', 'Arquivo'],
            ] as const
          ).map(([campo, rotulo]) => (
            <label key={campo} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-verde"
                checked={dados[campo]}
                onChange={(e) => muda(campo, e.target.checked)}
              />
              {rotulo}
            </label>
          ))}
        </div>
      </Grupo>

      <Campo rotulo="Observações internas" htmlFor="conf-observacoes">
        <Textarea
          id="conf-observacoes"
          rows={2}
          value={dados.observacoes ?? ''}
          onChange={(e) => muda('observacoes', e.target.value)}
        />
      </Campo>

      <div className="flex flex-wrap gap-2">
        <Button
          variante="secundario"
          onClick={() => void gravar(false)}
          disabled={salvar.isPending}
        >
          Salvar conferência
        </Button>
        {status === 'concluida' && (
          <Button
            onClick={() => void gravar(true)}
            disabled={salvar.isPending || conferir.isPending}
          >
            Salvar e marcar como conferida
          </Button>
        )}
      </div>

      <Grupo titulo="Financeiro">
        {inicial.lancamento_id ? (
          <div className="flex flex-col gap-1">
            <p>
              Faturada em {formatarData(inicial.faturado_em)}:{' '}
              {formatarReais(inicial.valor_faturado)}, vencimento {formatarData(inicial.vencimento)}
              {inicial.numero_nf && `, NF ${inicial.numero_nf}`}.
            </p>
            {PAPEIS_ACESSO_TOTAL.includes(perfil.papel) && (
              <Link
                className="text-verde underline"
                to={`/financeiro/lancamentos/${inicial.lancamento_id}`}
              >
                Ver a conta a receber
              </Link>
            )}
          </div>
        ) : PAPEIS_ACESSO_TOTAL.includes(perfil.papel) ? (
          concluida ? (
            <FormFaturar osId={osId} />
          ) : (
            <p className="text-texto-suave">Fatura-se depois que o operador concluir a OS.</p>
          )
        ) : (
          <p className="text-texto-suave">
            Ainda não faturada. O faturamento é feito pelo Financeiro.
          </p>
        )}
      </Grupo>
    </Card>
  )
}

function FormFaturar({ osId }: { osId: string }) {
  const faturar = useFaturarOs(osId)
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(somarDias(hojeISO(), 10))
  const [numeroNf, setNumeroNf] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    setErro(null)
    const v = lerValor(valor)
    if (!v || v <= 0) {
      setErro('Informe o valor faturado.')
      return
    }
    try {
      await faturar.mutateAsync({ valor: v, vencimento, numeroNf: numeroNf.trim() })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Valor (R$)" htmlFor="fat-valor" obrigatorio>
          <Input
            id="fat-valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(mascaraValor(e.target.value))}
          />
        </Campo>
        <Campo rotulo="Vencimento" htmlFor="fat-vencimento" obrigatorio>
          <Input
            id="fat-vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Nº da NF" htmlFor="fat-nf">
          <Input id="fat-nf" value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} />
        </Campo>
      </div>
      <p className="text-sm text-texto-suave">
        Cria a conta a receber no Financeiro (categoria “Serviços prestados”), ligada a esta OS.
      </p>
      <Button onClick={() => void enviar()} disabled={faturar.isPending}>
        {faturar.isPending ? 'Faturando…' : 'Faturar'}
      </Button>
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-borda pt-3">
      <legend className="pr-2 font-semibold text-verde-escuro">{titulo}</legend>
      {children}
    </fieldset>
  )
}

function SimNaoCampo({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string
  valor: SimNao
  aoMudar: (valor: SimNao) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{rotulo}</span>
      <Select
        value={valor === null ? '' : valor ? 'sim' : 'nao'}
        onChange={(e) => aoMudar(e.target.value === '' ? null : e.target.value === 'sim')}
      >
        <option value="">—</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </Select>
    </label>
  )
}
