import './quadroAgenda.css'

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'

import {
  densidade,
  coresDasEscalas,
  escalaDoTecnico,
  type CorEscala,
  itensDoQuadro,
  lerEscalas,
  partesDaDescricao,
  resumoDoDia,
  horarioForaDoTexto,
  trechosComHorario,
  turnoDe,
  type AgendaDia,
  type AgendaItem,
  type Escala,
  type Veiculo,
  veiculosSemSemParar,
} from './regras'

/*
 * O quadro da agenda (1920x1080), igual na prévia, na TV e na imagem do WhatsApp.
 *   modo "tela"   prévia enquanto preenche (as linhas são clicáveis)
 *   modo "tv"     relógio ao vivo
 *   modo "imagem" sem R e F: é conferência interna do ADM, não vai para os operadores
 */

export const LARGURA_QUADRO = 1920
export const ALTURA_QUADRO = 1080

type Modo = 'tela' | 'tv' | 'imagem'

type Props = {
  dia: AgendaDia
  itens: AgendaItem[]
  /** Cadastro de veículos: de onde sai a lista dos que não têm Sem Parar. */
  veiculos: Veiculo[]
  modo: Modo
  onClicarItem?: (id: string) => void
  ref?: Ref<HTMLDivElement>
  style?: React.CSSProperties
}

const ESTRELA = (
  <span className="aq-estrela">
    <svg viewBox="0 0 24 24">
      <path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18.3 5.5 22l1.7-7.4-5.7-5 7.5-.7z" />
    </svg>
  </span>
)

function HorarioBrilhando({ texto }: { texto: string }) {
  return (
    <span className="aq-horario">
      {ESTRELA}
      {texto}
    </span>
  )
}

/** Texto com os horários ("às 6h") brilhando com estrela. */
function ComHorario({ texto }: { texto: string }) {
  return trechosComHorario(texto).map((t, i) =>
    t.horario ? (
      <HorarioBrilhando key={i} texto={t.texto} />
    ) : (
      <Fragment key={i}>{t.texto}</Fragment>
    ),
  )
}

const ICONE_PERIODO = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)

const ICONE_NOTA = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M12 8v5M12 16.5v.5" />
    <circle cx="12" cy="12" r="9" />
  </svg>
)

/** Prato com garfo e faca: coluna do almoço. */
const ICONE_ALMOCO = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <path d="M3 3v6a1.5 1.5 0 0 0 3 0V3M4.5 9v12M21 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" />
  </svg>
)

const CHECK = (
  <svg viewBox="0 0 24 24">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/** Volta para almoçar na empresa: verde volta, vermelho não dá, traço não se aplica. */
function Almoco({ valor }: { valor: string }) {
  if (valor === 'volta') return <span className="aq-st aq-verde">{CHECK}</span>
  if (valor === 'fica') return <span className="aq-st aq-vermelho" />
  return <span className="aq-st aq-traco">–</span>
}

function Feito({ sim }: { sim: boolean }) {
  return sim ? <span className="aq-st aq-verde">{CHECK}</span> : <span className="aq-st aq-vazio" />
}

function Tecnico({ n, escalas, cores }: { n: number; escalas: Escala[]; cores: CorEscala[] }) {
  const e = escalaDoTecnico(n, escalas)
  return <span className={e < 0 ? 'aq-tec aq-sem' : 'aq-tec aq-' + cores[e]}>{n}</span>
}

export function Placa({ placa, semSemParar }: { placa: string; semSemParar?: boolean }) {
  return (
    <span className="aq-placa">
      {placa}
      {semSemParar && <span className="aq-semparar">!</span>}
    </span>
  )
}

function horaDe(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return { hm: `${p(d.getHours())}:${p(d.getMinutes())}`, s: p(d.getSeconds()) }
}

function Relogio() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const h = horaDe(agora)
  return (
    <div className="aq-relogio">
      <div className="aq-rot">Agora</div>
      <div className="aq-hora">
        {h.hm}
        <small>{h.s}</small>
      </div>
    </div>
  )
}

