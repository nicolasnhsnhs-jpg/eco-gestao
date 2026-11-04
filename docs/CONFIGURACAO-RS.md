# Colocar a unidade RS no ar

Roteiro para publicar o Eco Gestão da unidade **Eco Ambiental RS** (sede em Esteio) em
`https://sistema.ecoambientalrs.com.br`.

O **código é o mesmo** de SC: toda melhoria chega às duas unidades. O que separa as duas é:

- um **projeto próprio no Supabase** (banco, logins e arquivos só do RS, começando vazio);
- um **site próprio na Netlify**, com `VITE_UNIDADE=rs`, que troca o rodapé do PDF, o login dos
  operadores (`joao@op.ecoambientalrs.com.br`), a cidade padrão e os feriados
  (veja [src/lib/unidade.ts](../src/lib/unidade.ts)). O logo é o mesmo.

Contas usadas: as mesmas de SC (Supabase, Netlify, Resend, GitHub e KingHost).
Os passos marcados com ✋ são feitos por você; os com 🤖, pelo Claude.

> **Senhas e chaves secretas nunca vão para o chat.** O Claude só precisa do **ID do projeto**.

---

## 1. Projeto `rs` no Supabase ✋ ✅ feito em 04/11/2026

O Pro foi assinado na organização **Eco Ambiental SC** (prod de SC + rs). O `eco-gestao-dev` foi
para a organização grátis **Eco Testes**, para não ser cobrado.

> ⚠️ O plano **Free** do Supabase permite **2 projetos ativos**, e eles já estão em uso
> (`eco-gestao-dev` e `eco-gestao-prod`). Para criar o do RS, escolha uma opção:
>
> - **Assinar o plano Pro** na organização (recomendado: também traz backup diário pelo próprio
>   Supabase); ou
> - **Pausar o `eco-gestao-dev`** (Project Settings → General → Pause project). O dev só é usado
>   para testar mudanças antes de publicar, então pausado ele não atrapalha o dia a dia, mas
>   precisa ser reativado sempre que for testar algo novo.

1. <https://supabase.com/dashboard> → **New project**, na mesma organização.
2. **Name:** `eco-gestao-rs` · **Region:** **South America (São Paulo)**.
3. **Database Password:** gere uma senha forte e guarde no gerenciador de senhas.
4. Copie o **Project ID** (Project Settings → General) e mande para o Claude.

## 2. Banco e função no `rs` 🤖 ✅ feito em 04/11/2026

Projeto `pauwepzrvlpdhjqeafkr` (São Paulo, organização Pro). As 32 migrations foram aplicadas, a
função `usuarios` foi publicada com o segredo `DOMINIO_OPERADOR=op.ecoambientalrs.com.br` e os 11
conjuntos de testes de permissão passaram (eles desfazem tudo no final; o banco continuou vazio).

Daqui para frente, toda mudança no banco vai para os dois: `npm run db:push:prod` e
`npm run db:push:rs` (e o mesmo para `funcoes:prod` / `funcoes:rs`).

## 3. Domínio na KingHost e e-mails pelo Resend ✋ ✅ feito em 04/11/2026 (domínio verificado)

Feito: domínio no Resend (São Paulo) e, na KingHost, `TXT resend._domainkey`, `CNAME rsend`,
`CNAME send` e `TXT _dmarc`. O `MX` de recebimento do Resend **não** foi adicionado (os e-mails
continuam chegando na KingHost). A chave `supabase-rs` foi criada e está no SMTP do Supabase do RS.

> ⚠️ O plano gratuito do Resend aceita **um domínio só**, e o `ecoambientalsc.com.br` já está
> nele. Para enviar como `@ecoambientalrs.com.br`, é preciso um plano pago do Resend (ou uma conta
> grátis separada, só para o RS). Confira o limite atual na página de preços do Resend.

1. **Resend → Domains → Add domain:** `ecoambientalrs.com.br`, região São Paulo. O Resend mostra
   4 registros DNS (`TXT resend._domainkey`, `CNAME` ou `MX` de `send`, e o `TXT _dmarc`
   `v=DMARC1; p=none;`).
2. **KingHost → domínio `ecoambientalrs.com.br` → Zona DNS:** adicione esses 4 registros. Não mexa
   no `MX` dos e-mails.
