# Configuração dos serviços externos

Passo a passo das contas e configurações que ficam **fora do código**. Elas são feitas uma vez só.
Os itens marcados com ✋ precisam ser feitos por você, porque envolvem login nas suas contas.

---

## 1. GitHub: repositório público ✋

1. Acesse <https://github.com/new>.
2. **Repository name:** `eco-gestao`.
3. **Public**. Não marque "Add a README", "Add .gitignore" nem "license", porque o projeto já tem esses arquivos.
4. Clique em **Create repository** e copie o endereço que aparece, no formato
   `https://github.com/SEU-USUARIO/eco-gestao.git`.
5. Me passe esse endereço. Eu ligo a pasta ao repositório e envio o código.

## 2. Supabase: dois projetos ✋

1. Crie a conta em <https://supabase.com>. Pode entrar com a conta do GitHub.
2. Crie a organização (plano **Free**).
3. Crie o projeto **`eco-gestao-dev`**:
   - **Region:** South America (São Paulo).
   - **Database Password:** gere uma senha forte e **guarde num gerenciador de senhas**. Não me mande
     essa senha pelo chat.
4. Repita para **`eco-gestao-prod`**.
5. Em cada projeto, vá em **Authentication → Sign In / Providers** e **desligue "Allow new users to sign up"**.
   Só o administrador convida pessoas.
6. No projeto `dev`, vá em **Project Settings → API** e copie a **Project URL** e, em **API Keys**, a **publishable key** (`sb_publishable_...`)
   para um arquivo `.env.local` na raiz do projeto, no formato do `.env.example`.
   A publishable key pode ser compartilhada. A **secret key** (`sb_secret_...`) é secreta e não deve ser copiada para lugar nenhum.

## 3. Netlify: publicar o sistema ✋

Faça depois do passo 1.

1. Na Netlify: **Add new project → Import an existing project → GitHub** e escolha `eco-gestao`.
2. As configurações de build já vêm do arquivo `netlify.toml`.
3. Em **Site configuration → Environment variables**, crie `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores do projeto **prod**.
4. Em **Domain management → Add a domain**, informe `sistema.ecoambientalsc.com.br`. A Netlify vai
   mostrar um endereço de destino parecido com `nome-do-site.netlify.app`.

## 4. DNS na KingHost: o subdomínio `sistema` ✋

Os servidores DNS do domínio são os da KingHost, então o registro é criado lá.

1. Painel da KingHost → domínio `ecoambientalsc.com.br` → **Zona DNS / Gerenciar DNS**.
2. Adicione um registro novo:
   - **Tipo:** `CNAME`
   - **Nome:** `sistema`
   - **Destino:** o endereço `nome-do-site.netlify.app` que a Netlify mostrou
3. **Não altere** os registros `MX`, nem os do `www` ou outros já existentes. Eles mantêm os e-mails e o site funcionando.
4. A propagação leva de minutos a algumas horas. Depois disso, a Netlify ativa o HTTPS sozinha.

## 5. E-mails do sistema pelo `adm@ecoambientalsc.com.br` ✋

O Supabase envia convites e "esqueci a senha". O envio padrão é limitado a pouquíssimos e-mails por
hora, por isso usamos a conta da KingHost.

1. No Supabase (projeto **prod**, e depois o **dev**): **Authentication → Emails → SMTP Settings →
   Enable custom SMTP**.
2. Preencha com os dados de SMTP que a KingHost informa para a conta `adm@`:
   - **Sender email:** `adm@ecoambientalsc.com.br`
   - **Sender name:** `Eco Ambiental SC`
   - **Host** e **Port:** os do painel da KingHost, normalmente `smtp.ecoambientalsc.com.br` na
     porta `587`. Confira no painel.
   - **Username:** `adm@ecoambientalsc.com.br`
   - **Password:** a senha da conta (digite você mesmo, direto no painel do Supabase).

> ⚠️ **Se a senha do `adm@` for trocada**, atualize também esse campo no Supabase. Senão os convites e
> a recuperação de senha param de chegar sem aviso.

## 6. Ferramentas no computador

- **Node.js 24 LTS:** já instalado.
- **VS Code:** ao abrir a pasta, aceite instalar as extensões recomendadas (Prettier, Oxc, Tailwind,
  Supabase).
