# Cópia automática dos PDFs no Google Drive (SC)

Todo PDF que o sistema gera vai sozinho para o "Meu Drive" da conta Gmail do SC, na pasta do cliente:

| PDF                  | Pasta                                   |
| -------------------- | --------------------------------------- |
| Nota fiscal (DANFSe) | `FINANCEIRO / 2026 / Cliente - CNPJ /`  |
| Boleto               | `FINANCEIRO / 2026 / Cliente - CNPJ /`  |
| Ordem de serviço     | `GERAL / 2026 / Cliente - CNPJ /`       |
| Certificado          | `ADM / 2026 / Cliente - CNPJ /`         |
| Agenda do dia        | `ADM / AGENDA / 2026 / 11 - Novembro /` |

- Nome dos arquivos: tipo, número e a data do próprio documento (não a de quando o PDF foi gerado,
  para que gerar de novo troque o arquivo em vez de duplicar):
  `Nota Fiscal 123 - 10-11-2026.pdf` (emissão), `Boleto NF 123 - venc 10-12-2026.pdf` (vencimento),
  `Ordem de Serviço OS-2026-0003 - 10-11-2026.pdf` (dia agendado),
  `Certificado CERT-2026-0001 - 10-11-2026.pdf` (dia do serviço).
- O ano da pasta é o dessa mesma data. As pastas do ano e do cliente são criadas pelo sistema na primeira vez.
- O nome da pasta do cliente é `Razão social - 12.345.678-0001-90`. A barra do CNPJ vira hífen,
  porque o Drive para computador (Windows) não aceita `/` em nome de pasta.
- A pasta do cliente fica "marcada" com o cliente: se alguém renomear a pasta no Drive, o sistema
  continua usando a mesma.
- PDF gerado de novo (ex.: OS refeita, certificado alterado) substitui o anterior com o mesmo nome;
  o Drive guarda a versão antiga em "Gerenciar versões".
- Nota, boleto e OS vão por uma fila: chegam ao Drive em até 1 ou 2 minutos. Se o Google falhar,
  o sistema tenta de novo sozinho (até 10 vezes, com intervalos cada vez maiores).
- O certificado vai na hora em que é salvo ou aberto.
- A agenda vai quando alguém gera a imagem do dia (Gerar, Copiar ou Baixar), com o nome do dia:
  `10-11-2026.png`. Gerar de novo no mesmo dia troca a cópia.
- Vale para as duas unidades, com a mesma conta Google: o SC grava na pasta SC e o RS na pasta RS
  (o segredo `GOOGLE_DRIVE_RAIZ` de cada projeto). No RS fica junto com o servidor próprio.

## 1. No Google (feito uma vez, com a conta Gmail do SC)

O sistema entra no Drive com a própria conta do SC. Para isso o Google pede um "app" cadastrado
no Google Cloud (é de graça) e que a dona da conta autorize uma vez.

1. Entre em https://console.cloud.google.com **com a conta Gmail do SC** e crie um projeto
   (ex.: "Eco Sistema").
2. Menu **APIs e serviços → Biblioteca** → procure **Google Drive API** → **Ativar**.
3. Menu **APIs e serviços → Tela de permissão OAuth** (ou "Google Auth Platform"):
   - Tipo de usuário: **Externo**. Nome do app: `Eco Sistema`. E-mails: o do SC.
   - Em **Público-alvo**, clique em **Publicar app** (fica "Em produção"). Isso é importante:
     se ficar "Em teste", o Google corta a autorização a cada 7 dias.
   - Não precisa pedir verificação ao Google (é só para uso próprio).
4. Menu **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
   Tipo: **App para computador**. Nome: `Sistema`. **Criar** → **Baixar JSON**.
   Salve na pasta do projeto como `drive-cliente.json` (ele não vai para o GitHub).
5. No terminal, na pasta do projeto:

   ```bash
   node scripts/autorizar-drive.mjs drive-cliente.json
   ```

   Abre o navegador: entre na conta do SC. O Google avisa que o app "não foi verificado" →
   **Avançado → Acessar Eco Sistema (não seguro)** (o app é o nosso) → marque o acesso ao Drive →
   **Continuar**. O script grava `drive-conta.json`.

As pastas `ADM`, `GERAL`, `FINANCEIRO` e `VENDAS` precisam estar direto no "Meu Drive". Se
estiverem dentro de outra pasta, abra essa pasta e copie o código do fim do endereço
(`https://drive.google.com/drive/folders/`**`1AbC...`**): vai no segredo `GOOGLE_DRIVE_RAIZ`.

Espaço: o Gmail gratuito tem 15 GB (somados com o e-mail). Cada PDF tem uns 200 KB, então cabem
dezenas de milhares; se encher, o Google One aumenta.

## 2. No servidor (Supabase de produção do SC)

```bash
npm run db:push:prod
npx supabase functions deploy drive --use-api --project-ref qteahjezxiregnaomoqz
```

Segredos da função (o `DRIVE_SEGREDO` é uma senha qualquer, longa, gerada na hora;
`GOOGLE_DRIVE_RAIZ` só se as pastas não estiverem direto no Meu Drive):

```bash
npx supabase secrets set --project-ref qteahjezxiregnaomoqz DRIVE_SEGREDO=<senha> "GOOGLE_DRIVE_CONTA=$(cat drive-conta.json)"
```

Ligar a fila (SQL Editor do projeto de produção do SC), com a mesma senha:

```sql
select vault.create_secret('https://qteahjezxiregnaomoqz.supabase.co/functions/v1/drive', 'drive_funcao_url');
select vault.create_secret('<senha>', 'drive_segredo');
```

Conferir: a função `drive` com `{"acao":"situacao"}` (logado como Administrador) diz qual conta
Google está conectada e se achou as quatro pastas.

PDFs que já existiam antes de ligar (uma vez só, opcional):

```sql
select public.drive_enviar_antigos();
```

## Problemas

- **O que não foi**: `select * from drive_fila where enviado_em is null;` — a coluna `ultimo_erro`
  diz o motivo.
- **"A pasta GERAL não foi encontrada"**: a pasta não está direto no Meu Drive (ou tem outro
  nome), ou o `GOOGLE_DRIVE_RAIZ` está errado.
- **"O Google recusou a autorização"**: a senha da conta mudou, o acesso foi removido em
  myaccount.google.com → Segurança, ou o app ficou "Em teste". Rode o passo 5 de novo e
  atualize o segredo `GOOGLE_DRIVE_CONTA`.
- **Desligar**: apague os dois segredos do Vault (`drive_funcao_url`, `drive_segredo`). Nada novo
  entra na fila; o certificado para de ir quando `drive` virar `false` em `src/lib/unidade.ts`.
