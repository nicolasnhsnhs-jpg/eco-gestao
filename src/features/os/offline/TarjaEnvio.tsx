import { useQueryClient } from '@tanstack/react-query'
import { CloudOff, LogIn, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { estaOnline } from '@/lib/offline'

import { useAuth } from '../../auth/useAuth'

import { descartar, tentarDeNovo, useFila, type ItemFila } from './fila'

const DESCRICAO: Record<ItemFila['tipo'], string> = {
  pontos: 'Anotação de pontos',
  'produto+': 'Produto adicionado',
  'produto-': 'Produto removido',
  'inseto+': 'Aplicação de inseticida',
  'inseto-': 'Aplicação removida',
  iniciar: 'Início da OS',
  arquivo: 'Foto ou assinatura',
  concluir: 'Conclusão da OS',
}

/**
 * Tarja do operador: mostra se está sem internet, quanto falta enviar e se algo
 * foi recusado pelo banco (com opção de tentar de novo ou descartar).
 */
export function TarjaEnvio() {
  const fila = useFila()
  const [online, setOnline] = useState(estaOnline)
  const [abrirProblemas, setAbrirProblemas] = useState(false)

  useEffect(() => {
    const mudou = () => setOnline(estaOnline())
    window.addEventListener('online', mudou)
    window.addEventListener('offline', mudou)
    return () => {
      window.removeEventListener('online', mudou)
      window.removeEventListener('offline', mudou)
    }
  }, [])

  const problemas = fila.itens.filter((i) => i.erro)
  const esperando = fila.itens.length - problemas.length
  const queryClient = useQueryClient()
  const { sair } = useAuth()

  // Conclusão recusada: a OS ficou "concluída" só no celular. Busca de novo o
  // status no banco para a tela reabrir e o operador corrigir o que falta.
  const conclusoesRecusadas = problemas
    .filter((i) => i.tipo === 'concluir')
    .map((i) => i.chave)
    .join()
  useEffect(() => {
    if (conclusoesRecusadas) void queryClient.invalidateQueries({ queryKey: ['os'] })
  }, [conclusoesRecusadas, queryClient])

  if (online && fila.itens.length === 0) return null

  return (
    <div className="mb-4 flex flex-col gap-2" role="status">
      {!online && (
        <p className="flex items-center gap-2 rounded-xl bg-alerta/15 px-3 py-2 text-sm font-semibold">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          Sem internet
          {esperando > 0 &&
            ` · ${esperando} ${esperando === 1 ? 'item esperando' : 'itens esperando'} envio`}
          . Pode continuar trabalhando.
        </p>
      )}
      {online && fila.semLogin && fila.itens.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-alerta/40 bg-alerta/15 px-3 py-3 text-sm">
          <p className="font-semibold">
            Seu login no app venceu. O que você anotou está guardado no celular e vai assim que você
            entrar de novo.
          </p>
          <Button onClick={() => void sair()}>
            <LogIn className="size-5" aria-hidden /> Entrar de novo
          </Button>
        </div>
      )}
      {online && !fila.semLogin && esperando > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-lima-claro px-3 py-2 text-sm text-verde-escuro">
          <RefreshCw className={fila.enviando ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
          Enviando {esperando} {esperando === 1 ? 'item' : 'itens'} guardado(s) no celular…
        </p>
      )}
      {problemas.length > 0 && (
        <div className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm">
          <button
            type="button"
            className="flex w-full items-center gap-2 font-semibold text-perigo"
            onClick={() => setAbrirProblemas((v) => !v)}
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {problemas.length} {problemas.length === 1 ? 'item recusado' : 'itens recusados'} pelo
            sistema (ver)
          </button>
          {abrirProblemas && (
            <ul className="mt-2 flex flex-col gap-2">
              {problemas.map((i) => (
                <li key={i.chave} className="flex flex-col gap-1">
                  <span>
                    <strong>{DESCRICAO[i.tipo]}:</strong> {i.erro}
                  </span>
                  <div className="flex gap-2">
                    <Button variante="secundario" onClick={() => void tentarDeNovo(i.chave)}>
                      Tentar de novo
                    </Button>
                    <Button
                      variante="fantasma"
                      onClick={() => {
                        const aviso =
                          i.tipo === 'arquivo' && i.registro.categoria === 'assinatura'
                            ? 'Descartar esta assinatura? Depois abra a OS e assine de novo.'
                            : 'Descartar esta alteração? Ela não será enviada.'
                        if (window.confirm(aviso)) {
                          void descartar(i.chave).then(() =>
                            queryClient.invalidateQueries({ queryKey: ['os'] }),
                          )
                        }
                      }}
                    >
                      Descartar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-texto-suave">Se não resolver, avise o escritório.</p>
        </div>
      )}
    </div>
  )
}
