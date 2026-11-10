// Autoriza o sistema a gravar no Google Drive (Meu Drive) da conta Gmail da unidade.
// Roda uma vez, no computador, por quem tem a senha dessa conta:
//
//   node scripts/autorizar-drive.mjs drive-cliente.json
//
// drive-cliente.json = o "ID do cliente OAuth" (tipo App para computador) baixado do
// Google Cloud. Abre o navegador; a pessoa entra na conta e clica em Permitir. O script
// grava drive-conta.json (client_id, client_secret, refresh_token), que vira o segredo
// GOOGLE_DRIVE_CONTA da função "drive". Nenhum dos dois arquivos vai para o GitHub.
// Veja docs/CONFIGURACAO-DRIVE.md.

import { exec } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const arquivo = process.argv[2] ?? 'drive-cliente.json'
const lido = JSON.parse(readFileSync(arquivo, 'utf8'))
const cliente = lido.installed ?? lido.web ?? lido
if (!cliente.client_id || !cliente.client_secret) {
  console.error(`${arquivo} não parece o JSON de um cliente OAuth do Google.`)
  process.exit(1)
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const codigo = url.searchParams.get('code')
  const erro = url.searchParams.get('error')
  if (!codigo && !erro) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  if (erro) {
    res.end('<h2>Autorização cancelada.</h2>')
    console.error('Autorização cancelada:', erro)
    servidor.close()
    process.exitCode = 1
    return
  }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: codigo,
        client_id: cliente.client_id,
        client_secret: cliente.client_secret,
        redirect_uri: redirecionar,
      }),
    })
    const corpo = await r.json()
    if (!r.ok || !corpo.refresh_token) throw new Error(JSON.stringify(corpo))
    const quem = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
      { headers: { Authorization: `Bearer ${corpo.access_token}` } },
    ).then((x) => x.json())
    writeFileSync(
      'drive-conta.json',
      JSON.stringify({
        client_id: cliente.client_id,
        client_secret: cliente.client_secret,
        refresh_token: corpo.refresh_token,
      }),
    )
    res.end('<h2>Pronto! Pode fechar esta aba e voltar para o Claude.</h2>')
    console.log(`Autorizado: ${quem.user?.emailAddress}. Gravado drive-conta.json.`)
  } catch (e) {
    res.end('<h2>Não deu certo. Veja a mensagem no terminal.</h2>')
    console.error('Falhou:', e)
    process.exitCode = 1
  }
  servidor.close()
})

let redirecionar = ''
servidor.listen(0, '127.0.0.1', () => {
  redirecionar = `http://127.0.0.1:${servidor.address().port}`
  const link =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: cliente.client_id,
      redirect_uri: redirecionar,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive',
      access_type: 'offline',
      prompt: 'consent',
    })
  console.log('Abrindo o navegador. Se não abrir, copie este endereço:\n\n' + link + '\n')
  const abrir =
    process.platform === 'win32'
      ? `start "" "${link}"`
      : process.platform === 'darwin'
        ? `open "${link}"`
        : `xdg-open "${link}"`
  exec(abrir)
})
