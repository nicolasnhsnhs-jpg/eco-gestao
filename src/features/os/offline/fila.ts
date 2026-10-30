import { del, get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'

import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import { estaOnline } from '@/lib/offline'
import { supabase } from '@/lib/supabase'

import { enviarRascunhoGuardado } from '../operador/rascunho'

/*
 * Fila de envio do operador. Tudo o que ele faz na OS (anotar pontos, produtos,
 * insetos, fotos, assinaturas, iniciar e concluir) entra aqui primeiro, fica
 * guardado no celular (IndexedDB) e é enviado EM ORDEM quando houver sinal.
 *
 * - Erro de rede: a operação fica na fila e é tentada de novo depois.
 * - Recusa do banco (permissão, regra): a operação fica marcada "com problema" e
 *   as seguintes da mesma OS esperam, para nada ser concluído pela metade.
 * - Envio repetido (a resposta se perdeu no meio): é seguro, nada duplica.
 */

type CamposPonto = TablesUpdate<'os_pontos'>

export type Operacao =
  | { tipo: 'pontos'; osId: string; ids: string[]; campos: CamposPonto }
  | { tipo: 'produto+'; osId: string; linha: TablesInsert<'os_produtos'> & { id: string } }
  | { tipo: 'produto-'; osId: string; id: string }
  | { tipo: 'inseto+'; osId: string; linha: TablesInsert<'os_insetos'> & { id: string } }
  | { tipo: 'inseto-'; osId: string; id: string }
  | { tipo: 'iniciar'; osId: string }
  | { tipo: 'arquivo'; osId: string; registro: TablesInsert<'arquivos'> & { id: string } }
  | { tipo: 'concluir'; osId: string }

export type ItemFila = Operacao & { chave: string; criadoEm: string; erro?: string }

const CHAVE_FILA = 'eco-os-fila'
const chaveArquivo = (id: string) => `eco-os-arquivo-${id}`
const ESPERA_NOVA_TENTATIVA_MS = 30_000

let itens: ItemFila[] = []
let carregada = false
let enviando = false
let temporizador: ReturnType<typeof setTimeout> | undefined
const ouvintes = new Set<() => void>()

function avisar() {
  for (const ouvinte of ouvintes) ouvinte()
}

async function carregar() {
  if (carregada) return
  itens = (await get<ItemFila[]>(CHAVE_FILA)) ?? []
  carregada = true
  avisar()
}

async function salvar() {
  itens = [...itens]
  await set(CHAVE_FILA, itens)
  avisar()
}

/** Coloca uma operação na fila (e o arquivo da foto/assinatura, se houver). */
export async function enfileirar(operacao: Operacao, arquivo?: Blob) {
  await carregar()
  if (arquivo && operacao.tipo === 'arquivo') await set(chaveArquivo(operacao.registro.id), arquivo)
  itens.push({ ...operacao, chave: crypto.randomUUID(), criadoEm: new Date().toISOString() })
  await salvar()
  void processarFila()
}

/** Foto ou assinatura ainda no celular (para mostrar a miniatura sem internet). */
export const arquivoGuardado = (id: string) => get<Blob>(chaveArquivo(id))

export function ehErroDeRede(erro: unknown) {
  if (!estaOnline()) return true
  const texto = erro instanceof Error ? `${erro.name} ${erro.message}` : JSON.stringify(erro ?? '')
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout/i.test(
    texto,
  )
}

class RecusaDoBanco extends Error {}

async function executar(item: ItemFila) {
  const falhou = (erro: { message: string } | null) => {
    if (erro) throw ehErroDeRede(erro) ? erro : new RecusaDoBanco(erro.message)
  }

  switch (item.tipo) {
    case 'pontos': {
      const { data, error } = await supabase
        .from('os_pontos')
        .update(item.campos)
        .in('id', item.ids)
        .select('id')
      falhou(error)
      if (item.ids.length > 0 && (data ?? []).length === 0) {
        throw new RecusaDoBanco(
          'A OS não está mais aberta para você (o escritório pode ter mudado).',
        )
      }
      return
    }
    case 'produto+':
      return falhou(
        (await supabase.from('os_produtos').upsert(item.linha, { ignoreDuplicates: true })).error,
      )
    case 'produto-':
      return falhou((await supabase.from('os_produtos').delete().eq('id', item.id)).error)
    case 'inseto+':
      return falhou(
        (await supabase.from('os_insetos').upsert(item.linha, { ignoreDuplicates: true })).error,
      )
    case 'inseto-':
      return falhou((await supabase.from('os_insetos').delete().eq('id', item.id)).error)
    case 'iniciar':
      return falhou((await supabase.rpc('iniciar_os', { os: item.osId })).error)
    case 'arquivo': {
      const blob = await arquivoGuardado(item.registro.id)
      if (blob) {
        const envio = await supabase.storage
          .from('arquivos')
          .upload(item.registro.caminho_storage, blob, {
            contentType: item.registro.tipo_mime ?? undefined,
          })
        // Já enviado numa tentativa anterior: segue.
        if (envio.error && !/exist|duplicate/i.test(envio.error.message)) falhou(envio.error)
      }
      falhou(
        (await supabase.from('arquivos').upsert(item.registro, { ignoreDuplicates: true })).error,
      )
      await del(chaveArquivo(item.registro.id))
      return
    }
    case 'concluir': {
      // Antes de concluir, manda o que o operador digitou e ainda está só no celular.
      try {
        await enviarRascunhoGuardado(item.osId)
      } catch (erro) {
        if (ehErroDeRede(erro)) throw erro
        throw new RecusaDoBanco(
          (erro as { message?: string }).message ?? 'Erro ao enviar a execução.',
        )
      }
      return falhou((await supabase.rpc('concluir_os', { os: item.osId })).error)
    }
  }
}

/** Envia o que está na fila, em ordem. Seguro chamar várias vezes. */
export async function processarFila() {
  await carregar()
  if (enviando || !estaOnline()) return
  enviando = true
  avisar()
  clearTimeout(temporizador)
  try {
    const travadas = new Set(itens.filter((i) => i.erro).map((i) => i.osId))
    for (const item of [...itens]) {
      if (item.erro || travadas.has(item.osId)) continue
      try {
        await executar(item)
        itens = itens.filter((i) => i.chave !== item.chave)
        await salvar()
      } catch (erro) {
        if (erro instanceof RecusaDoBanco) {
          itens = itens.map((i) => (i.chave === item.chave ? { ...i, erro: erro.message } : i))
          travadas.add(item.osId)
          await salvar()
          continue
        }
        // Rede: para aqui e tenta de novo daqui a pouco, na mesma ordem.
        temporizador = setTimeout(() => void processarFila(), ESPERA_NOVA_TENTATIVA_MS)
        return
      }
    }
  } finally {
    enviando = false
    avisar()
  }
}

/** O operador decide tentar de novo um item com problema (ex.: depois de falar com o escritório). */
export async function tentarDeNovo(chave: string) {
  itens = itens.map((i) => (i.chave === chave ? { ...i, erro: undefined } : i))
  await salvar()
  void processarFila()
}

/** Remove da fila um item com problema (o operador desiste daquela alteração). */
export async function descartar(chave: string) {
  itens = itens.filter((i) => i.chave !== chave)
  await salvar()
}

// Envia sozinho: ao abrir o app, ao voltar o sinal e enquanto houver pendências.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void processarFila())
  void processarFila()
}

export type EstadoFila = { itens: ItemFila[]; enviando: boolean }
let instantaneo: EstadoFila = { itens, enviando }

function lerEstado(): EstadoFila {
  if (instantaneo.itens !== itens || instantaneo.enviando !== enviando) {
    instantaneo = { itens, enviando }
  }
  return instantaneo
}

export function useFila(): EstadoFila {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte)
      void carregar()
      return () => ouvintes.delete(ouvinte)
    },
    lerEstado,
    lerEstado,
  )
}

/** A OS tem algo esperando envio? (ex.: concluída no celular, aguardando sinal) */
export const pendenteDaOs = (estado: EstadoFila, osId: string) =>
  estado.itens.filter((i) => i.osId === osId)
