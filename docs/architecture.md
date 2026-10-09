# Arquitetura da Orquestra

Este documento descreve o protótipo atual. O objetivo é manter a interface, as regras de planejamento, os dados de exemplo e a persistência em lugares distintos, para que cada parte possa ser explicada e alterada sem procurar tudo em um único arquivo.

## Fluxo de uma tela

1. `app/page.tsx` carrega do D1 as realocações previamente propostas.
2. `features/dashboard/Dashboard.tsx` mantém o estado da navegação, seleção de projeto e ações do usuário.
3. Uma página em `features/` apresenta cada área do produto e recebe dados e ações por propriedades.
4. `lib/planning.ts` aplica as regras de capacidade, carga, alertas e sugestões. As funções não dependem de React nem de chamadas HTTP.
5. Peças reutilizadas entre telas ficam em `components/`.

## Fluxo de uma realocação

1. A pessoa escolhe outra pessoa/período no formulário ou solta o cartão numa célula do quadro.
2. O dashboard envia a mudança para `POST /api/plan`.
3. A rota valida tarefa, período e habilidade; depois salva a proposta na tabela `plan_changes`.
4. A rota devolve as mudanças salvas; o dashboard atualiza o estado e recalcula as visões com `lib/planning.ts`.
5. `DELETE /api/plan` apaga as propostas e volta ao planejamento inicial.

## Pastas principais

| Local | Responsabilidade |
| --- | --- |
| `app/` | Entrada web, estilos globais e rotas HTTP. |
| `features/dashboard/` | Estado da aplicação e composição das telas. |
| `features/overview/` | Resumo, alertas e sugestões. |
| `features/timelines/` | Itens organizados por projeto e prazo. |
| `features/planning/` | Quadro semanal de alocação. |
| `features/team/` | Visão dos profissionais e habilidades. |
| `features/work-items/` | Detalhe e edição de uma atividade. |
| `components/` | Elementos visuais compartilhados entre funcionalidades. |
| `data/demo-data.ts` | Dados fictícios que simulam a fonte de work items. |
| `lib/planning.ts` | Cálculos e regras de planejamento. |
| `db/` | Acesso ao D1 e schema da tabela de mudanças. |
| `app/api/` | Endpoints para salvar o planejamento, consultar o Azure DevOps e atualizar tags. |

## O que os dados significam hoje

- O Azure DevOps fornece projetos e Work Items por `GET /api/source`.
- `data/demo-data.ts` mantem dados internos da equipe e metadados complementares que nao existem como campos do Azure.
- `db/` guarda somente propostas de planejamento, como semana local; nao substitui o Azure como fonte dos Work Items.

## Onde começar ao fazer mudanças

- Alterar a amostra de dados: `data/demo-data.ts`.
- Alterar como sobrecarga, capacidade ou sugestões são calculadas: `lib/planning.ts`.
- Alterar conteúdo ou organização de uma tela: o arquivo correspondente em `features/`.
- Adicionar uma peça visual reutilizável: `components/common/`, `components/layout/` ou `components/feedback/`.
- Alterar persistência: `db/` e a rota correspondente em `app/api/`.

A aplicacao associa tags de responsavel aos profissionais internos por seus IDs. Credenciais de integracao permanecem no servidor, nunca no codigo cliente.

## Atribuicao ficticia no Azure DevOps

`POST /api/azure-devops/assign` e `POST /api/azure-devops/tags` atualizam tags dos Work Items. `lib/azure-devops.ts` consulta `System.Tags`, substitui a tag do tipo solicitado, preserva as demais e envia JSON Patch; depois faz GET de confirmacao. O dashboard usa o ID real da tarefa carregada. A interface atual permite alterar responsavel e prazo; prazo e serializado como `prazo:<YYYY-MM-DD>` usando uma das quatro semanas configuradas. Organizacao, projeto e PAT sao configuracoes/segredos disponiveis somente no Worker (`AZURE_DEVOPS_ORGANIZATION`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`).

O endpoint generico aceita `responsavel`, `prazo` e `demo`, com validacao no servidor. A interface usa atualmente `responsavel` e `prazo`; nao ha editor de `demo` ou habilidade. No Planejamento, as alteracoes de tags ficam em rascunho e sao enviadas ao salvar. Depois de atualizar, o dashboard consulta `GET /api/source` para refletir os valores das tags na aplicacao.

## Fonte Azure DevOps

`GET /api/source` executa WIQL no projeto configurado e consulta em lotes os campos das tarefas, bugs e testes existentes. A interface carrega essa resposta ao abrir e ao atualizar; depois de alterar a tag de responsável, executa a mesma consulta para refletir o estado confirmado. `data/demo-data.ts` mantém os dados internos da equipe e metadados suplementares, enquanto a lista atual de Work Items e projetos em memória do navegador vem do Azure DevOps. O D1 persiste somente mudanças locais de semana do planejamento.
