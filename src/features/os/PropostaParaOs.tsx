import { CalendarClock, FileText, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import {
  horaCurta,
  usePropostas,
  type PropostaCompleta,
  type PropostaResumo,
} from '../propostas/api'
import { nomeFrequencia } from '../propostas/modelos'

/*
 * Na OS avulsa: buscar uma proposta aprovada e deixá-la aberta ao lado,
 * para ir preenchendo a OS olhando para ela.
 */

const sem = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** As que têm execução marcada vêm primeiro (as mais próximas no alto). */
function ordenar(a: PropostaResumo, b: PropostaResumo) {
  const hoje = hojeISO()
  const chave = (p: PropostaResumo) =>
    p.execucao_data
      ? `${p.execucao_data < hoje ? '1' : '0'}${p.execucao_data}${p.execucao_hora ?? ''}`
      : `2${p.data_resposta ?? ''}`
  return chave(a).localeCompare(chave(b))
}

export function EscolherProposta({ aoEscolher }: { aoEscolher: (p: PropostaResumo) => void }) {
  const propostas = usePropostas()
  const [busca, setBusca] = useState('')
  const aprovadas = (propostas.data ?? []).filter((p) => p.status === 'aprovada').sort(ordenar)
  const termo = sem(busca.trim())
  const lista = aprovadas
    .filter(
      (p) =>
        !termo ||
        sem([p.numero, p.cliente?.nome, p.cliente?.nome_fantasia].join(' ')).includes(termo),
    )
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-2">
      <label className="relative">
        <span className="sr-only">Buscar proposta aprovada</span>
        <Search
          className="pointer-events-none absolute top-3 left-3 size-5 text-texto-suave"
          aria-hidden
        />
        <Input
          type="search"
          className="pl-10"
          placeholder="Cliente ou número da proposta"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>
      {propostas.isPending && <Carregando />}
      {propostas.isError && <Aviso tipo="erro">{mensagemDeErro(propostas.error)}</Aviso>}
      {propostas.isSuccess && lista.length === 0 && (
        <p className="text-sm text-texto-suave">Nenhuma proposta aprovada encontrada.</p>
      )}
      {lista.length > 0 && (
        <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
          {lista.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aoEscolher(p)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-lima-claro"
              >
                <FileText className="size-5 shrink-0 text-verde" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {p.cliente?.nome_fantasia || p.cliente?.nome}
                  </span>
                  <span className="block truncate text-sm text-texto-suave">
                    {[
                      p.numero,
                      p.execucao_data
                        ? `execução ${formatarData(p.execucao_data)}${p.execucao_hora ? ` ${horaCurta(p.execucao_hora)}` : ''}`
                        : `aprovada ${formatarData(p.data_resposta)}`,
                      p.vendedor?.nome,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A proposta aberta ao lado da OS: só o que serve para preencher (sem valores). */
export function PainelProposta({ p, aoFechar }: { p: PropostaCompleta; aoFechar: () => void }) {
  return (
    <Card className="flex flex-col gap-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
            Proposta aprovada
          </p>
          <h2 className="text-lg font-bold">
            {p.numero} · {p.cliente?.nome_fantasia || p.cliente?.nome}
          </h2>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar proposta"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-verde-escuro hover:bg-lima-claro"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {p.execucao_data && (
        <p className="flex items-center gap-2 rounded-lg bg-lima-claro px-3 py-2 font-semibold text-verde-escuro">
          <CalendarClock className="size-4" aria-hidden />
          Execução combinada: {formatarData(p.execucao_data)}
          {p.execucao_hora && ` às ${horaCurta(p.execucao_hora)}`}
        </p>
      )}

      <dl className="grid gap-2">
        {p.endereco && (
          <Dado
            rotulo="Endereço"
            valor={[
              p.endereco.apelido,
              `${p.endereco.logradouro}, ${p.endereco.numero ?? 's/n'}`,
              `${p.endereco.cidade}/${p.endereco.uf}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        )}
        {(p.contato_nome || p.contato_telefone || p.contato_email) && (
          <Dado
            rotulo="A/C"
            valor={[p.contato_nome, p.contato_telefone, p.contato_email].filter(Boolean).join('\n')}
          />
        )}
        {p.vendedor?.nome && <Dado rotulo="Vendedor" valor={p.vendedor.nome} />}
      </dl>

      <div className="flex flex-col gap-3">
        {p.itens.map((i) => (
          <section key={i.id} className="rounded-xl border border-borda bg-fundo-suave p-3">
            <h3 className="font-bold">{i.titulo || i.descricao}</h3>
            <p className="text-texto-suave">
              {[
                i.titulo && i.descricao !== i.titulo ? i.descricao : null,
                i.tipo?.nome,
                `${Number(i.quantidade).toLocaleString('pt-BR')}×`,
                i.frequencia
                  ? nomeFrequencia(i.frequencia).toLowerCase()
                  : i.periodicidade_meses && `a cada ${i.periodicidade_meses} meses`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <Texto rotulo="Escopo" valor={i.escopo} />
            <Texto rotulo="Metodologia" valor={i.metodologia} />
            <Texto rotulo="Recursos" valor={i.recursos} />
          </section>
        ))}
      </div>

      {p.observacoes && <Texto rotulo="Observações da proposta" valor={p.observacoes} />}

      <Link
        to={`/propostas/${p.id}`}
        target="_blank"
        className="self-start font-semibold text-verde underline"
      >
        Abrir a proposta completa
      </Link>
    </Card>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="font-semibold whitespace-pre-line">{valor}</dd>
    </div>
  )
}

function Texto({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor?.trim()) return null
  return (
    <div className="mt-2">
      <p className="font-semibold">{rotulo}</p>
      {/* Como no PDF: **texto** sai em negrito. */}
      <p className="whitespace-pre-line">
        {valor
          .split('**')
          .map((pedaco, i) => (i % 2 === 1 ? <strong key={i}>{pedaco}</strong> : pedaco))}
      </p>
    </div>
  )
}
