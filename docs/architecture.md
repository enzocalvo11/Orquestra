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
| `app/api/` | Endpoints para salvar o planejamento e consultar a fonte demo. |

## O que os dados significam hoje

- `data/demo-data.ts` é a fonte de exemplo com projetos, work items, profissionais, habilidades, capacidade, ausências e calendário.
- O identificador e a hierarquia dos itens imitam campos comuns do Azure DevOps, mas os dados não vêm de uma organização real.
- `db/` guarda apenas as realocações propostas. Não é uma cópia completa do Azure DevOps.
- `GET /api/source` simula uma atualização e informa a contagem de itens da demonstração; ainda não sincroniza dados externos.

## Onde começar ao fazer mudanças

- Alterar a amostra de dados: `data/demo-data.ts`.
- Alterar como sobrecarga, capacidade ou sugestões são calculadas: `lib/planning.ts`.
- Alterar conteúdo ou organização de uma tela: o arquivo correspondente em `features/`.
- Adicionar uma peça visual reutilizável: `components/common/`, `components/layout/` ou `components/feedback/`.
- Alterar persistência: `db/` e a rota correspondente em `app/api/`.

Antes de conectar o Azure DevOps, definir o mapeamento de identidades externas para os profissionais internos. Credenciais de integração devem permanecer no servidor, nunca no código cliente.
