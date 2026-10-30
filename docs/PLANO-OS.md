# Plano: perfil Operador e Ordens de Serviço (OS) digitais

## Contexto

Hoje as OS são fichas em papel, preenchidas à mão em campo e conferidas depois no escritório. O
sistema já tem clientes, endereços, serviços realizados, vencimentos, arquivos e financeiro, mas
nenhum perfil para quem executa o serviço. O objetivo é:

- criar o perfil **operador**;
- digitalizar a OS em três camadas, **escopo**, **execução** e **conferência**, com as permissões
  garantidas pelo banco;
- reaproveitar o escopo de uma visita para a próxima;
- gerar o PDF da OS.

> Você confirmou "endereço vira unidade". As outras 3 escolhas (login do operador, offline e ordem
> das fases) usam as opções que eu recomendei, marcadas com **(assumido)**. Dá para mudar qualquer
> uma na aprovação.

---

## 1. O que já existe e onde a OS se encaixa

- **Stack:**
  - Banco: Supabase (Postgres + RLS + Storage + Edge Function `usuarios`).
  - Tela: React 19 + TanStack Query + react-hook-form/zod + Tailwind v4.
  - Hospedagem: Netlify.
- **Perfis:**
  - O enum `public.papel` (`admin`, `financeiro`, `vendedor`, `recepcao`) fica na tabela `perfis`.
  - As regras usam funções em `privado`: `meu_papel()`, `tem_acesso_total()`, `e_admin()` e
    `pode_ver_cliente()` ([base_perfis.sql](supabase/migrations/20261028130000_base_perfis.sql)).
  - `pode_ver_cliente_linha` só libera admin, financeiro, recepção e o vendedor dono do cliente.
    Um operador novo **não verá nenhum cliente**, que é exatamente o que queremos.
- **Clientes:** `clientes`, `enderecos` (vários por cliente, com `apelido` mas **sem CNPJ**) e
  `contatos_cliente` (no nível do cliente).
- **Serviços:** `servicos` (status agendado/realizado/cancelado, `tecnicos` em texto livre). Um
  gatilho mantém `vencimentos_servico` por cliente + endereço + tipo
  ([servicos.sql](supabase/migrations/20261031120000_servicos.sql)).
- **Arquivos:**
  - Tabela `arquivos` + bucket privado, com compressão de fotos em `src/lib/arquivos.ts`.
  - Hoje o Storage só aceita envio na pasta `clientes/<id>`, para quem enxerga o cliente.
- **Comum a todas as tabelas:** triggers `privado.carimbar()` e `privado.registrar_auditoria()`
  (quem fez o quê e quando).

**Encaixe:**

- **A OS é a "ficha de campo" de um serviço.** Quando ela é concluída, o sistema cria ou atualiza
  o registro em `servicos` (status `realizado`). Com isso os vencimentos e os avisos que já
  existem continuam funcionando sozinhos.
- **O faturamento da conferência** gera um `lancamento` a receber no financeiro atual.

## 2. Modelo de dados

### Ajustes no que existe

- **Unidade = endereço (confirmado por você).** `enderecos` ganha `cnpj` (validado com
  `privado.cnpj_valido`), `razao_social` e `inscricao_estadual`, todos opcionais.
  - Vazio = usa o CNPJ do cliente.
  - **Sem regra de "CNPJ único"**, porque o mesmo CNPJ pode ter várias unidades na mesma região,
    como a Naturovos.
  - O `apelido` vira o nome da unidade ("Depósito 97"). Os vencimentos por endereço continuam
    iguais.
- **`contatos_cliente`** ganha `endereco_id` opcional: vazio vale para todas as unidades.
- **`papel`** ganha o valor `operador`.
- Nova tabela **`veiculos`**: placa, descrição, ativo.
- **`arquivos`** ganha `os_id`, e o enum `categoria_arquivo` ganha `foto_os` e `assinatura`.

### Modelo (fica guardado por cliente + unidade + tipo)

- **`os_modelos`**:
  - chaves: `cliente_id`, `endereco_id`, `tipo_servico_id` (únicos juntos);
  - escopo: `escopo jsonb` com os campos simples do tipo (descrição, subtipo, pragas alvo, áreas de
    insetos, produto padrão…) e `observacoes_adm_padrao`;
  - padrões: `operadores_padrao uuid[]` e `veiculo_padrao_id`.
