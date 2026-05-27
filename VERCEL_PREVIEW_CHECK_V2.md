# Verificacao read-only Vercel - Preview V2

Projeto local: `C:\Dev\Event-Manager-Pro`
Branch local: `v2-clean-architecture`
Data: 2026-05-27

Esta verificacao foi feita em modo read-only. Nao houve deploy, push, merge, alteracao de variaveis, alteracao de dominio, alteracao de codigo ou commit.

## Resumo executivo

Projeto Vercel identificado:

- Nome: `app`
- Project ID: `prj_iTPDDaIx9bPQAmkuImroPElgiWdF`
- Team/Owner: `espacogirafinhas-projects`
- Team ID: `team_WZ5gdqEiYED01vBVt4KO1GaA`
- Root Directory: `.`
- Framework Preset: `Other`
- Node.js: `24.x`

Este e o projeto da app de reservas, nao o projeto do site/landing page.

Resultado geral:

- Projeto correto: sim.
- Dominio `reservas.espacogirafinha.pt`: configurado no projeto.
- Production env: tem as variaveis obrigatorias encontradas.
- Preview env: esta incompleto.
- Build local: ja passou anteriormente.
- Preview deploy V2: nao recomendado ainda, ate corrigir env de Preview e confirmar build command.

## Projeto Vercel verificado

Fonte local:

- `.vercel/project.json`

Conteudo relevante:

- `projectName`: `app`
- `projectId`: `prj_iTPDDaIx9bPQAmkuImroPElgiWdF`
- `orgId`: `team_WZ5gdqEiYED01vBVt4KO1GaA`

Fonte Vercel:

- Projeto encontrado: `espacogirafinhas-projects/app`
- Latest deployment: `READY`
- Latest target: `production`
- Repositorio associado nos deployments: `espacogirafinha/app`
- Branch nos deployments atuais: `main`

Distincao importante:

- Projeto da app: `app`
- Projeto do site/landing page: nao foi alterado nem usado nesta verificacao.

## Build settings

### Configuracao remota observada no Vercel

Via inspeccao do projeto:

- Framework Preset: `Other`
- Root Directory: `.`
- Node.js Version: `24.x`
- Install Command: `corepack pnpm install --frozen-lockfile`
- Build Command remoto: `corepack pnpm --filter @workspace/girafinha build`
- Output Directory: `artifacts/girafinha/dist/public`

### Configuracao local em `vercel.json`

Ficheiro local:

- `vercel.json`

Conteudo relevante:

- Install Command: `corepack pnpm install --frozen-lockfile`
- Build Command local: `corepack pnpm --filter @workspace/api-server build && corepack pnpm --filter @workspace/girafinha build`
- Output Directory: `artifacts/girafinha/dist/public`
- Rewrite SPA:
  - `source`: `/((?!api/.*).*)`
  - `destination`: `/index.html`

### Risco encontrado

Ha uma diferenca importante:

- Vercel remoto mostra build command apenas para o frontend:
  - `corepack pnpm --filter @workspace/girafinha build`
- `vercel.json` local inclui tambem o build da API:
  - `corepack pnpm --filter @workspace/api-server build && corepack pnpm --filter @workspace/girafinha build`

As rotas em `api/*.mjs` importam:

- `artifacts/api-server/dist/app.mjs`

Mas `artifacts/api-server/dist` esta ignorado pelo Git e nao e versionado. Portanto, se a Vercel usar apenas o build remoto do frontend e nao respeitar o `buildCommand` do `vercel.json`, as rotas API podem falhar por falta de `dist/app.mjs`.

Recomendacao antes do preview:

- Confirmar no dashboard Vercel se o Project Build Command esta a sobrescrever o `vercel.json`.
- Garantir que o build command efetivo inclui:
  - `corepack pnpm --filter @workspace/api-server build`
  - `corepack pnpm --filter @workspace/girafinha build`
- Nao fazer preview deploy ate resolver/confirmar isto.

## Deployments

Deployments recentes encontrados:

- Existem deployments de Production para o projeto `app`.
- O deployment mais recente esta `READY`.
- Os deployments listados usam branch `main`.
- Nao foi criado novo deployment nesta verificacao.

Observacao:

- Esta branch local e `v2-clean-architecture`.
- Antes de preview, confirmar se a branch sera enviada e usada como Preview Deployment, sem afetar Production.

## Variaveis de ambiente

Valores nao foram lidos nem expostos. Apenas nomes e ambientes foram verificados.

### Variaveis obrigatorias pelo codigo

