# Contexto completo para desenvolvimento da Orquestra

## 1. Projeto e desafio

A **Orquestra** está sendo desenvolvida para o **Hackathon Iport**. O desafio pede uma plataforma hospedada que use dados fictícios com estrutura semelhante ao Azure DevOps: projetos, timelines, Features, PBIs ou User Stories, tarefas, bugs, testes, responsáveis, estimativas e prazos. A solução deve comparar atividades entre projetos e apoiar decisões de gestão.

O código passará por **code review antes da apresentação**. O uso de IA é permitido, mas a equipe precisa compreender e explicar toda a arquitetura, as regras principais e o caminho dos dados.

## 2. Problema que a solução resolve

Uma pessoa pode participar de vários projetos com planejamentos separados. Quando cada projeto é analisado isoladamente, o gestor não enxerga facilmente:

- a carga total da pessoa em todos os projetos;
- sobreposição de tarefas na mesma semana;
- ausência ou feriado que reduz a capacidade disponível;
- tarefa planejada depois do prazo;
- quem possui a habilidade e a disponibilidade necessárias para assumir uma atividade.

A Orquestra reúne essa informação, identifica conflitos e apresenta sugestões de ajuste. O usuário principal é um gestor, líder de equipe, coordenador ou profissional responsável pelo planejamento.

## 3. Proposta de valor

A solução deve permitir que o gestor:

1. veja rapidamente onde existe um conflito;
2. entenda quais projetos e atividades causaram o conflito;
3. receba uma recomendação explicável;
4. confira o impacto da recomendação;
5. confirme uma realocação;
6. veja o cenário recalculado.

Esse é o fluxo central do produto:

```text
Identificar conflito
        ↓
Entender a causa
        ↓
Analisar recomendação
        ↓
Revisar impacto
        ↓
Realocar atividade
        ↓
Confirmar novo cenário
```

As telas não devem despejar todos os dados ao mesmo tempo. A Visão Geral prioriza a decisão imediata; Timelines e Planejamento oferecem aprofundamento.

## 4. Estado atual das tecnologias

| Camada | Tecnologia atual |
| --- | --- |
| Interface | React 19 + TypeScript |
| Organização web | Next.js com Vinext e Vite |
| Backend | Rotas TypeScript em `app/api/`, executadas em Cloudflare Workers |
| Regras de planejamento | TypeScript em `lib/planning.ts` |
| Persistência | Cloudflare D1, baseado em SQLite |
| Acesso ao banco | Drizzle ORM |
| Hospedagem | ChatGPT Sites na V1; deploy direto no Cloudflare Workers preparado, mas ainda não publicado |
| Ícones | Lucide React |

Python e PostgreSQL foram considerados no início, mas **não fazem parte da implementação atual**. Manter uma única linguagem facilita o protótipo interativo e a execução no ambiente de hospedagem adotado.

## 5. Estado dos dados e da integração

O Azure DevOps ainda não está conectado. A integração está sendo tratada por outros integrantes.

Hoje:

- `data/demo-data.ts` contém projetos, pessoas, habilidades, capacidade, ausências, semanas e 22 work items fictícios;
- `GET /api/source` apenas simula uma atualização da fonte;
- o D1 guarda propostas de realocação e contatos de e-mail dos profissionais;
- a interface recalcula tudo com os dados locais depois de cada mudança;
- o usuário precisa ser informado de que está vendo uma demonstração.

No futuro, o Azure DevOps será a fonte de projetos e work items. Dados próprios da Orquestra, como habilidades, capacidade, squads, ausências e propostas de planejamento, continuarão precisando de uma fonte interna.

## 6. Cenário fictício

### Período

| Semana | Intervalo |
| --- | --- |
| S1 | 05/10/2026 a 11/10/2026 |
| S2 | 12/10/2026 a 18/10/2026 |
| S3 | 19/10/2026 a 25/10/2026 |
| S4 | 26/10/2026 a 01/11/2026 |

O dia 12/10 é feriado e reduz a capacidade da S2. Existem três ausências:

- Ana Costa: 8h na S1;
- Elisa Martins: 6h na S2;
- Bruno Lima: 8h na S3.

### Projetos

1. Portal de Agendamento
2. Integração de Terminais
3. Visão Operacional

### Equipe

Sete profissionais fictícios representam frontend, backend, QA e design. Cada pessoa possui:

- carga semanal;
- função;
- squad;
- habilidades;
- cor de identificação.

### Work items

Existem 22 itens fictícios, ADO-101 a ADO-122. Cada item contém projeto, Feature, PBI, título, tipo, estado, responsável, semana planejada, prazo, estimativa, habilidade e prioridade.

