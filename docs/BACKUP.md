# Backup

O plano gratuito do Supabase **não tem backup que possamos baixar**. Por isso, o próprio projeto
faz o backup: todo dia, às 3h, o GitHub Actions exporta o banco, **criptografa** e guarda o arquivo por
90 dias.

O backup roda num **repositório privado separado**, porque este repositório é público. Mesmo
criptografado, um backup com dados de clientes nunca deve ficar acessível a qualquer pessoa.

## Configuração (uma vez) ✋

1. **Crie um repositório privado** no GitHub: <https://github.com/new>, nome `eco-gestao-backup`,
   **Private**.
2. **Copie o arquivo** [`docs/backup/backup-diario.yml`](backup/backup-diario.yml) para esse
   repositório, no caminho `.github/workflows/backup-diario.yml`. Pelo site do GitHub: _Add file →
   Create new file_, digite o caminho e cole o conteúdo.
3. **Pegue o endereço de conexão do banco** no Supabase, no projeto **prod** (por enquanto pode ser o
   **dev**):
   - Clique em **Connect** (no topo do painel) e escolha **Session pooler**. O GitHub precisa desse
     tipo de conexão.
   - Copie o endereço, que tem o formato
     `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`.
   - Troque `[YOUR-PASSWORD]` pela senha do banco.
4. No repositório **privado**, vá em **Settings → Secrets and variables → Actions → New repository
   secret** e crie dois segredos:
   - `SUPABASE_DB_URL`: o endereço do passo 3.
   - `BACKUP_SENHA`: uma senha longa, só para os backups. **Guarde no gerenciador de senhas.** Sem
     ela não é possível abrir os backups.
5. Vá em **Actions → Backup diário → Run workflow** para testar. Em 1 ou 2 minutos deve aparecer um
   ✔ verde e o arquivo `.dump.gpg` em **Artifacts**.

> Os segredos ficam guardados criptografados no GitHub e não aparecem nos registros da execução.

## Rotina

| Quando             | O quê                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| Todo dia (sozinho) | Backup do banco, guardado por 90 dias                                           |
| Todo mês           | Baixe o backup mais recente e guarde fora da nuvem (HD externo ou Google Drive) |
| A cada 3 meses     | Teste de restauração no projeto **dev**                                         |

> ⚠️ **Pendente:** desde a Fase 3 o sistema guarda arquivos (propostas, documentos) no Storage. Este
> backup ainda copia só o banco; a cópia dos arquivos será acrescentada antes do uso com dados reais.

## Como abrir e restaurar um backup

```bash
# 1. Descriptografar (vai pedir a BACKUP_SENHA)
gpg --output eco-gestao.dump --decrypt eco-gestao-AAAA-MM-DD.dump.gpg

# 2. Restaurar num banco (de preferência no projeto dev, para conferir antes)
pg_restore --dbname "ENDEREÇO_DO_BANCO" --no-owner --clean --if-exists eco-gestao.dump
```
