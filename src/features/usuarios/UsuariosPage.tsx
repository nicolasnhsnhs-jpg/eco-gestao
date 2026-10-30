import { zodResolver } from '@hookform/resolvers/zod'
import { HardHat, KeyRound, Pencil, Repeat, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { mensagemDeErro } from '@/lib/erros'
import { DOMINIO_OPERADOR, NOME_DO_PAPEL, PAPEIS, type Papel } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import {
  useAlterarComissao,
  useAlterarNome,
  useAlterarPapel,
  useAlternarAtivo,
  useClientesPorVendedor,
  useConvidarUsuario,
  useCriarOperador,
  useDefinirSenha,
  useTransferirCarteira,
  useUsuarios,
  type Usuario,
} from './api'

const DESCRICAO_PAPEL: Record<Papel, string> = {
  admin: 'Acesso total, inclusive usuários',
  financeiro: 'Acesso total, menos usuários',
  vendedor: 'Só os próprios clientes, sem financeiro',
  recepcao: 'Pesquisa e cadastra clientes, sem financeiro',
  operador: 'Só as ordens de serviço atribuídas a ele',
}

const SENHA_MINIMA = 8

export function UsuariosPage() {
  const eu = usePerfil()
  const usuarios = useUsuarios()
  const carteiras = useClientesPorVendedor()
  const alterarPapel = useAlterarPapel()
  const alterarNome = useAlterarNome()
  const alterarComissao = useAlterarComissao()
  const alternarAtivo = useAlternarAtivo()
  const definirSenha = useDefinirSenha()
  const [convidando, setConvidando] = useState(false)
  const [criandoOperador, setCriandoOperador] = useState(false)
  const [transferindoDe, setTransferindoDe] = useState<Usuario | null>(null)
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
    <>
      <PageHeader
        titulo="Usuários"
        descricao="Quem acessa o sistema e o que cada pessoa pode ver."
        acoes={
          <>
            <Button variante="secundario" onClick={() => setCriandoOperador(true)}>
              <HardHat className="size-5" aria-hidden /> Novo operador
            </Button>
            <Button onClick={() => setConvidando(true)}>
              <UserPlus className="size-5" aria-hidden /> Convidar
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      </div>

      {usuarios.isPending && <Carregando />}
      {usuarios.isError && <Aviso tipo="erro">{mensagemDeErro(usuarios.error)}</Aviso>}

      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
        {usuarios.data?.map((u) => {
          const souEu = u.id === eu.id
          const clientes = carteiras.data?.get(u.id) ?? 0
          return (
            <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {u.nome}
                  <BotaoIcone
                    rotulo={`Editar o nome de ${u.nome}`}
                    onClick={() => {
                      const nome = window.prompt('Nome do usuário:', u.nome)?.trim()
                      if (!nome || nome === u.nome) return
                      void executar(
                        () => alterarNome.mutateAsync({ usuarioId: u.id, nome }),
                        `Nome alterado para ${nome}.`,
                      )
                    }}
                  >
                    <Pencil className="size-4" />
                  </BotaoIcone>
                  {souEu && <Etiqueta cor="verde">Você</Etiqueta>}
                  {!u.ativo && <Etiqueta cor="perigo">Desativado</Etiqueta>}
                </p>
                <p className="truncate text-sm text-texto-suave">{u.email}</p>
                {clientes > 0 && (
                  <p className="text-sm text-texto-suave">
                    {clientes} {clientes === 1 ? 'cliente' : 'clientes'} na carteira
                  </p>
                )}
                {u.papel !== 'recepcao' && u.papel !== 'operador' && (
                  <button
                    type="button"
                    className="text-sm text-texto-suave underline"
                    onClick={() => {
                      const resposta = window.prompt(
                        'Comissão própria deste usuário, em % (vazio = padrão da empresa para vendedores; outros perfis sem % não recebem comissão):',
                        u.comissao_percentual?.toString() ?? '',
                      )
                      if (resposta === null) return
                      const texto = resposta.trim().replace(',', '.')
                      const percentual = texto === '' ? null : Number(texto)
                      if (
                        percentual !== null &&
                        (Number.isNaN(percentual) || percentual < 0 || percentual > 100)
                      ) {
                        setErro('Informe um percentual entre 0 e 100.')
                        return
                      }
                      void executar(
                        () => alterarComissao.mutateAsync({ usuarioId: u.id, percentual }),
                        `Comissão de ${u.nome} atualizada.`,
                      )
                    }}
                  >
                    Comissão:{' '}
                    {u.comissao_percentual != null
                      ? `${Number(u.comissao_percentual).toLocaleString('pt-BR')}% (própria)`
                      : u.papel === 'vendedor'
                        ? 'padrão da empresa'
                        : 'não recebe'}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={`Perfil de ${u.nome}`}
                  className="w-auto"
                  value={u.papel}
                  disabled={souEu || !u.ativo || alterarPapel.isPending}
                  onChange={(e) => {
                    const papel = e.target.value as Papel
                    void executar(
                      () => alterarPapel.mutateAsync({ usuarioId: u.id, papel }),
                      `${u.nome} agora é ${NOME_DO_PAPEL[papel]}.`,
                    )
                  }}
                >
                  {PAPEIS.map((p) => (
                    <option key={p} value={p}>
                      {NOME_DO_PAPEL[p]}
                    </option>
                  ))}
                </Select>

                {u.papel === 'operador' && u.ativo && (
                  <Button
                    variante="secundario"
                    disabled={definirSenha.isPending}
                    onClick={() => {
                      const senha = window.prompt(
                        `Nova senha de ${u.nome} (mínimo ${SENHA_MINIMA} caracteres):`,
                      )
                      if (senha === null) return
                      if (senha.length < SENHA_MINIMA) {
                        setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
                        return
                      }
                      void executar(
                        () => definirSenha.mutateAsync({ usuarioId: u.id, senha }),
                        `Senha de ${u.nome} alterada. Passe a nova senha para ele pessoalmente.`,
                      )
                    }}
                  >
                    <KeyRound className="size-4" aria-hidden /> Definir senha
                  </Button>
                )}

                {clientes > 0 && (
                  <Button variante="secundario" onClick={() => setTransferindoDe(u)}>
                    <Repeat className="size-4" aria-hidden /> Transferir carteira
                  </Button>
                )}

                {!souEu && (
                  <Button
                    variante={u.ativo ? 'fantasma' : 'secundario'}
                    disabled={alternarAtivo.isPending}
                    onClick={() => {
                      const aviso = u.ativo
                        ? `Desativar ${u.nome}? A pessoa não vai mais conseguir entrar no sistema.${
                            clientes > 0
                              ? `\n\nEla ainda tem ${clientes} cliente(s). Lembre de transferir a carteira.`
                              : ''
                          }`
                        : `Reativar o acesso de ${u.nome}?`
                      if (!window.confirm(aviso)) return
                      void executar(
                        () => alternarAtivo.mutateAsync({ usuarioId: u.id, ativo: !u.ativo }),
                        u.ativo ? `${u.nome} foi desativado.` : `${u.nome} foi reativado.`,
                      )
                    }}
                  >
                    {u.ativo ? 'Desativar' : 'Reativar'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <Modal aberto={convidando} aoFechar={() => setConvidando(false)} titulo="Convidar usuário">
        <FormConvite
          aoTerminar={(nome, email) => {
            setConvidando(false)
            setSucesso(`Convite enviado para ${nome} (${email}).`)
          }}
        />
      </Modal>

      <Modal
        aberto={criandoOperador}
        aoFechar={() => setCriandoOperador(false)}
        titulo="Novo operador"
      >
        <FormOperador
          aoTerminar={(nome, login) => {
            setCriandoOperador(false)
            setSucesso(`${nome} já pode entrar com o login “${login}” e a senha que você definiu.`)
          }}
        />
      </Modal>

      <Modal
        aberto={!!transferindoDe}
        aoFechar={() => setTransferindoDe(null)}
        titulo="Transferir carteira de clientes"
      >
        {transferindoDe && (
          <FormTransferencia
            de={transferindoDe}
            usuarios={usuarios.data ?? []}
            aoTerminar={(total, para) => {
              setTransferindoDe(null)
              setSucesso(`${total} cliente(s) transferido(s) para ${para}.`)
            }}
          />
        )}
      </Modal>
    </>
  )
}

const esquemaConvite = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  email: z.email('Informe um e-mail válido.'),
  papel: z.enum(PAPEIS),
})
type DadosConvite = z.infer<typeof esquemaConvite>

function FormConvite({ aoTerminar }: { aoTerminar: (nome: string, email: string) => void }) {
  const convidar = useConvidarUsuario()
  const form = useForm<DadosConvite>({
    resolver: zodResolver(esquemaConvite),
    defaultValues: { nome: '', email: '', papel: 'vendedor' },
  })
  const { errors, isSubmitting } = form.formState
  const papel = useWatch({ control: form.control, name: 'papel' })

  async function enviar(dados: DadosConvite) {
    try {
      await convidar.mutateAsync(dados)
      aoTerminar(dados.nome, dados.email)
    } catch (e) {
      form.setError('root', { message: mensagemDeErro(e) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <Campo rotulo="Nome" htmlFor="convite-nome" obrigatorio erro={errors.nome?.message}>
        <Input id="convite-nome" aria-invalid={!!errors.nome} {...form.register('nome')} />
      </Campo>
      <Campo rotulo="E-mail" htmlFor="convite-email" obrigatorio erro={errors.email?.message}>
        <Input
          id="convite-email"
          type="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          {...form.register('email')}
        />
      </Campo>
      <Campo rotulo="Perfil de acesso" htmlFor="convite-papel" dica={DESCRICAO_PAPEL[papel]}>
        <Select id="convite-papel" {...form.register('papel')}>
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {NOME_DO_PAPEL[p]}
            </option>
          ))}
        </Select>
      </Campo>
      <p className="text-sm text-texto-suave">
        A pessoa recebe um e-mail com um link para criar a própria senha.
      </p>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enviando convite…' : 'Enviar convite'}
      </Button>
    </form>
  )
}

/** Sugestão de login a partir do nome: "João da Silva" → "joao.silva". */
function sugerirLogin(nome: string) {
  const partes = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((p) => p.length > 2)
  if (partes.length === 0) return ''
  return partes.length === 1 ? partes[0] : `${partes[0]}.${partes[partes.length - 1]}`
}

const esquemaOperador = z.object({
  nome: z.string().trim().min(2, 'Informe o nome completo.'),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9.]{1,30}$/, 'Use só letras minúsculas, números e ponto.'),
  senha: z.string().min(SENHA_MINIMA, `Mínimo de ${SENHA_MINIMA} caracteres.`),
})
type DadosOperador = z.infer<typeof esquemaOperador>

function FormOperador({ aoTerminar }: { aoTerminar: (nome: string, login: string) => void }) {
  const criar = useCriarOperador()
  const form = useForm<DadosOperador>({
    resolver: zodResolver(esquemaOperador),
    defaultValues: { nome: '', login: '', senha: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function enviar(dados: DadosOperador) {
    try {
      await criar.mutateAsync(dados)
      aoTerminar(dados.nome, dados.login)
    } catch (e) {
      form.setError('root', { message: mensagemDeErro(e) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <Campo rotulo="Nome completo" htmlFor="operador-nome" obrigatorio erro={errors.nome?.message}>
        <Input
          id="operador-nome"
          aria-invalid={!!errors.nome}
          {...form.register('nome', {
            onBlur: (e) => {
              if (!form.getValues('login')) form.setValue('login', sugerirLogin(e.target.value))
            },
          })}
        />
      </Campo>
      <Campo
        rotulo="Login"
        htmlFor="operador-login"
        obrigatorio
        erro={errors.login?.message}
        dica="É o que ele digita para entrar. Não precisa de e-mail."
      >
        <Input
          id="operador-login"
          autoCapitalize="none"
          aria-invalid={!!errors.login}
          {...form.register('login')}
        />
      </Campo>
      <Campo
        rotulo="Senha inicial"
        htmlFor="operador-senha"
        obrigatorio
        erro={errors.senha?.message}
      >
        <Input
          id="operador-senha"
          type="text"
          autoComplete="off"
          aria-invalid={!!errors.senha}
          {...form.register('senha')}
        />
      </Campo>
      <p className="text-sm text-texto-suave">
        Passe o login e a senha para o operador pessoalmente. A conta fica registrada como login@
        {DOMINIO_OPERADOR}, mas ele só precisa digitar o login.
      </p>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Criando…' : 'Criar operador'}
      </Button>
    </form>
  )
}

function FormTransferencia({
  de,
  usuarios,
  aoTerminar,
}: {
  de: Usuario
  usuarios: Usuario[]
  aoTerminar: (total: number, para: string) => void
}) {
  const transferir = useTransferirCarteira()
  const [para, setPara] = useState('')
  const [motivo, setMotivo] = useState('')
  const opcoes = usuarios.filter(
    (u) => u.id !== de.id && u.ativo && u.papel !== 'recepcao' && u.papel !== 'operador',
  )

  async function confirmar() {
    try {
      const total = await transferir.mutateAsync({ de: de.id, para, motivo })
      aoTerminar(total, opcoes.find((u) => u.id === para)?.nome ?? '')
    } catch {
      // Mostrado abaixo pelo estado da mutação.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        Todos os clientes de <strong>{de.nome}</strong> passam para o vendedor escolhido. A troca
        fica registrada no histórico de cada cliente.
      </p>
      {transferir.isError && <Aviso tipo="erro">{mensagemDeErro(transferir.error)}</Aviso>}
      <Campo rotulo="Novo vendedor responsável" htmlFor="carteira-para" obrigatorio>
        <Select id="carteira-para" value={para} onChange={(e) => setPara(e.target.value)}>
          <option value="">Escolha…</option>
          {opcoes.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Motivo" htmlFor="carteira-motivo" dica="Ex.: vendedor saiu da empresa">
        <Input id="carteira-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <Button disabled={!para || transferir.isPending} onClick={() => void confirmar()}>
        {transferir.isPending ? 'Transferindo…' : 'Transferir carteira'}
      </Button>
    </div>
  )
}