- **`pontos_controle`**: os itens físicos que se repetem a cada visita.
  - Colunas: `modelo_id`, `tipo` (`porta_isca` | `armadilha_luminosa` | `coifa`), `numero`,
    `area`, `atributos jsonb`, `ordem`, `ativo`.
  - Exemplos de `atributos`: forma de iscagem e tipo de isca; modelo P/G e quantidade em contrato;
    material e quantidade de telas.
  - O ponto tem **id permanente**. É isso que guarda o histórico ("porta-isca 12 teve consumo nas
    3 últimas visitas", "última troca de lâmpada").
  - Porta-isca novo instalado = ponto novo no modelo. Porta-isca retirado = `ativo = false`. O
    histórico não se perde.
  - **Cadastro em lote no escopo:** "Área Depósito, nº 1 a 80, PIE, isca parafinada" cria os 80
    pontos de uma vez. Depois se ajustam só os diferentes.

### Instância (uma por visita)

- **`ordens_servico`** (escopo, escrito só pelo escritório):
  - identificação: `numero` sequencial por ano (`OS-2026-0001`, igual às propostas), `modelo_id`,
    `cliente_id`, `endereco_id`, `tipo_servico_id`;
  - status e agenda: `status`, `data_agendada`, `veiculo_id`, `observacoes_adm`;
  - **`escopo jsonb`, uma foto congelada no momento do agendamento:** nome, CPF/CNPJ, endereço,
    telefones, contatos e escopo do tipo. O operador lê **só essa cópia**, nunca as tabelas de
    cliente. Isso reduz o que ele vê (LGPD) e mantém o PDF fiel ao que foi combinado.
  - ligações e carimbos: `servico_id` (ligação com `servicos`), `concluida_em`/`por`,
    `reaberta_em`/`por`/`motivo`.
- **`os_operadores`** (`os_id`, `operador_id`): um ou vários operadores por OS (a coifa pode ter
  mais de um).
- **`os_pontos`** (escopo da visita): cópia dos pontos ativos do modelo na criação da OS. Guarda
  `ponto_id` mais um retrato de número, área e atributos.

### Execução (escrita pelo operador)

- **`os_execucao`** (1 por OS):
  - deslocamento: data, `veiculo_id`, km de chegada;
  - horários: chegada, início, término e saída;
  - observações;
  - responsável do cliente: nome e setor;
  - assinaturas: caminhos da assinatura do responsável e do operador;
  - **`checklist jsonb`**: os campos "planos" do tipo, como as liberações da coifa, a conferência
    final e as observações gerais de pragas. O formato fica definido no código, por tipo e versão.
- **`os_execucao_pontos`** (1 por ponto por visita):
  - `situacao` (MS/MC/CT/IN/DT/SA/NE, M/SC/I/T, F/D/DL/LT, B/M/A);
  - `dados jsonb`: refil, higiene, lâmpadas trocadas, capturas por espécie, motivo de "sem acesso"…
- **`os_execucao_insetos`**: a tabela de controle localizado de insetos, uma linha por área ou praga.
- **`os_execucao_produtos`**: os produtos usados (princípio ativo, forma, unidades, gramas ou ml).
- **Fotos e assinaturas:** ficam em `arquivos` com `os_id`, na pasta `os/<os_id>/` do Storage.

### Conferência (escritório, invisível ao operador)

- **`os_conferencia`** (1 por OS):
  - administrativo: certificado, cronograma, alterações, solicitação, destinação;
  - logística;
  - financeiro: taxa faturada, valor, faturado em, valor faturado, nº NF, vencimento e
    **`lancamento_id`**, ligado ao lançamento a receber criado no financeiro;
  - envio: scanner, e-mail, relatórios, arquivo.

**Histórico de visitas:** é a sequência de `ordens_servico` concluídas do mesmo modelo. Cada visita
guarda o próprio retrato. A view `v_pontos_ultimo_estado` mostra, para cada ponto, a última
situação e a última troca de lâmpada, e a nova OS já vem preenchida com isso.

## 3. Permissões por camada (no banco)

| Camada                 | Admin           | Recepção   | Financeiro | Vendedor                   | Operador                                                |
| ---------------------- | --------------- | ---------- | ---------- | -------------------------- | ------------------------------------------------------- |
| Modelos e escopo da OS | cria/edita      | cria/edita | cria/edita | vê as OS dos clientes dele | **vê** só as OS atribuídas, só pela cópia `escopo`      |
| Execução               | edita, e reabre | vê         | vê         | vê                         | **edita** só as dele, enquanto `agendada`/`em_execucao` |
| Conferência            | edita           | edita      | edita      | não vê                     | **não vê** (sem permissão e sem regra de leitura)       |

Como isso fica garantido no banco:

- **Linhas visíveis:** a função nova `privado.os_e_minha(os_id)` é `exists` em `os_operadores`.
  Todas as regras de leitura do operador usam ela.
- **Colunas e tabelas:**
  - O operador **não tem permissão de UPDATE** em `ordens_servico`, `os_pontos` e `os_conferencia`.
    Ele só grava nas tabelas `os_execucao*`.
  - A mudança de status passa por funções no servidor: `iniciar_os`, `concluir_os` e
    `reabrir_os` (esta só para admin, com motivo obrigatório).
  - Essas funções seguem o padrão já usado: o miolo fica em `privado`, e uma casca em `public`
    roda com a permissão de quem chama.
- **Trava após a conclusão:** um gatilho nas tabelas `os_execucao*` recusa qualquer alteração
  quando a OS está `concluida` ou `conferida`. A exceção é o admin depois do `reabrir_os`.
- **Validação no servidor:** `concluir_os` confere os campos obrigatórios:
  - horários e assinatura do responsável;
  - números de exceção válidos, que existam no escopo e não estejam repetidos em dois códigos;
  - liberações da coifa respondidas;
  - pelo menos 1 foto quando o tipo exige.

  A tela usa as mesmas regras (zod) para avisar antes de enviar.

- **Arquivos:** novas regras no Storage para a pasta `os/<os_id>/`. O operador envia e vê só nas
  OS dele, e só enquanto ela está aberta.
- **Auditoria:** `registrar_auditoria()` em todas as tabelas novas. A reabertura fica registrada
  com o motivo.
- **Testes:** novos `supabase/tests/os.sql` e ampliação de `matriz_perfis.sql`, provando cada
  célula da tabela acima (o operador tenta ler a conferência, editar o escopo, mexer em OS de
  outro operador ou editar depois de concluída, e falha em todas).

## 4. Tipos de serviço flexíveis: híbrido (recomendado)

- **Estrutura no código** para o que é **lista com histórico** (porta-iscas, armadilhas, coifas)
  ou tem regra (cálculo de infestação): tabelas próprias, com tipos e validação forte.
- **Campos "planos" em `jsonb`**, com o formato declarado no código, por tipo
  (`src/features/os/tipos/pragas.ts`, `coifa.ts`, `generico.ts`). Cada formato gera o formulário,
  a validação zod e a seção do PDF.
- **`tipos_servico`** ganha `formulario_os` (`generico` | `pragas` | `coifa`). Um tipo novo e
  simples (ex.: "Hidrojateamento") é só cadastrar com `generico`: descrição + resultado +
  observações + fotos, **sem código novo**.
- **Fase futura:** o admin monta checklists extras para tipos genéricos pela tela (sim/não, texto,
  número, lista), guardados em `tipos_servico.campos_extras jsonb`.

| Opção                              | Prós                                              | Contras                                                                           |
| ---------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Campos fixos por tipo              | Simples, com validação forte                      | Cada tipo novo exige código e migration                                           |
| Tudo configurável (schema em JSON) | Tipos novos sem programar                         | Cálculos, histórico de pontos e PDF ficam difíceis, e o banco perde as validações |
| **Híbrido**                        | Pragas e coifa robustos, tipos simples sem código | Duas formas de dados para manter (aceitável)                                      |

## 5. Telas

**Escritório** (admin, recepção e financeiro):

- **OS** (novo item no menu): lista com filtros de status, data, operador e tipo, e uma visão
  "Agenda" por dia e operador.
- **Nova OS:**
  1. Escolhe cliente → unidade → tipo.
  2. Se já existe modelo, abre com tudo preenchido, e só se ajusta data, operadores, veículo e
     Observações ADM.
  3. Se não existe, preenche o escopo e o modelo é criado.
- **Ficha da OS** com abas **Escopo | Execução | Conferência | Arquivos**:
  - **"Gerar próxima visita"** cria a OS seguinte a partir do modelo;
  - **"Atualizar modelo com esta OS"** leva um porta-isca novo, por exemplo, para as próximas
    visitas.
- **Ficha do cliente:** nova seção "Ordens de serviço" e o CNPJ por unidade no cadastro de
  endereços.
- **Usuários:**
  - criar operador **com senha definida pelo admin (assumido)**: login no formato
    `nome@op.ecoambientalsc.com.br`, sem e-mail;
  - botão "redefinir senha".

  Isso exige uma ação nova na Edge Function `usuarios`.

- **Cadastros:** veículos.

**Operador** (celular, mobile-first):

- **Início = "Minhas OS"**: cartões grandes de hoje e dos próximos dias, com endereço (botão abre
  o mapa), contato (botão liga) e Observações ADM em destaque.
- **Execução em etapas**, com uma barra de progresso:
  1. **Chegada:** veículo, km e botões **"Registrar agora"** para chegada e início.
  2. **Itens: só as exceções, nunca ponto por ponto** (pedido seu: clientes com 200 porta-iscas).
     - **Todos os pontos começam como MS** (mantido sem consumo).
     - O operador vê um **botão grande por código**: MC, CT, IN, DT, SA, NE (e, nas placas,
       SC/T/I). Em cada um digita **só os números**, aceitando faixas: `MC: 12, 15, 40-45` e
       `CT: 7, 88`.
     - Cada código tem um campo de **motivo/observação** ("SA 30-33: área interditada pela obra").
     - Há uma **observação geral** de roedores.
     - Um **resumo ao vivo** confere a digitação ("200 pontos: 188 MS, 8 MC, 2 CT, 2 SA") e avisa
       se ele digitou um número que não existe.
     - Por trás, o sistema grava a situação de cada ponto automaticamente. Assim o histórico por
       porta-isca e o PDF continuam completos, sem custo para o operador.
     - O **nível de infestação** vem **sugerido** e pode ser alterado. A sugestão é a % de pontos
       com consumo (MC/CT/DT) entre os visitados, sem contar SA/NE: até 10% baixo, até 30% médio,
       acima de 30% alto.
     - Armadilhas luminosas e coifas são poucas por cliente, então ficam item a item, com botões
       de código grandes.
  3. **Produtos e insetos**, só em pragas.
  4. **Fotos:** câmera direta pelo `capture="environment"`, aproveitando a compressão que já existe.
  5. **Encerramento:** término e saída ("Registrar agora"), observações, nome e setor do
     responsável, **assinatura na tela** de quem acompanhou e visto do operador.
  6. **Concluir:** mostra o que falta, se faltar. Depois de concluída, fica só leitura.
- **Menu do operador:** só "Minhas OS" e "Avisos". Ele não vê Clientes, Financeiro nem valores.

## 6. Fases (entregas pequenas e testáveis)

| Fase                            | Entrega                                                                                                                                                                                                                                                                                  | Estimativa  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **OS-1 Fundação + OS genérica** | Perfil operador e login com senha do admin, unidade com CNPJ, veículos, modelo e OS genérica de ponta a ponta, telas do operador, assinatura, fotos, **rascunho local (assumido)**, conclusão com trava, reabertura pelo admin, ligação com `servicos`/vencimentos e testes de permissão | maior fase  |
| **OS-2 Conferência + PDF**      | Aba de conferência, faturamento gerando o lançamento a receber e PDF no layout das fichas, salvo automaticamente nos arquivos da OS                                                                                                                                                      | média       |
| **OS-3 Controle de pragas**     | Pontos de controle, "marcar todos MS", infestação sugerida, armadilhas com última troca de lâmpada, insetos, produtos e PDF de pragas                                                                                                                                                    | grande      |
| **OS-4 Coifa**                  | Lista de coifas, liberações, sujidade, fotos antes/depois por posição, conferência final e PDF de coifa                                                                                                                                                                                  | média       |
| **OS-5 (opcional)**             | Offline completo (app instalável) e checklists configuráveis pela tela                                                                                                                                                                                                                   | sob demanda |

Ordem recomendada **(assumido):** genérica → pragas → coifa. A genérica valida o fluxo inteiro com
pouco risco, e pragas é o serviço de maior volume.

**Offline (assumido: rascunho local no MVP):**

- Cada alteração fica salva no celular, no IndexedDB, e é enviada quando houver sinal.
- Fotos e assinaturas ficam numa fila e sobem depois.
- A tela mostra "salvo no celular / enviado".
- A única exigência é o operador abrir a OS uma vez com sinal.
- Custo: cerca de 2 dias.
- O **offline completo** custa cerca de +1,5 a 2 semanas: Service Worker, baixar as OS do dia, IDs
  gerados no celular e tratamento de conflitos. Recomendo deixar para a OS-5, se o rascunho local
  não bastar.

**PDF:**

- **Com o logo da Eco Ambiental no cabeçalho** (o mesmo do sistema) e as cores da empresa.
- Os porta-iscas aparecem **resumidos por código e área** ("MC: 12, 15, 40–45"), não numa tabela
  de 200 linhas.
- Gerado no navegador com `@react-pdf/renderer`, carregado só nessa tela para não pesar o resto.
- Salvo em `arquivos` (categoria `relatorio`) no momento da conclusão.
- Fica disponível para o escritório enviar ao cliente.

## 7. Riscos e dúvidas

**Riscos:**

- **Espaço de fotos no plano grátis do Supabase (1 GB):**
  - Conta: ~10 fotos de ~300 KB por OS × ~100 OS/mês ≈ **300 MB/mês**, o que lota em uns 3 meses.
  - Opções: plano Pro (US$ 25/mês, 100 GB) quando as OS entrarem em uso, ou limitar fotos e
    comprimir mais.
  - **Decidir antes da OS-1 ir para produção.**
- **Assinatura na tela:** vale como comprovante de acompanhamento, mas não é assinatura digital
  certificada. A tela registra junto nome, setor, data/hora e o usuário, o que é suficiente para o
  uso atual.
- **LGPD:** nome e assinatura do funcionário do cliente são dados pessoais. Eles entram na
  anonimização que já existe e ficam fora do alcance do vendedor.
- **Luvas e sol:** o MVP precisa ser testado em campo com um operador antes de ir para pragas.

**Perguntas em aberto** (respostas mudam detalhes, não a estrutura):

1. Confirmar as 3 escolhas **(assumido)**:
   - operador com login e senha do admin;
   - rascunho local no MVP;
   - ordem genérica → pragas → coifa.
2. **Fichas atuais:** preciso de foto ou PDF de cada ficha (pragas, coifa, genérica) para copiar o
   layout do PDF. A ficha da Naturovos que você mencionou não chegou até mim. Pode mandar de novo. Pode colocar numa pasta `docs/fichas/`, que fica fora do Git se tiver dados de
   cliente.
3. Quem cria as OS: admin e recepção, ou também o financeiro?
4. O vendedor deve ver as OS dos clientes dele (só leitura)?
5. O operador vê o histórico das visitas anteriores do local, ou só a OS atual com os dados herdados?
6. Numeração: `OS-2026-0001` serve, ou vocês já têm uma sequência em papel para continuar?

## Arquivos principais

- **Banco:** migrations novas em `supabase/migrations/` (`operador_unidades`, `ordens_servico`,
  `os_permissoes`, depois `os_pragas` e `os_coifa`), mais testes em `supabase/tests/os.sql` e em
  `matriz_perfis.sql`.
- **Servidor:** `supabase/functions/usuarios/index.ts`, com a ação de criar operador com senha.
- **Tela:**
  - `src/lib/papeis.ts` e `src/app/navegacao.ts`: perfil e menu do operador;
  - `src/app/router.tsx`: rotas novas;
  - `src/features/os/`: api, páginas do escritório, páginas do operador, `tipos/*`, `pdf/`;
  - `src/components/ui/Assinatura.tsx`;
  - componente de botões de código.
- **Reaproveitados:**
  - `useEnviarArquivos` / `comprimirSeForFoto` (`src/features/arquivos/api.ts`, `src/lib/arquivos.ts`);
  - `SelectForm`, `Modal`, `ClienteSeletor`, `hojeISO` (`src/lib/datas.ts`);
  - numeração anual das propostas;
  - `privado.carimbar` / `registrar_auditoria`.

## Verificação (em cada fase)

1. `npm run db:push` no dev, `npm run test:db` (incluindo a matriz do operador), `npm run db:types`.
2. `npm run typecheck && npm run lint && npm test` (testes de unidade: cálculo de infestação,
   validação de conclusão, fila do rascunho local).
3. Teste manual no painel do navegador, no tamanho de celular:
   1. criar o operador;
   2. agendar a OS;
   3. entrar como operador;
   4. preencher com o "modo avião" do navegador ligado;
   5. reconectar e ver sincronizar;
   6. concluir;
   7. confirmar que ficou travado;
   8. reabrir como admin.
4. Só depois `npm run db:push:prod` e a publicação.
