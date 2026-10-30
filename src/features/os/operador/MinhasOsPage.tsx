import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Carregando } from '@/components/ui/Carregando'
import { hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { usePerfil } from '../../auth/useAuth'
import { osAberta, useOrdensServico } from '../api'
import { CartaoOs } from '../OsListaPage'

/**
 * Início do operador: as OS dele, da semana passada (para terminar o que ficou
 * aberto) até os próximos 7 dias. O banco só devolve as OS atribuídas a ele.
 */
export function MinhasOsPage() {
  const perfil = usePerfil()
  const hoje = hojeISO()
  const lista = useOrdensServico({ de: somarDias(hoje, -7), ate: somarDias(hoje, 7) })
  const abertas = lista.data?.filter((os) => osAberta(os.status)) ?? []
  const concluidas = lista.data?.filter((os) => !osAberta(os.status)) ?? []

  return (
    <>
      <PageHeader
        titulo={`Olá, ${perfil.nome.split(' ')[0]}!`}
        descricao="Suas ordens de serviço."
      />
      {lista.isPending && <Carregando />}
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