Backend/API:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Frontend/Vite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Fallback observado no backend:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` pode ser usado como fallback para `SUPABASE_ANON_KEY`, mas a variavel recomendada para esta app e `SUPABASE_ANON_KEY`.

### Production

Variaveis obrigatorias encontradas em Production:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Outras variaveis encontradas em Production:

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Nota de seguranca:

- Existem chaves sensiveis de Supabase em Production, incluindo service/secret keys.
- O codigo local auditado nao referencia `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` ou `SUPABASE_JWT_SECRET`.
- Confirmar no dashboard que nenhuma secret key esta exposta ao frontend por engano.
- Variaveis com prefixo `NEXT_PUBLIC_`/`VITE_` sao publicas no bundle frontend e nao devem conter secrets privadas.

### Preview

Variaveis encontradas em Preview:

- `DATABASE_URL`

Variaveis obrigatorias em falta no Preview:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Impacto:

- O frontend pode falhar no build/runtime porque `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` sao obrigatorias em `artifacts/girafinha/src/lib/supabase.ts`.
- A API pode falhar autenticacao porque `SUPABASE_URL` e `SUPABASE_ANON_KEY` sao obrigatorias em `artifacts/api-server/src/lib/auth.ts`.

Classificacao:

- Bloqueador para Preview Deploy funcional.

## Compatibilidade com a app

Confirmado no codigo:

- `lib/db/src/index.ts` usa `DATABASE_URL`.
- `artifacts/api-server/src/lib/auth.ts` usa `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
- `artifacts/girafinha/src/lib/supabase.ts` usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- `artifacts/girafinha/dev-api-plugin.ts` usa `SUPABASE_URL`/`SUPABASE_ANON_KEY` em local, com fallback para `VITE_*`.

Service role no frontend:

- Nao foram encontradas referencias no codigo a `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET` ou `service_role`.
- O frontend usa apenas Supabase Auth com anon/publishable key.

## Dominio/subdominio

Dominios encontrados no projeto Vercel:

- `reservas.espacogirafinha.pt`
- `app-seven-orpin-85.vercel.app`
- `app-espacogirafinhas-projects.vercel.app`
- `app-git-main-espacogirafinhas-projects.vercel.app`

Estado:

- `reservas.espacogirafinha.pt` esta associado ao projeto `app`.

Nao foi alterado DNS nem dominio.

## Riscos antes do Preview Deploy

### Bloqueadores

1. Preview env incompleto.
   - Falta `SUPABASE_URL`.
   - Falta `SUPABASE_ANON_KEY`.
   - Falta `VITE_SUPABASE_URL`.
   - Falta `VITE_SUPABASE_ANON_KEY`.

2. Build command remoto pode nao construir API.
   - Vercel remoto mostra build command apenas do frontend.
   - API routes importam `artifacts/api-server/dist/app.mjs`.
   - `dist` nao e versionado.

### Riscos importantes

1. Deployments atuais sao de `main`.
   - A V2 esta localmente em `v2-clean-architecture`.
   - Confirmar fluxo de Preview antes de push/deploy.

2. Production tem varias secrets Supabase adicionais.
   - Nao parecem usadas pelo codigo local.
   - Confirmar que nao sao expostas ao frontend.

3. RLS/policies ja foi identificado como decisao separada.
   - As tabelas V2 existem e tem RLS ativo.
   - Sem policies nas tabelas V2.
   - Como a app usa backend/API para dados V2, isto pode ser aceitavel para preview.

## Recomendacao antes do Preview Deploy

Antes de criar preview:

1. Adicionar/confirmar em Preview:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Confirmar build command efetivo no Vercel:
   - recomendado:
     - `corepack pnpm --filter @workspace/api-server build && corepack pnpm --filter @workspace/girafinha build`

3. Confirmar que Output Directory continua:
   - `artifacts/girafinha/dist/public`

4. Confirmar que `api/[...path].mjs` encontra:
   - `artifacts/api-server/dist/app.mjs`

5. Fazer push da branch apenas quando autorizado.

6. Gerar Preview Deploy apenas quando autorizado.

7. Testar preview:
   - login;
   - Festas no Espaco;
   - Servicos Externos;
   - Workshops;
   - Dashboard;
   - Calendario;
   - Relatorios;
   - API `/api/dashboard-v2`;
   - API `/api/calendar-v2`;
   - API `/api/reports-v2`.

## Proximos passos sugeridos

1. Corrigir configuracao de Preview env no Vercel, com autorizacao explicita.
2. Confirmar/ajustar build command do projeto Vercel, com autorizacao explicita.
3. Reexecutar esta verificacao read-only.
4. So depois avancar para push/preview deploy.

## Confirmacoes

- Nao houve deploy.
- Nao houve push.
- Nao houve merge.
- Nao foram alteradas variaveis de ambiente.
- Nao foi alterada configuracao Vercel.
- Nao foi alterado DNS/dominio.
- Nao houve alteracao de codigo funcional.
- Nao foi feito commit automaticamente.