Os identificadores ADO-101 a ADO-122 pertencem ao protótipo. Uma integração real deve preservar o ID gerado pelo Azure DevOps separadamente.

## 7. Regras atuais

### Capacidade

```text
capacidade da semana =
carga semanal
− horas de feriado
− horas de ausência
```

### Carga

A carga de uma pessoa é a soma das horas dos itens não concluídos atribuídos a ela na semana.

### Ocupação

```text
ocupação (%) = carga planejada ÷ capacidade disponível × 100
```

### Alertas

`getAlerts()` cria alertas quando:

- a carga ultrapassa a capacidade;
- uma ausência reduz a capacidade de uma semana com atividades;
- uma atividade é movida para depois do prazo.

### Recomendações

`getSuggestions()` procura uma atividade na célula sobrecarregada e tenta:

1. encontrar outra pessoa com a habilidade necessária e horas livres na mesma semana;
2. priorizar alguém do mesmo squad quando houver alternativas;
3. se não houver pessoa disponível, mover a atividade para uma semana futura da mesma pessoa, desde que fique dentro do prazo.

A recomendação precisa continuar explicável: quem receberá a atividade, por que pode recebê-la, quantas horas possui e quanto será liberado da origem.

As regras são heurísticas de protótipo. Não devem ser apresentadas como inteligência artificial ou otimização matemática avançada.

## 8. Persistência atual

O banco possui a tabela `plan_changes`:

| Campo | Função |
| --- | --- |
| `task_id` | atividade modificada e chave primária |
| `person_id` | novo responsável |
| `week_index` | nova semana |
| `updated_at` | data da atualização |

Uma atividade possui apenas sua proposta atual. Uma nova mudança atualiza o registro anterior. Restaurar o planejamento apaga as propostas e volta aos dados originais.

O D1 também possui a tabela `employee_contacts`, com `person_id`, `email` e `updated_at`. Ela mantém o endereço de notificação de cada profissional. No cenário do hackathon, os sete profissionais usam `ac242883@alunos.unisanta.br`.

Depois que uma alteração é salva, a aplicação notifica por e-mail as pessoas cujas agendas mudaram. O conteúdo apresenta a transição realizada e a agenda final agrupada por semana. O envio usa o Resend no backend; chaves e remetente são configurados apenas por variáveis de ambiente.

A base local fica em `.wrangler/state` e é independente da base hospedada.

## 9. Arquitetura do código

```text
app/page.tsx
   ↓ carrega realocações do D1
features/dashboard/Dashboard.tsx
   ↓ coordena estado, navegação e ações
features/<tela>/
   ↓ apresenta os dados
lib/planning.ts
   ↓ calcula capacidade, alertas e sugestões
app/api/plan/route.ts
   ↓ valida e salva realocações
db/
   ↓ acessa o D1
```

Responsabilidades detalhadas estão em `docs/architecture.md`.

## 10. Telas

### Visão Geral

É a tela mais recente e já passou por uma revisão de experiência.

Objetivo: responder **“onde a equipe precisa de atenção nesta semana?”**

Ela contém:

- quatro indicadores gerais;
- mapa de ocupação da semana ativa;
- cores contínuas do verde ao vermelho conforme o percentual;
- percentual, horas planejadas e capacidade em cada pessoa;
- detalhe da pessoa escolhida;
- atividades que compõem a carga;
- ausência considerada no cálculo;
- recomendação, quando houver;
- alertas somente da semana exibida;
- gráfico simples de horas por projeto;
- acesso para o planejamento completo.

Ao clicar em **Revisar sugestão**, a aplicação abre o detalhe da atividade já preenchido com o destino recomendado. Antes de salvar, mostra o impacto estimado na origem e no destino. A gravação ocorre somente ao clicar em **Confirmar realocação**.

A tela usa a semana que coincide com a data atual em São Paulo. Fora do calendário fictício, mostra a semana mais próxima com o texto “período do cenário”.

### Timelines

Mostra os work items organizados por projeto e pelas quatro semanas. Ainda precisa ser revisada para melhorar hierarquia entre projeto, Feature, PBI e atividade, filtros e leitura de prazos.

### Planejamento

É a visão detalhada das quatro semanas. Permite abrir atividades, arrastar e soltar entre pessoas e períodos, ver capacidade por célula e restaurar o plano inicial.

Precisa evoluir para:

- tornar origem, destino e efeito da mudança mais claros;
- evitar movimentos inválidos;
- dar feedback seguro antes e depois da mudança;
- facilitar comparação entre pessoas, habilidades, prazos e semanas.

