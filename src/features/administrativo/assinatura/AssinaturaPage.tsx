import { ArrowDown, ArrowUp, Copy, Download, Plus, RotateCcw, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { usePerfil } from '@/features/auth/useAuth'

import {
  arquivoHtm,
  gerarAssinatura,
  ICONES_SERVICO,
  nomeArquivoHtm,
  PADRAO_ASSINATURA,
  type DadosAssinatura,
  type IconeServico,
} from './gerarAssinatura'

const CHAVE = 'eco-assinatura-email-v1'

type CampoTexto = Exclude<keyof DadosAssinatura, 'servicos'>

const CAMPOS: { campo: CampoTexto; rotulo: string; dica?: string; placeholder?: string }[] = [
  { campo: 'nome', rotulo: 'Nome', placeholder: 'Ex.: Maria Silva' },
  { campo: 'cargo', rotulo: 'Cargo / setor', placeholder: 'Ex.: Comercial' },
  {
    campo: 'telefone',
    rotulo: 'Telefone fixo',
    dica: 'Em branco, não aparece.',
    placeholder: 'Ex.: 48 3333-4444',
  },
  {
    campo: 'whatsapp',
    rotulo: 'WhatsApp',
    dica: 'Em branco, não aparece.',
    placeholder: 'Ex.: 48 99999-8888',
  },
  { campo: 'email', rotulo: 'E-mail' },
]

const CAMPOS_UNIDADE: typeof CAMPOS = [
  { campo: 'site', rotulo: 'Site' },
  { campo: 'instagram', rotulo: 'Instagram' },
  { campo: 'rodape1', rotulo: 'Rodapé, linha 1', dica: 'O "22 anos" fica em verde.' },
  { campo: 'rodape2', rotulo: 'Rodapé, linha 2 (negrito)' },
]

const copiaPadrao = (): DadosAssinatura => structuredClone(PADRAO_ASSINATURA)

function carregar(): DadosAssinatura {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    if (salvo && Array.isArray(salvo.servicos)) return { ...copiaPadrao(), ...salvo }
  } catch {
    // sem localStorage ou dado inválido: começa do padrão
  }
  return copiaPadrao()
}

/** Copia como texto formatado, para colar direto no editor de assinaturas do Outlook. */
async function copiarFormatado(html: string) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    const temp = document.createElement('div')
    temp.innerHTML = html
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([temp.innerText], { type: 'text/plain' }),
      }),
    ])
    return
  }
  // Navegadores antigos: seleciona uma cópia escondida e usa o "copiar" do navegador.
  const temp = document.createElement('div')
  temp.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;'
  temp.innerHTML = html
  document.body.appendChild(temp)
  const faixa = document.createRange()
  faixa.selectNodeContents(temp)
  const selecao = getSelection()
  selecao?.removeAllRanges()
  selecao?.addRange(faixa)
  const ok = document.execCommand('copy')
  selecao?.removeAllRanges()
  temp.remove()
  if (!ok) throw new Error('copiar')
}

