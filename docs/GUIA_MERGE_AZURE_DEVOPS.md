# Guia de merge: Azure DevOps e planejamento

Este documento descreve as alteracoes presentes na working tree desta branch para orientar a IA que vai comparar e integrar a branch com `main`. Ele registra o estado observado no repositorio; nao executa nem solicita o merge.

## Objetivo da branch

Conectar projetos e Work Items do Azure DevOps ao Orquestra, manter o cadastro interno de equipe e capacidade no projeto, sincronizar a atribuicao ficticia por tags e permitir realocacoes no planejamento sem bloquear a escolha por habilidade.

O Azure DevOps e a fonte dos projetos e dos Work Items. O D1 continua guardando alteracoes locais de planejamento, principalmente a semana planejada. Dados internos sem equivalente no Azure — como habilidades, capacidade semanal e ausencias — continuam em `data/demo-data.ts`.

## Arquitetura e fluxo de dados

```text
Azure DevOps REST API
   | GET via WIQL + consulta de Work Items em lotes
   v
GET /api/source  ->  lib/azure-devops.ts
   | resposta com projetos, Work Items, pessoas internas e sincronizacao
   v
Dashboard.tsx -> Overview / Timelines / Planning / Team

Troca de responsavel:
Dashboard -> POST /api/azure-devops/assign -> GET Work Item -> PATCH System.Tags -> GET de confirmacao
           -> GET /api/source para atualizar a interface

Semana do planejamento:
PlanningPage -> alteracoes em rascunho -> PUT /api/plan -> D1 plan_changes
```

As chamadas ao Azure e o PAT ficam no backend/Worker. O frontend recebe apenas dados de Work Items e o resultado seguro da operacao de atribuicao; ele nunca recebe a credencial.

## Funcionalidades incluidas

### 1. Leitura dos projetos e Work Items do Azure

- `GET /api/source` usa WIQL no projeto configurado para buscar Tasks, Bugs e Tests nao removidos.
- Os IDs encontrados sao consultados em lotes de ate 200 Work Items.
- O mapeamento usa campos do Azure como titulo, tipo, estado, Area Path, Team Project, Iteration Path, tags, descricao, estimativas, horas restantes e prioridade.
- O ID real e mantido em `externalId`; a chave de interface usa o formato `AZURE-<id>`.
- Projetos sao agrupados pelo Area Path. Metadados suplementares locais sao usados somente quando faltam campos complementares no Azure.
- Tags `responsavel:<id>` e `responsavel-<id>` identificam um responsavel interno conhecido. A tag e a fonte de verdade para a pessoa atual. Sem tag reconhecida, a atividade fica como `sem-responsavel`; atribuicoes antigas do D1 nao devem sobrepor o Azure.
- As tags `habilidade`, `prazo` e `demo` podem complementar o mapeamento. Para `demo-<id>`, o cadastro local suplementar pode preencher feature, PBI e outros dados sem equivalente no Work Item.
- A interface consulta a fonte ao abrir e oferece atualizacao manual. A resposta inclui contagem, horario da consulta e estado de erro/carregamento.

### 2. Atribuicao ficticia por tag

- O endpoint `POST /api/azure-devops/assign` recebe `{ "workItemId": <id>, "personId": "<id-interno>" }`.
- O ID enviado vem do `externalId` do Work Item carregado; nao existe campo manual de ID na tela.
- O backend consulta as tags atuais e preserva as tags sem relacao com os tipos especiais.
- A tag de responsavel anterior — inclusive formatos reconhecidos com `:` ou `-` — e substituida por uma unica `responsavel:<id>`.
- Tipos especiais `responsavel`, `prazo` e `demo` ficam sem duplicatas quando as tags sao normalizadas.
- Se o Work Item ja possui tags, a API usa JSON Patch `replace` em `System.Tags`, enviando a lista completa preservada e corrigida. Se nao possui tags, usa `add` para criar o campo.
- A operacao faz GET, PATCH e GET de confirmacao. Se a resposta ainda mostrar tag antiga ou mais de uma tag de responsavel, o endpoint retorna erro em vez de indicar sucesso.
- O campo nativo `System.AssignedTo` nao e alterado.
- Ao confirmar uma realocacao fora da aba Planejamento, o dashboard atualiza a tag quando o responsavel mudou e recarrega `/api/source`.
- Na aba Planejamento, a atribuicao so e enviada ao Azure ao salvar as alteracoes pendentes; a tela entao recarrega a fonte.

