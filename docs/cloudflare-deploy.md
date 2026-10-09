# Deploy direto no Cloudflare Workers

Este guia publica a Orquestra no plano gratuito do Cloudflare Workers, com D1 e um endereço `workers.dev`. Os comandos devem ser executados na pasta que contém `package.json`.

## O que a configuração separa

- `vite.config.ts` mantém o perfil padrão do Sites e seleciona o perfil Cloudflare somente com `--mode cloudflare`.
- `wrangler.cloudflare.jsonc` identifica o Worker, o D1 e os nomes dos segredos obrigatórios.
- `build/cloudflare-worker.ts` é a entrada do Worker sem o adaptador de conectores do Sites.

## 1. Criar a conta gratuita

Crie ou acesse uma conta no Cloudflare e mantenha o plano **Workers Free**. Não é necessário comprar domínio nem ativar Workers Paid. O primeiro endereço será gratuito, no formato `workers.dev`.

## 2. Preparar os valores locais

Confira `.dev.vars` sem compartilhar seu conteúdo. Ele deve conter valores preenchidos para:

```env
AZURE_DEVOPS_ORGANIZATION=
AZURE_DEVOPS_PROJECT=
AZURE_DEVOPS_PAT=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

O arquivo já está ignorado pelo Git. O deploy envia esses valores pela conexão autenticada do Wrangler e os armazena como segredos do Worker. Não adicione valores reais em `.dev.vars.example` ou `wrangler.cloudflare.jsonc`.

## 3. Validar o projeto

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Esses comandos validam o projeto antes de criar recursos externos.

## 4. Entrar no Cloudflare

```bash
npx wrangler login
```

O navegador abrirá a página oficial de autorização. Conclua o login e volte ao terminal.

## 5. Confirmar o vínculo do D1

O D1 deste projeto já foi criado na conta Cloudflare usada no hackathon. Abra `wrangler.cloudflare.jsonc` e confirme que existe somente um objeto com `"binding": "DB"` e que ele contém `database_id`. Não execute novamente `wrangler d1 create` na mesma conta, pois isso criaria outro banco e poderia duplicar o binding.

Somente se o projeto for transferido para outra conta Cloudflare, crie um banco novo sem atualizar o arquivo automaticamente:

```bash
npx wrangler d1 create orquestra-iport-db
```

Depois copie o novo ID mostrado pelo Wrangler e substitua apenas o valor de `database_id` no objeto `DB` existente. Não adicione um segundo objeto. O ID identifica o recurso, mas não é uma senha e pode permanecer versionado.

## 6. Criar as tabelas remotas

```bash
npm run db:migrate:cloudflare
```

Confirme a aplicação das migrations quando o Wrangler perguntar. Esse comando atua no banco remoto; não use `--local` nesta etapa.

## 7. Publicar

```bash
npm run deploy:cloudflare
```

O script:

1. gera um build Vinext no modo separado `cloudflare`;
2. usa o manifesto gerado em `dist/server/wrangler.json`;
3. envia as entradas de `.dev.vars` como segredos;
4. publica no endereço gratuito `workers.dev`.

Guarde a URL exibida no final. O comando não ativa um plano pago.

## 8. Testar o fluxo publicado

Abra a URL e confira, nesta ordem:

1. a Visão Geral carrega projetos e Work Items do Azure DevOps;
2. uma atividade pode ser revisada e realocada;
3. a mudança permanece após atualizar a página, confirmando o D1;
4. a tag de responsável é atualizada no Azure DevOps;
5. o aviso de e-mail informa sucesso ou uma limitação real do Resend.

Se `GET /api/source` falhar, revise os três valores `AZURE_DEVOPS_*`. Se a leitura ou gravação do planejamento falhar, confira o binding `DB` e as migrations. Se somente o e-mail falhar, confira `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e as restrições do remetente no Resend.

## Deploys posteriores

Sem alteração no schema:

```bash
npm run deploy:cloudflare
```

Com uma migration nova:

```bash
npm run db:migrate:cloudflare
npm run deploy:cloudflare
```

Para adicionar um domínio próprio no futuro, use **Workers & Pages > orquestra-iport > Settings > Domains & Routes**. O domínio é opcional; o endereço `workers.dev` continua gratuito.