function baixar(nomeArquivo: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Gerador da assinatura de e-mail dos funcionários (Outlook clássico). */
export function AssinaturaPage() {
  const perfil = usePerfil()
  const [dados, setDados] = useState(carregar)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(dados))
    } catch {
      // sem localStorage: só não lembra os dados na próxima vez
    }
  }, [dados])

  useEffect(() => {
    if (!mensagem) return
    const t = setTimeout(() => setMensagem(null), 6000)
    return () => clearTimeout(t)
  }, [mensagem])

  const mudar = (campo: CampoTexto, valor: string) => setDados((d) => ({ ...d, [campo]: valor }))

  const mudarServicos = (fn: (s: DadosAssinatura['servicos']) => DadosAssinatura['servicos']) =>
    setDados((d) => ({ ...d, servicos: fn([...d.servicos]) }))

  const mover = (de: number, para: number) =>
    mudarServicos((s) => {
      if (para < 0 || para >= s.length) return s
      const [item] = s.splice(de, 1)
      s.splice(para, 0, item)
      return s
    })

  function usarMeusDados() {
    const tel = perfil.telefone?.trim() ?? ''
    // Celular tem 11 dígitos com DDD (9 na frente); fixo tem 10.
    const celular = tel.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').length === 11
    setDados((d) => ({
      ...d,
      nome: perfil.nome,
      email: perfil.email,
      ...(tel && (celular ? { whatsapp: tel } : { telefone: tel })),
    }))
  }

  function restaurar() {
    if (confirm('Voltar todos os campos para os dados padrão da unidade?')) setDados(copiaPadrao())
  }

  async function copiar() {
    try {
      await copiarFormatado(gerarAssinatura(dados))
      setMensagem({ tipo: 'sucesso', texto: 'Assinatura copiada! Cole no Outlook com Ctrl+V.' })
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível copiar. Use o botão "Baixar .htm".' })
    }
  }

  function baixarHtm() {
    baixar(nomeArquivoHtm(dados.nome), arquivoHtm(dados))
    setMensagem({ tipo: 'sucesso', texto: 'Arquivo baixado. Veja abaixo onde colocá-lo.' })
  }

  const campo = ({ campo: c, rotulo, dica, placeholder }: (typeof CAMPOS)[number]) => (
    <Campo key={c} rotulo={rotulo} dica={dica} htmlFor={`assinatura-${c}`}>
      <Input
        id={`assinatura-${c}`}
        value={dados[c]}
        placeholder={placeholder}
        inputMode={c === 'telefone' || c === 'whatsapp' ? 'tel' : undefined}
        type={c === 'email' ? 'email' : 'text'}
        onChange={(e) => mudar(c, e.target.value)}
      />
    </Campo>
  )

  return (
    <>
      <PageHeader
        titulo="Assinatura de e-mail"
        descricao="Preencha os dados do funcionário, confira a prévia e copie para o Outlook."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,400px)_1fr]">
        <Card className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Funcionário</h2>
            <Button variante="secundario" className="min-h-9 text-sm" onClick={usarMeusDados}>
              <UserRound className="size-4" aria-hidden /> Usar meus dados
            </Button>
          </div>
          {CAMPOS.map(campo)}

          <h2 className="mt-2 text-lg font-bold">Dados da unidade</h2>
          {CAMPOS_UNIDADE.map(campo)}

          <h2 className="mt-2 text-lg font-bold">Nossos serviços</h2>
          <ul className="flex flex-col gap-2">
            {dados.servicos.map((s, i) => (
              <li key={i} className="flex items-center gap-1">
                <Select
                  aria-label={`Ícone do serviço ${i + 1}`}
                  className="w-32 shrink-0 text-sm"
                  value={s.icone}
                  onChange={(e) =>
                    mudarServicos((lista) => {
                      lista[i] = { ...lista[i], icone: e.target.value as IconeServico }
                      return lista
                    })
                  }
                >
                  {Object.entries(ICONES_SERVICO).map(([valor, nome]) => (
                    <option key={valor} value={valor}>
                      {nome}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label={`Serviço ${i + 1}`}
                  className="min-w-0 text-sm"
                  value={s.texto}
                  onChange={(e) =>
                    mudarServicos((lista) => {
                      lista[i] = { ...lista[i], texto: e.target.value }
                      return lista
                    })
                  }
                />
                <BotaoIcone rotulo="Subir" onClick={() => mover(i, i - 1)}>
                  <ArrowUp className="size-4" aria-hidden />
                </BotaoIcone>
                <BotaoIcone rotulo="Descer" onClick={() => mover(i, i + 1)}>
                  <ArrowDown className="size-4" aria-hidden />
                </BotaoIcone>
                <BotaoIcone
                  rotulo="Remover"
                  onClick={() => mudarServicos((lista) => lista.filter((_, j) => j !== i))}
                >
                  <X className="size-4" aria-hidden />
                </BotaoIcone>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variante="secundario"
              onClick={() => mudarServicos((lista) => [...lista, { icone: 'check', texto: '' }])}
            >
              <Plus className="size-4" aria-hidden /> Adicionar serviço
            </Button>
            <Button variante="fantasma" onClick={restaurar}>
              <RotateCcw className="size-4" aria-hidden /> Restaurar padrão
            </Button>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <h2 className="mb-3 text-lg font-bold">Pré-visualização</h2>
            <div className="overflow-x-auto rounded-xl border border-dashed border-borda bg-white p-4">
              {/* O HTML é montado pelo gerarAssinatura, que escapa tudo o que foi digitado. */}
              <div dangerouslySetInnerHTML={{ __html: gerarAssinatura(dados) }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={copiar}>
                <Copy className="size-4" aria-hidden /> Copiar assinatura
              </Button>
              <Button variante="secundario" onClick={baixarHtm}>
                <Download className="size-4" aria-hidden /> Baixar .htm
              </Button>
            </div>
            {mensagem && (
              <div className="mt-3">
                <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>
              </div>
            )}
          </Card>

          <Card className="text-sm leading-relaxed">
            <h2 className="mb-2 text-lg font-bold">Como instalar no Outlook</h2>
            <p className="mb-1 font-semibold">Copiando e colando</p>
            <ol className="mb-3 list-decimal pl-5">
              <li>
                Clique em <b>Copiar assinatura</b>.
              </li>
              <li>
                No Outlook: <b>Arquivo › Opções › Email › Assinaturas...</b>
              </li>
              <li>
                Clique em <b>Novo</b>, dê um nome e cole na caixa grande (<b>Ctrl+V</b>).
              </li>
              <li>
                Em <b>Escolher assinatura padrão</b>, selecione a conta e a assinatura em{' '}
                <b>Novas mensagens</b> e <b>Respostas/encaminhamentos</b>. Clique em OK.
              </li>
            </ol>
            <p className="mb-1 font-semibold">Pelo arquivo .htm</p>
            <ol className="mb-3 list-decimal pl-5">
              <li>
                Clique em <b>Baixar .htm</b> e feche o Outlook.
              </li>
              <li>
                Aperte <b>Windows + R</b>, digite <code>%APPDATA%\Microsoft\Signatures</code> e
                Enter.
              </li>
              <li>Copie o arquivo para essa pasta e abra o Outlook.</li>
              <li>
                Em <b>Arquivo › Opções › Email › Assinaturas</b>, defina como padrão.
              </li>
            </ol>
            <p className="text-texto-suave">
              As imagens vêm do site ecoambientalsc.com.br. Quem recebe pode precisar clicar em
              &quot;Baixar imagens&quot; para vê-las. O e-mail precisa estar no formato HTML.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
