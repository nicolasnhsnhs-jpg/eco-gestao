// Backup dos arquivos do sistema (propostas, certificados, fotos…) guardados no Supabase Storage.
//
// ATENÇÃO: este script NÃO roda neste repositório (que é público). Ele é copiado para o
// repositório PRIVADO de backup e executado pelo GitHub Actions. Veja docs/BACKUP.md.
//
// Como funciona: a tabela "arquivos" tem o caminho de cada arquivo no Storage. O script lê
// essa lista e baixa cada arquivo para a pasta ./arquivos, mantendo as mesmas pastas.
//
// Variáveis de ambiente (segredos do GitHub):
//   SUPABASE_URL          https://xxxx.supabase.co
//   SUPABASE_SECRET_KEY   chave secreta (sb_secret_...) do projeto prod

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const chave = process.env.SUPABASE_SECRET_KEY
if (!url || !chave) {
  console.error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY.')
  process.exit(1)
}

const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` }
const POR_PAGINA = 1000

async function listarCaminhos() {
  const caminhos = []
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const resposta = await fetch(
      `${url}/rest/v1/arquivos?select=caminho_storage&order=criado_em&offset=${inicio}&limit=${POR_PAGINA}`,
      { headers: cabecalhos },
    )
    if (!resposta.ok)
      throw new Error(`Erro ao listar arquivos: ${resposta.status} ${await resposta.text()}`)
    const pagina = await resposta.json()
    caminhos.push(...pagina.map((linha) => linha.caminho_storage))
    if (pagina.length < POR_PAGINA) return caminhos
  }
}

const caminhos = await listarCaminhos()
console.log(`${caminhos.length} arquivo(s) para copiar.`)

let falhas = 0
for (const caminho of caminhos) {
  const endereco = `${url}/storage/v1/object/arquivos/${caminho.split('/').map(encodeURIComponent).join('/')}`
  const resposta = await fetch(endereco, { headers: cabecalhos })
  if (!resposta.ok) {
    falhas++
    console.error(`Falhou: ${caminho} (${resposta.status})`)
    continue
  }
  const destino = join('arquivos', caminho)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, Buffer.from(await resposta.arrayBuffer()))
}

console.log(`Copiados: ${caminhos.length - falhas}. Falhas: ${falhas}.`)
// Falha em algum arquivo deixa a execução vermelha no GitHub, para chamar atenção.
if (falhas > 0) process.exit(1)