### Equipe

Mostra profissionais, funções, squads, habilidades, capacidade e ausências. Precisa ser revisada para apresentar apenas informações úteis para decisões de alocação.

## 11. Direção de interface

A linguagem visual existente usa:

- navegação lateral azul escura;
- fundo cinza muito claro;
- cartões brancos;
- verde azulado como ação principal;
- cores de projeto consistentes;
- tipografia compacta para dashboards.

Princípios:

- apresentar primeiro a informação que exige uma decisão;
- evitar repetição entre cartões, alertas e detalhes;
- usar cor junto com números e textos, nunca como único significado;
- deixar ações com verbos claros;
- mostrar estados vazio, carregando, erro e sucesso;
- manter navegação por teclado, foco visível e rótulos acessíveis;
- preservar leitura em notebook e celular;
- usar gráficos apenas quando facilitarem uma comparação real.

## 12. Histórico de decisões

- A primeira versão foi criada rapidamente com o modelo do Sites e já ficou publicada.
- A equipe esperava inicialmente HTML, CSS, JavaScript, Python e PostgreSQL.
- Após avaliar prazo, interatividade e código existente, decidiu-se manter React e TypeScript.
- A arquitetura foi refatorada: a antiga tela única foi dividida entre `features/`, `components/`, `data/`, `lib/` e `db/`.
- Exemplos e componentes de template sem uso foram removidos.
- A publicação foi mantida intacta enquanto a interface evolui localmente.
- A Visão Geral passou a focar uma semana. A visão das quatro semanas pertence ao Planejamento.
- Recomendações deixaram de ser aplicadas diretamente; agora passam por revisão de impacto.

## 13. Hospedagem e versões

A versão inicial continua publicada em:

`https://orquestra-iport-hack.enzocalvo11.chatgpt.site`

Ela corresponde à versão 1 e ao commit inicial `10f502f5f83c58c5d6d62888a7c27a02d7b6d680`.

As refatorações estruturais e de interface estão em desenvolvimento local e **ainda não foram publicadas**. Não publicar durante a fase atual.

O repositório também possui uma configuração separada para deploy direto no Cloudflare Workers: o modo `cloudflare` de `vite.config.ts`, `wrangler.cloudflare.jsonc` e `build/cloudflare-worker.ts`. Ela preserva o adaptador do Sites e usa o binding `DB` para um D1 remoto. O procedimento está documentado em `docs/cloudflare-deploy.md`; preparar essa configuração não significa que a versão local já foi publicada.

## 14. Próximas etapas recomendadas

Ordem sugerida:

1. validar a nova Visão Geral com o responsável pelo projeto;
2. corrigir clareza, conteúdo e aparência observados no uso real;
3. revisar Timelines;
4. revisar Planejamento;
5. revisar Equipe;
6. consolidar navegação, mensagens, acessibilidade e responsividade;
7. criar testes úteis para capacidade, feriado, ausência, sobrecarga, prazo e recomendação;
8. alinhar a fonte real do Azure DevOps com a interface e o motor de planejamento;
9. revisar segurança, dependências, arquivos gerados e documentação;
10. testar a hospedagem e realizar o deploy final.

Não começar várias telas ao mesmo tempo. Trabalhar em pequenas entregas revisáveis.

## 15. Critérios para o code review

Antes da entrega final, verificar:

- responsabilidades separadas;
- nomes claros;
- ausência de código duplicado;
- ausência de arquivos e dependências sem uso;
- ausência de segredos;
- validação das entradas do backend;
- regras centrais cobertas por testes úteis;
- mensagens de erro compreensíveis;
- README e arquitetura coerentes com o código;
- dados fictícios identificados;
- lint, TypeScript e build aprovados;
- fluxo principal demonstrável do início ao fim.

## 16. Comandos

Primeira instalação:

```bash
npm ci
npm run build
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0000_married_adam_warlock.sql --persist-to .wrangler/state
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0001_dizzy_medusa.sql --persist-to .wrangler/state
npm run dev
```

Uso diário:

```bash
npm run dev
```

Validação:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 17. Como iniciar uma nova sessão do Codex

Solicitação recomendada:

> Leia por completo o AGENTS.md, o README.md, docs/CODEX_CONTEXT.md e docs/architecture.md. Depois analise a estrutura atual do repositório e o estado do Git. Não altere arquivos ainda. Resuma: problema resolvido, fluxo principal, arquitetura, estado de cada tela, dados fictícios, limitações e verificações exigidas. Em seguida, aguarde a tarefa específica de interface.