3. Volte no Resend e clique em **Verify**. Pode levar de minutos a algumas horas.
4. **Resend → API Keys:** crie a chave `supabase-rs`, permissão _Sending access_, domínio
   `ecoambientalrs.com.br`.

## 4. Configurações de login do `rs` ✋ ✅ feito em 04/11/2026 (convite de teste recebido)

No painel do projeto **eco-gestao-rs**:

1. **Authentication → Sign In / Providers:** desligue **Allow new users to sign up**.
2. **Authentication → URL Configuration:**
   - **Site URL:** `https://sistema.ecoambientalrs.com.br`
   - **Redirect URLs:** `https://sistema.ecoambientalrs.com.br/**`
3. **Authentication → Emails → SMTP Settings:**
   - **Sender email:** `nicolas.hernandes@ecoambientalrs.com.br` · **Sender name:** `Eco Ambiental RS`
   - **Host:** `smtp.resend.com` · **Port:** `587` ⚠️ (com outra porta, como `465` ou um erro de digitação, o convite dá “Gateway Timeout”)
   - **Username:** `resend` · **Password:** a chave `re_...` do passo 3.4
4. **Authentication → Emails → Templates:** _Invite user_ e _Reset password_ com os modelos de
   [`supabase/templates`](../supabase/templates) (os mesmos de SC). ✅ colados em 04/11/2026.

## 5. Netlify ✋ ✅ feito em 04/11/2026 (HTTPS ativo, Let's Encrypt)

Site `eco-gestao-rs`, **público** (a Netlify cria projetos novos como _Private_; foi preciso clicar
em **Make public**). Além do `CNAME sistema`, a Netlify pediu o `TXT subdomain-owner-verification`
na KingHost para confirmar o domínio.

1. <https://app.netlify.com> → **Add new project → Import an existing project → GitHub** →
   o **mesmo** repositório `eco-gestao`. As configurações de build já vêm do `netlify.toml`.
2. **Project name:** `eco-gestao-rs`.
3. **Environment variables** (antes do primeiro deploy):
   - `VITE_UNIDADE` = `rs`
   - `VITE_SUPABASE_URL` = `https://<ID do rs>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = a **publishable key** do rs (`sb_publishable_...`)
4. **Deploy** e mande o endereço `eco-gestao-rs.netlify.app` para o Claude conferir.
5. **Domain management → Add a domain →** `sistema.ecoambientalrs.com.br`.
6. **KingHost → Zona DNS de `ecoambientalrs.com.br`:** registro `CNAME` · nome `sistema` · destino
   `eco-gestao-rs.netlify.app`. Em alguns minutos a Netlify ativa o HTTPS sozinha.

> ⚠️ Confira que o site de **SC** continua sem `VITE_UNIDADE` (ou com `sc`). Os dois sites
> publicam juntos a cada mudança no código.

## 6. Primeiro acesso (administrador) ✋ 🟡 administrador criado em 04/11/2026; falta o item 3

1. Supabase **rs** → **Authentication → Users → Add user → Create new user**: seu e-mail, senha
   forte, **Auto Confirm User**. O primeiro usuário vira administrador.
2. Entre em `https://sistema.ecoambientalrs.com.br`.
3. **Financeiro → Cadastros:** contas bancárias e caixa do RS, dia útil das mensalidades, comissão
   padrão e os feriados do RS e de Esteio.
4. **Usuários → Convidar** a equipe do RS. Os logins de SC **não** funcionam no RS (e vice-versa).

## 7. Backup ✋ ✅ feito em 04/11/2026 (execução #12: os 4 jobs verdes)

No mesmo repositório privado `eco-gestao-backup`:

1. Substitua `.github/workflows/backup-diario.yml` pela versão nova de
   [`docs/backup/backup-diario.yml`](backup/backup-diario.yml), que faz o backup das duas unidades.
2. Crie mais três segredos, do projeto **rs**, do mesmo jeito que os de SC
   (veja [BACKUP.md](BACKUP.md), passos 3 e 4):
   `SUPABASE_DB_URL_RS`, `SUPABASE_URL_RS` e `SUPABASE_SECRET_KEY_RS`.
3. **Actions → Backup → Run workflow**: devem aparecer quatro ✔ verdes (banco e arquivos de cada
   unidade).

## 8. Conferência final 🤖

O Claude confere login, HTTPS, cabeçalhos de segurança, `noindex`, o rodapé do PDF de uma OS de
teste e a primeira execução do backup do RS.