export function QuadroAgenda({ dia, itens, veiculos, modo, onClicarItem, ref, style }: Props) {
  const escalas = lerEscalas(dia.escalas)
  const cores = coresDasEscalas(escalas)
  const listaSemParar = veiculosSemSemParar(veiculos)
  const semParar = new Set(listaSemParar)
  const linhas = itensDoQuadro(itens)
  const resumo = resumoDoDia(itens)
  const interno = modo !== 'imagem'
  const data = new Date(`${dia.data}T12:00:00`)
  const observacoes = dia.observacoes
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)

  // Hora da última mudança (aparece no lugar do relógio na prévia e na imagem).
  const ultima = [dia.atualizado_em, ...itens.map((i) => i.atualizado_em)].sort().at(-1)

  // Marca onde começa cada turno. O horário aparece em todas as linhas.
  const linhasComGrupo = linhas.map((x, i) => {
    const anterior = linhas[i - 1]
    return { x, novoTurno: !anterior || turnoDe(anterior.hora) !== turnoDe(x.hora) }
  })

  return (
    <div
      ref={ref}
      className="aq-palco"
      data-densidade={densidade(linhas.length)}
      data-interno={interno ? 'sim' : 'nao'}
      style={style}
    >
      <header className="aq-cab">
        <img className="aq-logo" src="/certificados/logo.png" alt="Eco-Ambiental" />
        <div className="aq-divisor" />
        <div>
          <div className="aq-dia-semana">
            {data.toLocaleDateString('pt-BR', { weekday: 'long' })}
          </div>
          <div className="aq-dia">
            {data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="aq-espaco" />
        <div className="aq-resumo">
          <div>
            <b>{resumo.servicos}</b>
            <span>Serviços</span>
          </div>
          <div>
            <b>{resumo.tecnicos}</b>
            <span>Técnicos</span>
          </div>
          <div>
            <b>{resumo.veiculos}</b>
            <span>Veículos</span>
          </div>
        </div>
        {modo === 'tv' ? (
          <Relogio />
        ) : (
          <div className="aq-relogio">
            <div className="aq-rot">Atualizada às</div>
            <div className="aq-hora">{ultima ? horaDe(new Date(ultima)).hm : '--:--'}</div>
          </div>
        )}
      </header>

      <main className="aq-corpo">
        <section className="aq-quadro">
          <div className="aq-linha aq-titulos">
            <div>Hora</div>
            <div>Empresa e serviço</div>
            <div className="aq-c">Técnicos</div>
            <div className="aq-c">Veículo</div>
            <div className="aq-c" title="Volta para almoçar na empresa">
              {ICONE_ALMOCO}
            </div>
            {interno && (
              <div className="aq-c" title="Realizado">
                R
              </div>
            )}
            {interno && (
              <div className="aq-c" title="Faturado">
                F
              </div>
            )}
          </div>
          <div className="aq-lista">
            {linhas.length === 0 && <div className="aq-vazio">Nenhum serviço na agenda ainda</div>}
            {linhasComGrupo.map(({ x, novoTurno }, i) => {
              const partes = partesDaDescricao(x.descricao)
              // Horário do campo, ao lado do cliente (antes do período e da observação).
              const foraDoTexto = horarioForaDoTexto(x.descricao, x.chegada)
              return (
                <Fragment key={x.id}>
                  {novoTurno && <div className="aq-turno">{turnoDe(x.hora)}</div>}
                  <div
                    className={[
                      'aq-linha aq-item',
                      i % 2 === 1 && 'aq-par',
                      onClicarItem && 'aq-clicavel',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={onClicarItem ? () => onClicarItem(x.id) : undefined}
                  >
                    <div className="aq-hora-txt">{x.hora}</div>
                    <div className="aq-serv">
                      {partes.map(([emp, desc], i) => (
                        <Fragment key={i}>
                          {i > 0 && <span className="aq-sep">/</span>}
                          <span>
                            <b>
                              <ComHorario texto={emp} />
                            </b>
                            {desc && (
                              <>
                                <span className="aq-sep"> · </span>
                                <span className="aq-desc">
                                  <ComHorario texto={desc} />
                                </span>
                              </>
                            )}
                            {x.avulso_partes.includes(i) && (
                              <>
                                {' '}
                                <span className="aq-chip aq-avulso">Avulso</span>
                              </>
                            )}
                            {i === 0 && foraDoTexto && (
                              <>
                                {' '}
                                <HorarioBrilhando texto={foraDoTexto} />
                              </>
                            )}
                          </span>
                        </Fragment>
                      ))}
                      {x.periodo.trim() && (
                        <span className="aq-chip aq-periodo">
                          {ICONE_PERIODO}
                          {x.periodo.trim()}
                        </span>
                      )}
                      {x.nota.trim() && (
                        <span className="aq-chip aq-nota">
                          {ICONE_NOTA}
                          {x.nota.trim()}
                        </span>
                      )}
                    </div>
                    <div className="aq-tecs">
                      {x.tecnicos.map((n) => (
                        <Tecnico key={n} n={n} escalas={escalas} cores={cores} />
                      ))}
                    </div>
                    <div className="aq-c">
                      {x.veiculo.trim() && (
                        <Placa
                          placa={x.veiculo.trim().toUpperCase()}
                          semSemParar={semParar.has(x.veiculo.trim().toUpperCase())}
                        />
                      )}
                    </div>
                    <div className="aq-c">
                      <Almoco valor={x.almoco} />
                    </div>
                    {interno && (
                      <div className="aq-c">
                        <Feito sim={x.realizado} />
                      </div>
                    )}
                    {interno && (
                      <div className="aq-c">
                        <Feito sim={x.faturado} />
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            })}
          </div>
          <div className="aq-legenda">
            {escalas.slice(0, 3).map((e, i) => (
              <span key={i}>
                <i className={'aq-' + cores[i]} />
                Escala {e.inicio}–{e.fim}
              </span>
            ))}
            <span>
              <span className="aq-st aq-verde aq-mini">{CHECK}</span> Volta almoçar na empresa
            </span>
            <span>
              <HorarioBrilhando texto="às 9h" /> Horário marcado com o cliente
            </span>
            <span>
              <span className="aq-chip aq-avulso">Avulso</span> Atendimento avulso
            </span>
            {interno && <span>R realizado · F faturado</span>}
          </div>
        </section>

        <aside className="aq-lateral">
          <div className="aq-cartao aq-escala">
            <div className="aq-titulo">Escala operacional</div>
            {escalas.map((e, i) => (
              <div className="aq-turma" key={i}>
                <div className="aq-turma-hora">
                  {e.inicio}
                  <span>às</span>
                  {e.fim}
                </div>
                <div className="aq-tecs">
                  {e.tecnicos.map((n) => (
                    <span key={n} className={'aq-tec aq-' + cores[i]}>
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {listaSemParar.length > 0 && (
            <div className="aq-cartao aq-veiculos">
              <div className="aq-titulo">Veículos sem Sem Parar</div>
              <p>Atenção ao pedágio com estes veículos</p>
              <div className="aq-placas">
                {listaSemParar.map((p) => (
                  <Placa key={p} placa={p} />
                ))}
              </div>
            </div>
          )}
          <div className={observacoes.length ? 'aq-cartao aq-obs aq-tem' : 'aq-cartao aq-obs'}>
            <div className="aq-titulo">Observações</div>
            {observacoes.length ? (
              <ul>
                {observacoes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            ) : (
              <div className="aq-obs-vazio">Nenhuma observação para hoje</div>
            )}
          </div>
          {dia.mensagem.trim() && (
            <div className="aq-cartao aq-mensagem">
              <div className="aq-mensagem-icone">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2c3 4.5 6 8 6 11.5A6 6 0 0 1 6 13.5C6 10 9 6.5 12 2z" />
                </svg>
              </div>
              <div>
                <b>{dia.mensagem.trim()}</b>
                <small>Equipe Eco-Ambiental</small>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}

/**
 * Encaixa o quadro de 1920x1080 no espaço disponível.
 * "largura": ocupa a largura (prévia); "tela": cabe inteiro (TV).
 */
export function QuadroAjustado({
  ajuste,
  children,
}: {
  ajuste: 'largura' | 'tela'
  children: (escala: number) => ReactNode
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.5)

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => {
      const k =
        ajuste === 'largura'
          ? el.clientWidth / LARGURA_QUADRO
          : Math.min(el.clientWidth / LARGURA_QUADRO, el.clientHeight / ALTURA_QUADRO)
      if (k > 0) setEscala(k)
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [ajuste])

  return (
    <div
      ref={caixa}
      className="relative w-full overflow-hidden"
      style={ajuste === 'largura' ? { height: ALTURA_QUADRO * escala } : { height: '100%' }}
    >
      <div
        style={
          ajuste === 'tela'
            ? {
                position: 'absolute',
                left: '50%',
                top: '50%',
                marginLeft: (-LARGURA_QUADRO * escala) / 2,
                marginTop: (-ALTURA_QUADRO * escala) / 2,
              }
            : undefined
        }
      >
        {children(escala)}
      </div>
    </div>
  )
}
