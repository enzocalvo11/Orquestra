# Orquestra

Protótipo de apoio à gestão de projetos: reúne tarefas de diferentes projetos, estima a capacidade dos profissionais e sinaliza conflitos de prazo ou sobrecarga.

## O que já funciona

- Dados fictícios no formato de work items do Azure DevOps: projetos, tarefas, bugs, testes, responsáveis, habilidades, estimativas e prazos.
- Visão de portfólio, timelines por projeto e capacidade semanal.
- Alertas e sugestões de realocação calculadas a partir de habilidades, capacidade disponível e prazo.
- Realocação por formulário ou arrastar e soltar; as alterações de planejamento ficam registradas em D1 e podem ser restauradas.
- No Planejamento, uma atividade só pode ser movida para quem tem a habilidade exigida. Durante o arraste, as células de quem não tem a habilidade ficam apagadas; ao soltar nelas, um aviso no canto explica o motivo. Cada pessoa mostra os projetos em que atua, e a cor do projeto aparece na borda dos cartões. A página rola sozinha quando o cartão é arrastado perto do topo ou do rodapé.

## Estado da integração

O Azure DevOps fornece os projetos e Work Items exibidos pela aplicacao. O cadastro interno de profissionais e os dados de capacidade continuam locais, assim como as propostas de planejamento salvas em D1. Nao inclua tokens ou credenciais no navegador.

## Estrutura do código

```text
app/                rotas, API e ponto de entrada da aplicação
components/         peças reutilizáveis de interface
features/           telas e coordenação do dashboard
data/               conjunto fictício de projetos, pessoas e work items
lib/planning.ts     regras puras de capacidade, alertas e sugestões
db/                 conexão, schema e migrações da persistência D1
docs/architecture.md fluxo dos dados e responsabilidades de cada pasta
```

Veja [docs/architecture.md](docs/architecture.md) para entender o caminho dos dados e onde implementar mudanças.

Para retomar o projeto em outra sessão do Codex, leia também [docs/CODEX_CONTEXT.md](docs/CODEX_CONTEXT.md). O arquivo reúne problema, fluxo principal, decisões, estado das telas, regras, limitações e próximas etapas.

## Desenvolvimento local

Use Node.js 22.13 ou superior. Na pasta que contem `package.json`, execute:

```bash
npm ci
npm run build
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0000_married_adam_warlock.sql --persist-to .wrangler/state
npm run dev
```

O comando do D1 cria a tabela local na primeira instalacao. Nos proximos acessos, basta `npm run dev`. Abra a URL mostrada pelo terminal, normalmente `http://localhost:5173`. A base local fica em `.wrangler/state` e e separada da base hospedada. Para conferir alteracoes, execute `npm run lint`, `npx tsc --noEmit` e `npm run build`.

## Visão Geral

A Visão Geral usa a semana do cenário que coincide com a data atual em São Paulo. Fora do período de 5 de outubro a 1º de novembro de 2026, mostra a semana mais próxima como **período do cenário**. O mapa usa a carga e a capacidade calculadas em `lib/planning.ts`, incluindo ausências e feriado. Cada cor é proporcional ao percentual de ocupação; o número e as horas permanecem visíveis para não depender somente da cor.

Selecione uma pessoa para ver as atividades e a causa da ocupação. Quando existe uma sugestão, **Revisar sugestão** abre a atividade com o destino proposto e o impacto estimado. A mudança só é gravada no D1 após **Confirmar realocação**. Os alertas e o gráfico mostram apenas a semana exibida; o planejamento mantém as quatro semanas.

## Atribuicao ficticia no Azure DevOps

O endpoint `POST /api/azure-devops/assign` atualiza a tag `responsavel:<id>` de um Work Item real, usando os IDs internos existentes (`ana`, `bruno`, `carla`, `diego`, `elisa`, `fernanda` ou `gustavo`). Ao confirmar uma troca de responsavel, a interface usa o ID real associado ao Work Item carregado. A aplicacao preserva tags de outros tipos, remove a tag `responsavel:` anterior e evita duplicatas.

Configure `AZURE_DEVOPS_ORGANIZATION=ImportAtlas`, `AZURE_DEVOPS_PROJECT=Orquestra2` e o segredo `AZURE_DEVOPS_PAT` no servidor ou Worker. Para desenvolvimento local, preencha `AZURE_DEVOPS_PAT` em `.dev.vars` (ignorado pelo Git); `.dev.vars.example` mostra o formato. O PAT precisa de permissao para ler e atualizar Work Items. Nunca exponha o PAT no navegador.

### Atribuir responsavel pela interface

Abra um Work Item carregado do Azure DevOps, escolha outro responsavel e confirme a realocacao. Na tela Planejamento, salve as alteracoes pendentes. A aplicacao usa o ID real associado a tarefa, atualiza `System.Tags`, consulta os Work Items novamente e atualiza a interface.

## Fonte atual dos dados de planejamento

Os Work Items e os projetos exibidos agora são consultados do Azure DevOps (`ImportAtlas/Orquestra2`) em `GET /api/source`. A consulta usa WIQL para tarefas, bugs e testes, busca seus campos e tags em lotes e recarrega a lista depois de uma atribuição. O código local mantém somente dados complementares que não existem no Azure (equipe, habilidades, capacidade, calendário e alguns metadados sem equivalente no Work Item). As propostas locais de semana continuam em D1; os dados de Work Items não são lidos de D1 nem do conjunto fictício.

As tags `responsavel`, `prazo` e `demo` têm no máximo uma ocorrência de cada tipo após atualização. Ao atribuir responsável, a tag anterior `responsavel:` é substituída; os formatos existentes `prazo-...` e `demo-...` são reconhecidos e preservados sem duplicatas.
