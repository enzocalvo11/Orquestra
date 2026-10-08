# Orquestra

Protótipo de apoio à gestão de projetos: reúne tarefas de diferentes projetos, estima a capacidade dos profissionais e sinaliza conflitos de prazo ou sobrecarga.

## O que já funciona

- Dados fictícios no formato de work items do Azure DevOps: projetos, tarefas, bugs, testes, responsáveis, habilidades, estimativas e prazos.
- Visão de portfólio, timelines por projeto, capacidade semanal e equipe.
- Alertas e sugestões de realocação calculadas a partir de habilidades, capacidade disponível e prazo.
- Realocação por formulário ou arrastar e soltar; as alterações de planejamento ficam registradas em D1 e podem ser restauradas.

## Estado da integração

O Azure DevOps ainda não está conectado. O botão de atualização consulta somente a fonte fictícia em `data/demo-data.ts`. A aplicação separa work items de demonstração e cadastro interno de profissionais, mas ainda usa dados locais para ambos. Não inclua tokens ou credenciais no navegador.

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

Use Node.js 22.13 ou superior. Na pasta que contém `package.json`, execute:

```bash
npm ci
npm run build
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0000_married_adam_warlock.sql --persist-to .wrangler/state
npm run dev
```

O comando do D1 cria a tabela local na primeira instalação. Nos próximos acessos, basta `npm run dev`. Abra a URL mostrada pelo terminal, normalmente `http://localhost:5173`. A base local fica em `.wrangler/state` e é separada da base hospedada. Para conferir alterações, execute `npm run lint`, `npx tsc --noEmit` e `npm run build`.

## Visão Geral

A Visão Geral usa a semana do cenário que coincide com a data atual em São Paulo. Fora do período de 5 de outubro a 1º de novembro de 2026, mostra a semana mais próxima como **período do cenário**. O mapa usa a carga e a capacidade calculadas em `lib/planning.ts`, incluindo ausências e feriado. Cada cor é proporcional ao percentual de ocupação; o número e as horas permanecem visíveis para não depender somente da cor.

Selecione uma pessoa para ver as atividades e a causa da ocupação. Quando existe uma sugestão, **Revisar sugestão** abre a atividade com o destino proposto e o impacto estimado. A mudança só é gravada no D1 após **Confirmar realocação**. Os alertas e o gráfico mostram apenas a semana exibida; o planejamento mantém as quatro semanas.
