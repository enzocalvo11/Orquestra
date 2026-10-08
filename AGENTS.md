# Instruções para trabalhar na Orquestra

Antes de alterar o projeto, leia nesta ordem:

1. `README.md`
2. `docs/CODEX_CONTEXT.md`
3. `docs/architecture.md`
4. Os arquivos diretamente envolvidos na tarefa

## Objetivo do trabalho

A Orquestra é um protótipo do Hackathon Iport para apoiar gestores de equipes de tecnologia que trabalham em vários projetos. O fluxo central é:

**identificar conflito → entender a causa → analisar uma recomendação → revisar o impacto → realocar a atividade → confirmar o novo cenário**

Qualquer mudança de interface deve tornar esse fluxo mais claro, reduzir informações repetidas e manter as decisões explicáveis.

## Prioridades

- Código limpo, organizado e compreensível para a equipe explicar em um code review.
- Interface simples, profissional, responsiva e acessível.
- Regras de negócio fora dos componentes visuais sempre que possível.
- Componentes com uma responsabilidade clara e nomes em inglês consistentes com o projeto.
- Textos apresentados ao usuário em português do Brasil.
- Dados fictícios e limitações do protótipo identificados com transparência.

## Limites atuais

- A integração com Azure DevOps está sendo preparada por outros integrantes. Não implemente ou modifique essa integração sem uma tarefa explícita.
- O projeto atual usa React e TypeScript no frontend e backend, Cloudflare D1 e Drizzle. Não introduza Python ou PostgreSQL sem uma decisão explícita da equipe.
- Não publique nem faça deploy. A publicação fica para a etapa final.
- Não coloque tokens, credenciais ou segredos no código, em arquivos versionados ou no navegador.
- Preserve o adaptador de Sites, Vinext e Cloudflare necessário para build e futura hospedagem.
- Não edite conteúdo gerado em `node_modules/`, `.next/`, `dist/` ou `.wrangler/`.

## Organização do código

- `features/<área>/`: telas e comportamento específico de cada área.
- `components/`: elementos compartilhados.
- `data/demo-data.ts`: cenário fictício.
- `lib/planning.ts`: capacidade, carga, alertas e recomendações.
- `app/api/`: endpoints do backend.
- `db/`: conexão e schema do D1.

Evite voltar a concentrar toda a aplicação em um único arquivo. Se uma tela crescer muito, extraia componentes internos com propósito evidente. Não crie abstrações genéricas sem uso real.

## Processo para cada alteração

1. Inspecione o comportamento atual e identifique os arquivos afetados.
2. Explique brevemente ao usuário o que será modificado.
3. Implemente a mudança completa.
4. Verifique estados normal, vazio, erro e carregamento quando forem relevantes.
5. Execute:

   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

6. Teste manualmente o fluxo alterado quando houver servidor local disponível.
7. Informe o que mudou, como foi verificado e qualquer limitação real.

## Comunicação

O responsável pelo projeto está aprendendo desenvolvimento. Explique decisões com linguagem simples e objetiva, sem omitir detalhes necessários para ele entender e apresentar a solução. Ao sugerir algo novo, relacione a sugestão ao problema do usuário ou ao fluxo principal.

