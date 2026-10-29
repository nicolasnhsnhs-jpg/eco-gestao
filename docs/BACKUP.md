# Backup

O plano gratuito do Supabase **não tem backup que possamos baixar**. Por isso o próprio projeto faz o
backup, pelo GitHub Actions:

- **Banco de dados:** todo dia às 3h.
- **Arquivos** (propostas, certificados, relatórios, fotos): todo domingo às 4h.

Os dois são **criptografados** e guardados por 90 dias.

O backup roda num **repositório privado separado**, porque este repositório é público. Mesmo
criptografado, um backup com dados de clientes nunca deve ficar acessível a qualquer pessoa.

## Configuração (uma vez) ✋

1. **Crie um repositório privado** no GitHub: <https://github.com/new>, nome `eco-gestao-backup`,
   **Private**, marcando _Add a README file_.
2. **Copie dois arquivos** para esse repositório (pelo site: _Add file → Create new file_, digite o
   caminho e cole o conteúdo):
   - [`docs/backup/backup-diario.yml`](backup/backup-diario.yml) → caminho
     `.github/workflows/backup-diario.yml`
   - [`docs/backup/backup-arquivos.mjs`](backup/backup-arquivos.mjs) → caminho `backup-arquivos.mjs`
3. **Endereço de conexão do banco** (Supabase, projeto **prod**):
   - Clique em **Connect** (o ícone de tomada ao lado do nome do projeto) e use o endereço do
     **Shared pooler / Session pooler** (porta `5432`). O GitHub precisa desse tipo de conexão.
   - Copie o endereço, no formato
     `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`,
     e troque `[YOUR-PASSWORD]` **inteiro, com os colchetes**, pela senha do banco.
   - A senha do banco **não é** a senha de entrar no Supabase: é a criada junto com o projeto. Se não
     tiver certeza dela, use **Reset database password** (na mesma janela do Connect) e crie uma só
     com letras e números. O sistema no ar não usa essa senha, então trocá-la não afeta nada.
   - Erro `password authentication failed` no backup = senha errada (ou colchetes sobrando).
4. **Chave secreta** (Supabase, projeto **prod** → Project Settings → API Keys → _Secret keys_ →
   crie uma chamada `backup`). Ela começa com `sb_secret_`.
5. No repositório **privado**: **Settings → Secrets and variables → Actions → New repository secret**.
   Crie quatro segredos:

   | Nome                  | Valor                                                                                                           |
   | --------------------- | --------------------------------------------------------------------------------------------------------------- |
   | `SUPABASE_DB_URL`     | o endereço do passo 3                                                                                           |
   | `SUPABASE_URL`        | `https://<ID do prod>.supabase.co`                                                                              |
   | `SUPABASE_SECRET_KEY` | a chave do passo 4                                                                                              |
   | `BACKUP_SENHA`        | uma senha longa, só para os backups. **Guarde no gerenciador de senhas**: sem ela não dá para abrir os backups. |

6. **Actions → Backup → Run workflow** para testar. Em poucos minutos devem aparecer dois ✔ verdes
   (`banco` e `arquivos`) e os arquivos `.gpg` em **Artifacts**.

> Os segredos ficam guardados criptografados no GitHub e não aparecem nos registros da execução.
> A chave secreta e a senha do banco **nunca** vão para o repositório público nem para o chat.

## Rotina

| Quando                 | O quê                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Todo dia (sozinho)     | Backup do banco, guardado por 90 dias                                              |
| Todo domingo (sozinho) | Backup dos arquivos, guardado por 90 dias                                          |
| Todo mês               | Baixe os backups mais recentes e guarde fora da nuvem (HD externo ou Google Drive) |
| A cada 3 meses         | Teste de restauração no projeto **dev**                                            |

Se uma execução falhar, o GitHub manda um e-mail para você e aparece um ✗ vermelho em **Actions**.

## Como abrir e restaurar um backup

```bash
# Banco: descriptografar (pede a BACKUP_SENHA) e restaurar (de preferência no dev, para conferir antes)
gpg --output eco-gestao.dump --decrypt eco-gestao-banco-AAAA-MM-DD.dump.gpg
pg_restore --dbname "ENDEREÇO_DO_BANCO" --no-owner --clean --if-exists eco-gestao.dump

# Arquivos: descriptografar e descompactar (a pasta "arquivos" tem a mesma estrutura do Storage)
gpg --output arquivos.tar.gz --decrypt eco-gestao-arquivos-AAAA-MM-DD.tar.gz.gpg
tar -xzf arquivos.tar.gz
```