### 3. Planejamento e realocacoes

- O quadro permite arrastar qualquer Work Item para qualquer profissional real e qualquer uma das quatro semanas exibidas, sem bloquear por diferenca entre habilidade e atividade.
- O modal de tarefa oferece todos os profissionais internos na aba Planejamento. Nas outras telas, permanece o filtro atual por habilidade.
- A linha `Sem responsavel` pode exibir atividades sem tag, mas nao e um destino de atribuicao.
- Mover para uma semana posterior ao prazo e permitido; a interface continua mostrando o aviso de prazo.
- As quatro semanas sao o horizonte atualmente suportado pelo quadro e pelo `weekIndex` do D1. Esta branch nao adiciona datas arbitrarias fora desse horizonte.
- `PUT /api/plan` valida tarefa, profissional e semana e nao rejeita a realocacao por habilidade. A rota `POST /api/plan`, usada pelo fluxo imediato fora do planejamento, ainda mantem a validacao de habilidade existente.
- O responsavel atual vem do Azure. O D1 guarda as alteracoes de planejamento; uma atribuicao de responsavel feita no Azure nao deve ser reapresentada como se precisasse ser persistida novamente no D1.
- Depois de atualizar o responsavel no Azure, o dashboard calcula quais alteracoes ainda diferem da fonte atual para conferir o resultado do `PUT /api/plan`. Isso evita erro falso quando a unica mudanca foi a tag de responsavel e a API corretamente normalizou a lista local para vazia.
- As sugestoes automaticas continuam respeitando habilidades e capacidade. A permissao de escolha livre aplica-se a acao manual na aba Planejamento.

## Arquivos alterados e criados nesta working tree

### Arquivos criados

- `.dev.vars.example`: modelo local das configuracoes Azure; PAT intencionalmente vazio.
- `app/api/azure-devops/assign/route.ts`: endpoint servidor para atribuir responsavel por tag.
- `lib/azure-devops.ts`: cliente REST, leitura da fonte, mapeamento de Work Items e normalizacao/substituicao de tags.
- `lib/azure-devops.test.mjs`: testes mockados do cliente e das regras de tags/plano.
- `docs/GUIA_MERGE_AZURE_DEVOPS.md`: este guia de integracao e merge.

### Arquivos modificados

- `.gitignore`: ignora `.dev.vars` para evitar versionar o PAT local.
- `README.md`: documenta fonte Azure, configuracao e fluxo de atribuicao.
- `docs/architecture.md`: atualiza a arquitetura e os fluxos de fonte/atribuicao.
- `app/api/source/route.ts`: consulta Azure e retorna Work Items/projetos, metadados de fonte e erros seguros.
- `app/api/plan/route.ts`: valida planejamento contra Work Items carregados do Azure; PUT permite realocacoes sem restricao por habilidade.
- `data/demo-data.ts`: separa pessoas/projetos/Work Items suplementares e mantem a fonte Azure carregada em variaveis substituiveis.
- `features/dashboard/types.ts`: amplia o tipo de resposta da fonte.
- `features/dashboard/Dashboard.tsx`: carrega/recarrega Azure, coordena atribuicao, realocacao e sincronizacao, distingue rascunhos do planejamento e dados ja refletidos no Azure.
- `features/overview/OverviewPage.tsx`: exibe fonte, contagem, atualizacao, carregamento e erro da consulta Azure.
- `features/planning/PlanningPage.tsx`: aceita arraste para qualquer profissional valido, mantendo a linha sem responsavel como origem visual e nao como destino.
- `features/work-items/TaskDialog.tsx`: remove entrada manual do ID Azure e permite escolher qualquer profissional na aba Planejamento.
- `lib/planning.ts`: aceita Work Items recebidos da fonte, usa a atribuicao atual do Azure e preserva apenas mudancas pendentes como rascunho de pessoa; exclui `sem-responsavel` das sugestoes automaticas.
- `app/globals.css`: remove estilos da antiga secao de atribuicao manual no modal.
- `components/layout/Sidebar.tsx`: identifica o workspace ImportAtlas/Orquestra2 e a origem Azure.

