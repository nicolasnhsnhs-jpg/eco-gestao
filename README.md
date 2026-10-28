# Eco Gestão

Sistema interno de gestão da **Eco Ambiental SC**, empresa de soluções ambientais em Santa Catarina
(controle de pragas, desentupimento, sucção de fossa e caixa de gordura, limpeza de coifa,
reservatórios e placas solares).

Ele reúne num lugar só os **clientes**, as **propostas**, os **serviços realizados com seus
vencimentos**, o **financeiro** e os **avisos** da equipe, e funciona no computador e no celular.

> 🚧 **Em construção por fases.** Veja o andamento em [Fases](#fases) e o planejamento completo em
> [PLANO.md](PLANO.md).

---

## Destaques técnicos

- **Permissões garantidas no banco de dados**, não só na tela: cada tabela tem regras de
  _Row Level Security_ (RLS) do PostgreSQL para os perfis Administrador, Financeiro, Vendedor e Recepção.
- **Auditoria:** quem criou ou alterou cada informação importante, com os valores de antes e depois.
- **LGPD:** coleta mínima, acesso por perfil, anonimização a pedido do titular e backups criptografados.
- **Tarefas automáticas no banco** (`pg_cron`): marca cobranças atrasadas, avisa sobre serviços perto
  de vencer e gera as mensalidades dos contratos no n-ésimo dia útil, considerando os feriados.
- **Responsivo e instalável** no celular (PWA).

## Tecnologias

| Camada      | Ferramenta                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Interface   | [React](https://react.dev) 19 + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)  |
| Estilo      | [Tailwind CSS](https://tailwindcss.com) 4, com as cores da marca                                         |
| Rotas       | [React Router](https://reactrouter.com)                                                                  |
| Dados       | [TanStack Query](https://tanstack.com/query)                                                             |
| Formulários | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev)                                  |
| Backend     | [Supabase](https://supabase.com): PostgreSQL, autenticação, RLS e armazenamento de arquivos              |
| Qualidade   | [Oxlint](https://oxc.rs), [Prettier](https://prettier.io), [Vitest](https://vitest.dev) e GitHub Actions |
| Hospedagem  | [Netlify](https://netlify.com)                                                                           |

## Estrutura

```
├── PLANO.md                 planejamento completo (modelo do banco, fases, decisões)
├── docs/                    guias de configuração
├── supabase/
│   ├── migrations/          mudanças no banco de dados, em ordem
│   └── tests/               testes das regras de permissão
├── src/
│   ├── app/                 rotas, layout e menu
│   ├── features/            um diretório por módulo (clientes, financeiro, ...)
│   ├── components/          componentes visuais reutilizáveis
│   └── lib/                 funções de apoio (perfis, utilidades)
└── netlify.toml             build, redirecionamento da SPA e cabeçalhos de segurança
```

## Como rodar no seu computador

Pré-requisito: [Node.js](https://nodejs.org) 24 ou mais novo.

```bash
npm install
cp .env.example .env.local   # depois preencha com os dados do projeto Supabase
npm run dev                  # abre em http://localhost:5173
```

| Comando          | O que faz                                    |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | servidor de desenvolvimento                  |
| `npm test`       | roda os testes                               |
| `npm run lint`   | procura erros comuns no código               |
| `npm run format` | formata todos os arquivos                    |
| `npm run build`  | confere os tipos e gera a versão de produção |

A configuração dos serviços externos (GitHub, Supabase, Netlify, domínio e e-mail) está em
[docs/CONFIGURACAO.md](docs/CONFIGURACAO.md).

## Fases

- [x] **Fase 0:** preparação do projeto, layout e verificações automáticas
- [x] **Fase 1:** login, perfis de acesso e cadastro/busca de clientes
- [x] **Fase 2:** financeiro (lançamentos, fluxo de caixa, cobranças atrasadas)
- [x] **Fase 3:** propostas (drive interno)
- [ ] **Fase 4:** serviços realizados, certificados, fotos e vencimentos
- [ ] **Fase 5:** contratos recorrentes e comissões
- [ ] **Fase 6:** perfis de vendedor e recepção
- [ ] **Fase 7:** avisos por WhatsApp e e-mail

## Privacidade

Este repositório contém **apenas código**. Nenhum dado de cliente, planilha, backup ou chave secreta é
versionado (veja o [.gitignore](.gitignore)).
