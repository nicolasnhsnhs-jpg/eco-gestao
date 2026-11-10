# Configuração do WhatsApp (API oficial da Meta)

Guia para ligar o número comercial **(48) 98860-8723** ao CRM do Eco Gestão (unidade SC).
O sistema usa somente a **WhatsApp Business Platform (Cloud API)** da Meta: nada de WhatsApp Web
nem de aplicativos não oficiais.

> **Segurança:** o token e a chave secreta do app **nunca** vão para o chat, para o código
> ou para arquivos do projeto. Eles ficam só nos segredos das Edge Functions do Supabase (passo 7).

## Como funciona

```
Cliente no WhatsApp ─► Meta (Cloud API) ─► Edge Function "whatsapp" (webhook, Supabase)
                                              confere a assinatura, grava e responde 200
Atendente no sistema ─► Edge Function "crm" ─► Meta   (o token fica só no servidor)
```

## 1. Portfólio empresarial (Meta Business)

1. Acesse <https://business.facebook.com> e crie (ou use) o portfólio da **Eco Ambiental SC**.
2. Recomendado: **Central de Segurança → Verificação da empresa**, com o CNPJ e um documento
   da empresa. A verificação aumenta o limite de conversas iniciadas pela empresa e ajuda na
   aprovação do nome de exibição.

## 2. App no Meta for Developers

1. Acesse <https://developers.facebook.com/apps> → **Criar app** → tipo **Empresa (Business)**,
   ligado ao portfólio do passo 1.
2. No painel do app, adicione o produto **WhatsApp**.
3. Em **Configurações do app → Básico**:
   - copie a **Chave secreta do app (App Secret)**: ela vai no passo 7;
   - preencha a **URL da Política de Privacidade** (obrigatória para publicar o app). Ela pode
     ficar em `https://www.ecoambientalsc.com.br/...`.
4. Coloque o app no modo **Ao vivo (Live)** quando terminar.

## 3. Número de telefone

O número é novo e **não pode estar ativo** em nenhum app do WhatsApp. Depois de ligado à API,
ele não abre no app do celular: o atendimento é feito pelo sistema.

1. **WhatsApp Manager → Contas → Números de telefone → Adicionar número**.
2. Nome de exibição: **Eco Ambiental SC**. A Meta revisa o nome; a aprovação pode levar alguns dias.
   O nome só pode ser alterado no WhatsApp Manager (a API não altera).
3. Confirme o número pelo código por SMS ou ligação.
4. Anote o **ID do número de telefone (Phone number ID)** e o **ID da conta do WhatsApp Business
   (WABA ID)**, que aparecem em **WhatsApp → Configuração da API** no painel do app.

## 4. Usuário do sistema e token permanente

O token temporário do painel vence em 24 horas. Para produção:

1. **Configurações do negócio → Usuários → Usuários do sistema → Adicionar**: nome "Eco Gestão",
   função **Administrador**.
2. **Atribuir ativos**: o app (controle total) e a conta do WhatsApp (controle total).
3. **Gerar token**: escolha o app, validade **Nunca** e as permissões
   `whatsapp_business_messaging` e `whatsapp_business_management`.
4. Copie o token: ele vai no passo 7 e não aparece de novo.

## 5. Forma de pagamento

**WhatsApp Manager → Configurações → Pagamentos**: cadastre um cartão. Responder o cliente
não é cobrado, mas os modelos (templates) são, e sem forma de pagamento eles não saem.

## 6. Registrar o número na Cloud API

Com o token (troque `PHONE_NUMBER_ID`, `TOKEN` e o PIN de 6 dígitos que você escolher; o PIN
vira a confirmação em duas etapas do número, então guarde-o):

```bash
curl -X POST "https://graph.facebook.com/v23.0/PHONE_NUMBER_ID/register" -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"123456\"}"
```

E inscreva o app para receber os eventos desta conta (troque `WABA_ID`):

```bash
curl -X POST "https://graph.facebook.com/v23.0/WABA_ID/subscribed_apps" -H "Authorization: Bearer TOKEN"
```

## 7. Segredos no Supabase (produção SC)

Crie um texto aleatório para o **token de verificação do webhook** (por exemplo, com
`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`). Depois, num arquivo
**fora do projeto** (por exemplo `C:\temp\whatsapp.env`), escreva:

```
WHATSAPP_TOKEN=token-do-passo-4
WHATSAPP_APP_SECRET=chave-secreta-do-passo-2
WHATSAPP_VERIFY_TOKEN=texto-aleatorio
```

E rode (depois apague o arquivo):

