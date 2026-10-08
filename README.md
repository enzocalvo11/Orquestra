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

## Desenvolvimento local

Este projeto preserva o adaptador de execução do Sites com Vinext e Cloudflare D1. Use uma versão do Node.js compatível com `package.json` e siga a configuração local de D1 do ambiente antes de executar `npm run dev`. Os comandos de build e publicação pertencem ao fluxo do Sites; por enquanto, as mudanças deste branch são locais.
