# Colocar o sistema no ar

Roteiro, na ordem, para publicar o Eco Gestão em `https://sistema.ecoambientalsc.com.br`.
Os passos marcados com ✋ são feitos por você, porque envolvem login nas suas contas ou senhas.
Os marcados com 🤖 são feitos pelo Claude, pelo terminal.

> **Senhas e chaves secretas nunca vão para o chat.** Você digita direto no painel de cada serviço.
> A única coisa que o Claude precisa receber é o **ID do projeto** (não é segredo).

---

## 1. Projeto `prod` no Supabase ✋

1. <https://supabase.com/dashboard> → **New project**.
2. **Name:** `eco-gestao-prod` · **Region:** **South America (São Paulo)** · plano **Free**.
3. **Database Password:** gere uma senha forte e guarde no gerenciador de senhas.
4. Quando terminar de criar, copie o **Project ID** (Project Settings → General, algo como
   `abcdefghijklmnopqrst`) e mande para o Claude.

## 2. Banco e função no `prod` 🤖

O Claude aplica todas as migrations (`npm run db:push` apontando para o prod), publica a função de
usuários e roda o verificador de segurança do Supabase.

## 3. Configurações de login do `prod` ✋

No painel do projeto **prod**:

1. **Authentication → Sign In / Providers:** desligue **Allow new users to sign up**.
2. **Authentication → URL Configuration:**
   - **Site URL:** `https://sistema.ecoambientalsc.com.br`
   - **Redirect URLs:** `https://sistema.ecoambientalsc.com.br/**`
3. **Authentication → Emails → SMTP Settings → Enable custom SMTP** (e-mails pelo `adm@`):
   - **Sender email:** `adm@ecoambientalsc.com.br` · **Sender name:** `Eco Ambiental SC`
   - **Host / Port:** os do painel da KingHost para envio (normalmente `smtp.ecoambientalsc.com.br`,
     porta `587`; confira no painel da KingHost, em E-mails → configurações do cliente de e-mail)
   - **Username:** `adm@ecoambientalsc.com.br` · **Password:** a senha da conta `adm@`
4. **Authentication → Emails → Templates** (opcional): traduzir os textos de “Invite user” e
   “Reset password” para português.

> ⚠️ Se a senha do `adm@` for trocada, atualize também o campo do passo 3. Senão os convites e o
> “esqueci a senha” param de chegar, sem aviso.

## 4. Netlify ✋

1. <https://app.netlify.com> → **Add new project → Import an existing project → GitHub** →
   repositório `eco-gestao`. As configurações de build já vêm do `netlify.toml`.
2. Antes de publicar (ou em **Site configuration → Environment variables**), crie:
   - `VITE_SUPABASE_URL` = `https://<ID do prod>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = a **publishable key** do prod
     (Supabase → Project Settings → API Keys; começa com `sb_publishable_`).
3. **Deploy**. Ao terminar, a Netlify mostra um endereço como `nome-qualquer.netlify.app`. Mande esse
   endereço para o Claude conferir.
4. **Domain management → Add a domain →** `sistema.ecoambientalsc.com.br`. A Netlify vai pedir um
   registro DNS (próximo passo).

## 5. DNS na KingHost ✋

1. Painel da KingHost → domínio `ecoambientalsc.com.br` → **Gerenciar DNS / Zona DNS**.
2. Adicione **um** registro novo:
   - **Tipo:** `CNAME` · **Nome:** `sistema` · **Destino:** `nome-qualquer.netlify.app`
3. **Não mexa** nos registros existentes (`MX` dos e-mails, `www` do site…).
4. Em alguns minutos (até algumas horas), a Netlify detecta o registro e ativa o HTTPS sozinha
   (Domain management → HTTPS → “Certificate active”).

## 6. Primeiro acesso (administrador) ✋

1. Supabase **prod** → **Authentication → Users → Add user → Create new user**: seu e-mail, uma
   senha forte, marque **Auto Confirm User**. O primeiro usuário vira administrador automaticamente.
2. Entre em `https://sistema.ecoambientalsc.com.br`.
3. **Financeiro → Cadastros:** cadastre as contas bancárias e o caixa com o saldo do dia, confira o
   dia útil das mensalidades e a comissão padrão, e cadastre os feriados de SC e de Palhoça.
4. **Usuários → Convidar:** a equipe recebe o convite pelo `adm@`. Faça um teste convidando um
   e-mail seu primeiro.

## 7. Backup (banco e arquivos) ✋

Siga [BACKUP.md](BACKUP.md): repositório privado, dois arquivos copiados e quatro segredos.

## 8. Conferência final 🤖

O Claude abre o site publicado e confere: login, HTTPS, cabeçalhos de segurança, que o sistema não
aparece no Google (`noindex`) e que a primeira execução do backup terminou com ✔ verde.

---

## Ferramentas no computador

- **Node.js 24 LTS** e **Supabase CLI** (já instalados; `npx supabase login` feito).
- **VS Code:** aceite as extensões recomendadas ao abrir a pasta (Prettier, Oxc, Tailwind, Supabase).