```bash
npx supabase secrets set --env-file C:\temp\whatsapp.env --project-ref qteahjezxiregnaomoqz
```

Opcional: `WHATSAPP_GRAPH_VERSION` (padrão `v23.0`). Atualize-o quando a Meta avisar que a versão
vai ser descontinuada.

### Chaves das notificações no celular (VAPID)

As notificações push não dependem da Meta: dá para ligar e testar antes dos passos 1 a 6.
Gere o par de chaves uma vez só. O comando grava o arquivo `C:\temp\vapid.env`:

```bash
node -e "const c=require('crypto'),fs=require('fs');const j=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({format:'jwk'});const pub=Buffer.concat([Buffer.from([4]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]).toString('base64url');fs.mkdirSync('C:/temp',{recursive:true});fs.writeFileSync('C:/temp/vapid.env','VAPID_PUBLICA='+pub+'\nVAPID_PRIVADA='+j.d+'\nVAPID_CONTATO=mailto:adm@ecoambientalsc.com.br\n')"
```

```bash
npx supabase secrets set --env-file C:\temp\vapid.env --project-ref qteahjezxiregnaomoqz
```

Depois apague o arquivo. **Não troque as chaves sem motivo:** cada aparelho se inscreveu com a
chave pública. Se ela mudar, o aparelho só volta a receber depois de abrir o sistema de novo, quando
ele refaz a inscrição sozinho.

## 8. Banco e funções em produção

```bash
npm run db:push:prod
```

```bash
npm run funcoes:prod
```

Cadastre o número (troque os IDs do passo 3). No **SQL Editor** do projeto de produção SC:

```sql
insert into public.wa_numeros (phone_number_id, waba_id, numero_exibicao, nome)
values ('PHONE_NUMBER_ID', 'WABA_ID', '+55 48 98860-8723', 'Eco Ambiental SC');
```

## 9. Webhook

No painel do app: **WhatsApp → Configuração → Webhook → Editar**.

| Campo                     | Valor                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| URL de retorno (callback) | `https://qteahjezxiregnaomoqz.supabase.co/functions/v1/whatsapp` |
| Token de verificação      | o mesmo `WHATSAPP_VERIFY_TOKEN` do passo 7                       |

Clique em **Verificar e salvar**. Depois, em **Campos do webhook**, assine **messages**
(ele traz as mensagens recebidas e os status enviada, entregue, lida e falhou).

## 10. Teste

Mande uma mensagem de outro celular para o (48) 98860-8723. Ela deve aparecer em `wa_mensagens`
(e, a partir da Etapa 4, na tela do CRM). Se não aparecer:

- **Edge Functions → whatsapp → Logs** no Supabase: "assinatura inválida" indica que o
  `WHATSAPP_APP_SECRET` está errado.
- Tabela `wa_eventos`: a coluna `erro` mostra o motivo, por exemplo um número que não está em `wa_numeros`.

## Quem atende

O **Administrador** sempre entra no CRM. Para os outros perfis, ligue **atende WhatsApp** na tela
de usuários (Etapa 4; até lá, pela coluna `perfis.atende_whatsapp`). O operador nunca entra.

| Perfil             | O que vê                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| Administrador      | todas as conversas; transfere para qualquer atendente                    |
| ADM                | primeiro contato, conversas do setor administrativo e as dele; encaminha |
| Financeiro         | só as direcionadas a ele                                                 |
| Vendedor, Recepção | só as dele                                                               |

Quem responde um primeiro contato vira o responsável. Quando o cliente volta depois de um
atendimento finalizado, a conversa volta para o primeiro contato, e o sistema lembra quem atendeu da última vez.

## Regras da Meta que valem para o CRM

- **Janela de 24 horas:** a equipe responde livremente até 24 horas depois da última mensagem
  do cliente. Depois disso, só com **modelo (template)** aprovado pela Meta.
- **Foto do cliente:** a Cloud API **não informa** a foto de perfil, só o nome e o número.
- **Confirmação de leitura:** o "lida" das mensagens enviadas só aparece se o cliente deixar
  a confirmação de leitura ligada.
- **Arquivos:** foto JPG/PNG até 5 MB, vídeo MP4/3GP até 16 MB, áudio até 16 MB e documento até
  100 MB. O que não se encaixa vai como documento.

## Custos

A Meta cobra **por mensagem de modelo (template)**, conforme a categoria (marketing, utilidade
ou autenticação) e o país do cliente. Responder o cliente dentro da janela de 24 horas
**não é cobrado**, e modelos de utilidade dentro da janela também não. Os valores mudam: confira
a tabela atual em <https://developers.facebook.com/docs/whatsapp/pricing>.