Nenhuma dependencia foi adicionada e nenhum schema/migration do D1 foi alterado. O banco ficticio/local nao foi substituido.

## Configuracao e segredos

Valores nao secretos usados pela integracao:

```text
AZURE_DEVOPS_ORGANIZATION=ImportAtlas
AZURE_DEVOPS_PROJECT=Orquestra2
```

`AZURE_DEVOPS_PAT` deve ser preenchido manualmente como segredo do ambiente do servidor/Worker. Para desenvolvimento local, preencha `AZURE_DEVOPS_PAT` em `.dev.vars` na raiz. Esse arquivo e ignorado pelo Git. Para deploy, configure Organization e Project como variaveis do Worker e PAT como secret no painel da hospedagem.

O PAT precisa ler e atualizar Work Items. Nao copiar seu valor para `.dev.vars.example`, README, frontend, testes, mensagens de erro ou logs.

## Compatibilidade e pontos de atencao no merge

1. Integrar os arquivos como um conjunto. As rotas de API, o cliente Azure, o tipo `SourceInfo`, o estado do dashboard e o mapeamento em `data/demo-data.ts` dependem uns dos outros.
2. Se `main` tambem tiver alteracoes em `Dashboard.tsx`, `data/demo-data.ts`, `lib/planning.ts` ou `app/api/plan/route.ts`, preservar ambas as responsabilidades; esses sao os principais pontos provaveis de conflito.
3. Manter `internalPeople`, `supplementalProjects`, `supplementalWorkItems` distintos dos arrays atuais carregados do Azure. Nao restaurar a antiga fonte ficticia como lista principal dos Work Items.
4. Manter `externalId` como ID numerico do Azure. Nao fixar ID 46 em implementacao ou testes de interface.
5. Manter PATCH de `System.Tags` no servidor e nao escrever no campo `System.AssignedTo`.
6. Nao remover `.dev.vars` do `.gitignore` nem adicionar credenciais a configuracao versionada.
7. Nao aceitar silenciosamente sucesso do PATCH: a resposta do GET de confirmacao deve conter uma unica tag `responsavel:` correspondente ao destino.
8. D1 permanece necessario para o planejamento local. Nao excluir `plan_changes` nem substituir a persistencia sem uma decisao separada.
9. O endpoint PUT e usado para salvar em lote no Planejamento; POST e usado por outro fluxo e ainda possui validacao de habilidade. Preservar essa diferenca, a menos que a regra de negocio seja alterada explicitamente.

## Validacao executada

Na working tree descrita, os comandos abaixo foram executados com sucesso:

```bash
npm run lint
npx tsc --noEmit
npx --no-install tsx --test lib/azure-devops.test.mjs
npm run build
```

Os nove testes do cliente Azure usam `fetch` mockado; nao alteram Work Items reais. Eles cobrem substituicao/preservacao de tags, tags duplicadas, resposta desatualizada apos PATCH, erro HTTP, leitura da fonte e precedencia da tag Azure sobre pessoa antiga persistida no D1.

O build pode emitir um aviso de deprecacao `punycode` da cadeia de ferramentas, mas concluiu com sucesso.

## Passos recomendados depois da integracao

1. Resolver conflitos mantendo os fluxos acima e revisar `git diff` da branch resultante.
2. Confirmar que `.dev.vars` nao foi adicionado ao Git e que o PAT esta apenas no ambiente local/Worker.
3. Executar lint, TypeScript, testes mockados e build na branch integrada.
4. Com PAT configurado, validar manualmente a leitura de um Work Item e trocar um responsavel de teste; consultar o Work Item no Azure para confirmar que `responsavel:` antiga saiu e a nova permaneceu.
5. Testar no Planejamento uma mudanca de responsavel sem mudar semana e outra mudanca que tambem altere semana.
6. Nao executar deploy como parte do merge sem solicitacao explicita.
