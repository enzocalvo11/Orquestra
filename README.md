# Orquestra

**Planejamento de capacidade e realocação de atividades entre projetos.**

**Aplicação online:** [Acessar a Orquestra](https://orquestra-iport.importatlas-orquestra.workers.dev/)

Desenvolvida pelo time **Import Atlas** para o **Hackathon iPORT**, a Orquestra responde ao desafio:

> Como ajudar um gestor a tomar uma decisão de alocação antes de virar um problema?

Quando um profissional atua em vários projetos, planejamentos separados dificultam enxergar sua carga total. A Orquestra reúne atividades do Azure DevOps, identifica sobrecargas e conflitos de prazo e permite avaliar uma realocação antes de confirmá-la.

## A solução

A aplicação conecta a visão dos projetos à disponibilidade das pessoas. O gestor consegue entender a causa de um conflito, analisar sugestões justificadas e comparar o impacto de um novo responsável ou período.

| Tela | Principais recursos |
| --- | --- |
| **Visão geral** | Indicadores, mapa de ocupação semanal, atividades por profissional, alertas e sugestões de realocação. |
| **Timelines** | Tarefas, bugs e testes organizados por projeto e semana, com responsável, estimativa e acesso aos detalhes. |
| **Planejamento** | Quadros de pessoas e projetos por semana, realocação por formulário ou arrastar e soltar e prévia das alterações antes do salvamento. |

O diferencial está em **avaliar a carga da pessoa considerando todos os projetos**. Mesmo ao filtrar um projeto, a capacidade continua refletindo o conjunto de atividades do profissional.

## Da análise à decisão

1. **Identificar:** consultar o mapa de ocupação e localizar sobrecargas, ausências ou atividades planejadas após o prazo.
2. **Entender:** abrir o detalhe do profissional ou da atividade para ver quais tarefas compõem a carga.
3. **Revisar:** analisar a sugestão e sua justificativa; visualizar o destino no planejamento sem aplicar a troca automaticamente.
4. **Simular:** alterar responsável ou semana e conferir as horas previstas na origem e no destino. No Planejamento, as mudanças ficam pendentes até o gestor salvar ou cancelar.
5. **Confirmar:** salvar o novo cenário e, com o serviço de e-mail configurado, notificar os profissionais afetados com o resumo da agenda atualizada.

A aplicação bloqueia realocações para profissionais sem a habilidade exigida e avisa quando a mudança ultrapassa a capacidade ou o prazo. **A decisão final permanece com o gestor.**

## Regras de planejamento

Os cálculos ficam em [`lib/planning.ts`](lib/planning.ts), separados da interface:

```text
Capacidade disponível = horas semanais − horas de feriado − horas de ausência
Carga planejada       = soma das horas das atividades não concluídas na semana
Ocupação (%)          = carga planejada ÷ capacidade disponível × 100
```

As sugestões buscam aliviar a sobrecarga com profissionais que tenham a habilidade necessária e horas disponíveis, dando preferência ao mesmo squad. Quando não há destino adequado para a atividade na mesma semana, consideram um período posterior para a própria pessoa, dentro do prazo.

**O mecanismo atual usa regras determinísticas, sem IA.** As recomendações explicam a disponibilidade do destino e as horas liberadas na origem; ainda não consideram dependências entre atividades nem otimização global.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, TypeScript e Next.js |
| Build e execução | Vinext, Vite e Cloudflare Workers |
| Estilos e ícones | CSS, Tailwind CSS e Lucide React |
| Persistência | Cloudflare D1 (SQLite) e Drizzle ORM |
| Integração | Azure DevOps REST API |
| Notificações | Resend |

## Integração e dados atuais

| Informação | Fonte e comportamento |
| --- | --- |
| **Atividades** | Tasks, Bugs e Tests do projeto Azure DevOps configurado, consultados ao abrir a aplicação, ao atualizar a fonte e após trocas de responsável. |
| **Projetos exibidos** | Agrupamentos derivados de `System.AreaPath` dentro do projeto Azure configurado. |
| **Equipe e calendário** | Sete profissionais fictícios, habilidades, squads, capacidade, ausências e quatro semanas de demonstração: **05/10/2026 a 01/11/2026**, incluindo o feriado de 12/10. |
| **Planejamento e contatos** | Propostas atuais em `plan_changes` e destinatários de e-mail em `employee_contacts`, no D1. |

- **Responsável:** a integração atualiza a tag `responsavel:<id-interno>` em `System.Tags`, como `responsavel:ana`, preservando outras tags. O campo nativo `System.AssignedTo` não é alterado.
- **Período:** a mudança de semana fica no D1 e não modifica `System.IterationPath`. O botão **Restaurar plano inicial** remove as propostas locais; não reverte tags já atualizadas no Azure.
- **Metadados:** campos e tags do Azure são complementados por dados locais quando necessário. Features e PBIs exibidos ainda não representam uma consulta dinâmica da hierarquia do Azure.

A integração não possui sincronização contínua. Sem acesso ao Azure, a aplicação informa a falha e não substitui a lista por atividades fictícias. As gravações no Azure e no D1 são operações separadas; se houver falha parcial, atualize a fonte e revise o cenário antes de tentar novamente.

Após o salvamento, o Resend envia um e-mail por profissional afetado. Uma falha no envio gera um aviso e mantém o plano salvo. Os contatos da demonstração devem ser substituídos antes de uso real.

## Executar localmente

**Pré-requisitos:** Node.js **22.13 ou superior**, npm e acesso a um projeto Azure DevOps com PAT autorizado a ler e atualizar Work Items. O projeto utiliza o binding D1 `DB`; o Resend é opcional.

### 1. Clonar e instalar

```bash
git clone https://github.com/enzocalvo11/Orquestra.git
cd Orquestra
npm ci
```

### 2. Configurar o ambiente

Copie `.dev.vars.example` para `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
```

No PowerShell, use `Copy-Item .dev.vars.example .dev.vars`. Preencha o arquivo com as configurações do servidor:

```env
AZURE_DEVOPS_ORGANIZATION=ImportAtlas
AZURE_DEVOPS_PROJECT=Orquestra2
AZURE_DEVOPS_PAT=SEU_PAT
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Para habilitar e-mails, preencha as duas variáveis do Resend e configure um remetente verificado e os contatos em `employee_contacts`. Sem essa configuração, o planejamento pode ser salvo e a interface informa que a notificação não foi enviada.

O arquivo `.dev.vars` é ignorado pelo Git. Mantenha PAT e chaves apenas no servidor ou Worker, fora do código cliente.

### 3. Preparar o banco e iniciar

Na primeira instalação, gere o build e aplique as migrações na base local:

```bash
npm run build
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0000_married_adam_warlock.sql --persist-to .wrangler/state
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0001_dizzy_medusa.sql --persist-to .wrangler/state
npm run dev
```

Abra a URL indicada pelo terminal, normalmente `http://localhost:5173`. Nos próximos acessos, basta `npm run dev`. As migrações devem ser aplicadas uma única vez nesse banco; a base em `.wrangler/state` é independente da base hospedada.

Para verificar alterações no projeto:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Organização do projeto

| Local | Responsabilidade |
| --- | --- |
| [`app/`](app/) | Entrada da aplicação e rotas HTTP do backend. |
| [`features/`](features/) | Telas, detalhe das atividades e coordenação do dashboard. |
| [`components/`](components/) | Componentes compartilhados de interface. |
| [`data/demo-data.ts`](data/demo-data.ts) | Equipe, calendário e metadados de demonstração. |
| [`lib/planning.ts`](lib/planning.ts) | Capacidade, alertas e sugestões. |
| [`lib/azure-devops.ts`](lib/azure-devops.ts) | Consulta e atualização de Work Items. |
| [`lib/planning-notifications.ts`](lib/planning-notifications.ts) e [`lib/email.ts`](lib/email.ts) | Conteúdo, destinatários e envio dos e-mails. |
| [`db/`](db/) e [`drizzle/`](drizzle/) | Conexão, schema e migrações do D1. |

<details>
<summary><strong>Endpoints da API</strong></summary>

| Método e rota | Função |
| --- | --- |
| `GET /api/source` | Consultar e mapear os Work Items do Azure DevOps. |
| `POST /api/azure-devops/assign` | Atualizar e verificar a tag de responsável. |
| `GET /api/plan` | Consultar propostas salvas. |
| `POST /api/plan` | Salvar uma realocação individual validada. |
| `PUT /api/plan` | Salvar o conjunto de propostas do planejamento. |
| `DELETE /api/plan` | Remover propostas locais e restaurar o período da fonte. |

</details>

## Próximos passos

- **Edição de Work Items:** ampliar a edição de campos das atividades diretamente pela aplicação.
- **Calendário real:** substituir o período fixo por datas, feriados e ausências atualizáveis.
- **Histórico de alterações:** registrar decisões e versões do planejamento para consulta e comparação.
- **IA de apoio:** evoluir as recomendações e apoiar a análise do gestor, mantendo a revisão humana.

## Participantes

- Antonio Coelho
- Enzo Calvo
- Arthur Contato
- Marcelo Watanabe
