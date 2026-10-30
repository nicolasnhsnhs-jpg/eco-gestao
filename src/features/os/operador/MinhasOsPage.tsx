import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Carregando } from '@/components/ui/Carregando'
import { hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { usePerfil } from '../../auth/useAuth'
import { osAberta, useOrdensServico } from '../api'
import { useBaixarOsDoDia } from '../offline/baixar'
import { CartaoOs } from '../OsListaPage'

/**
 * Início do operador: as OS dele, da semana passada (para terminar o que ficou
 * aberto) até os próximos 7 dias. O banco só devolve as OS atribuídas a ele.
 * As do dia ficam guardadas no celular para trabalhar sem internet.
 */
export function MinhasOsPage() {
  const perfil = usePerfil()
  const hoje = hojeISO()
  const lista = useOrdensServico({ de: somarDias(hoje, -7), ate: somarDias(hoje, 7) })
  const abertas = lista.data?.filter((os) => osAberta(os.status)) ?? []
  const concluidas = lista.data?.filter((os) => !osAberta(os.status)) ?? []
  const { baixadoEm, baixadoHoje, online } = useBaixarOsDoDia(lista.data)
  const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <PageHeader
        titulo={`Olá, ${perfil.nome.split(' ')[0]}!`}
        descricao="Suas ordens de serviço."
      />
      {baixadoEm && baixadoHoje ? (
        <p className="mb-3 rounded-xl bg-lima-claro px-3 py-2 text-sm text-verde-escuro">
          OS do dia guardadas no celular · atualizado às {hora(baixadoEm)}
          {!online && ' · sem internet agora'}
        </p>
      ) : (
        !online && (
          <div className="mb-3">
            <Aviso tipo="erro">
              Sem internet e as OS de hoje ainda não foram baixadas. Abra o app com internet (o
              Wi-Fi de casa serve) antes de sair para o serviço.
            </Aviso>
          </div>
        )
      )}
      {lista.isPending && online && <Carregando />}
      {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}

      <h2 className="mb-2 font-titulo text-lg font-bold text-verde-escuro">A fazer</h2>
      {lista.isSuccess && abertas.length === 0 && (
        <p className="mb-4 rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          Nenhuma OS para fazer agora.
        </p>
      )}
      <ul className="mb-6 flex flex-col gap-2">
        {abertas.map((os) => (
          <li key={os.id}>
            <CartaoOs os={os} para={`/os/${os.id}/executar`} />
          </li>
        ))}
      </ul>

      {concluidas.length > 0 && (
        <>
          <h2 className="mb-2 font-titulo text-lg font-bold text-verde-escuro">Concluídas</h2>
          <ul className="flex flex-col gap-2">
            {concluidas.map((os) => (
              <li key={os.id}>
                <CartaoOs os={os} para={`/os/${os.id}/executar`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
