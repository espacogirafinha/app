# Checklist pre-publicacao V2 - Espaco Girafinha App

Projeto: `C:\Dev\Event-Manager-Pro`
Branch: `v2-clean-architecture`
Data: 2026-05-27

Este documento e a checklist operacional antes de publicar a V2 no GitHub/Vercel.

## Estado atual da V2

Confirmado no projeto:

- [ ] Festas no Espaco existem como modulo proprio V2.
  - Tabela principal: `venue_events`
  - Pagina: `/venue-events`
  - API: `/api/venue-events`

- [ ] Servicos Externos existem como modulo proprio V2.
  - Tabelas: `external_events` + `external_event_services`
  - Pagina: `/external-events`
  - API: `/api/external-events`

- [ ] Workshops/Formacoes existem como modulo proprio V2.
  - Tabelas: `workshops` + `workshop_participants`
  - Pagina: `/workshops`
  - API: `/api/workshops`

- [ ] Dashboard V2 existe e usa endpoint agregado.
  - API: `/api/dashboard-v2`
  - Frontend usa `useGetDashboardV2`

- [ ] Calendario V2 existe e usa endpoint agregado.
  - API: `/api/calendar-v2`
  - Frontend usa `useGetCalendarV2`

- [ ] Relatorios V2 existem e usam endpoint agregado.
  - API: `/api/reports-v2`
  - Frontend usa `useGetReportsV2`

- [ ] A tabela antiga `reservations` fica como legado/arquivo.
  - Nao deve alimentar Dashboard V2, Calendario V2 ou Relatorios V2.

## Migrations Supabase necessarias

Antes de deploy, confirmar manualmente que estas migrations V2 foram aplicadas no Supabase remoto correto.

### `202605211430_create_venue_events.sql`

Tabelas criadas:

- `venue_events`

Inclui:

- `create extension if not exists "pgcrypto";`
- constraints de `status`
- constraints de `payment_status`
- constraint de `image_authorization`
- indices:
  - `event_date`
  - `status`
  - `payment_status`
- RLS ativo: sim

Checklist:

- [ ] Confirmar SQL antes de aplicar.
- [ ] Aplicar no Supabase remoto correto.
- [ ] Confirmar que a tabela existe.
- [ ] Confirmar constraints.
- [ ] Confirmar indices.
- [ ] Confirmar RLS.

### `202605211530_create_external_events.sql`

Tabelas criadas:

- `external_events`
- `external_event_services`

Inclui:

- `create extension if not exists "pgcrypto";`
- FK `external_event_services.external_event_id -> external_events.id` com `on delete cascade`
- constraints de `status`
- constraints de `payment_status`
- constraints de `service_type`
- indices:
  - `external_events.event_date`
  - `external_events.status`
  - `external_events.payment_status`
  - `external_event_services.external_event_id`
  - `external_event_services.service_type`
  - `external_event_services.status`
- RLS ativo: sim, nas duas tabelas

Checklist:

- [ ] Confirmar SQL antes de aplicar.
- [ ] Aplicar no Supabase remoto correto.
- [ ] Confirmar que as duas tabelas existem.
- [ ] Confirmar FK cascade.
- [ ] Confirmar constraints.
- [ ] Confirmar indices.
- [ ] Confirmar RLS.

### `202605211630_create_workshops.sql`

Tabelas criadas:

- `workshops`
- `workshop_participants`

Inclui:

- `create extension if not exists "pgcrypto";`
- FK `workshop_participants.workshop_id -> workshops.id` com `on delete cascade`
- constraints de `status`
- constraints de `payment_status`
- constraints de `capacity >= 0`
- constraints de `price >= 0`
- constraints de `amount_paid >= 0`
- constraints de `amount_due >= 0`
- indices:
  - `workshops.date`
  - `workshops.status`
  - `workshop_participants.workshop_id`
  - `workshop_participants.status`
  - `workshop_participants.payment_status`
- RLS ativo: sim, nas duas tabelas

Checklist:

- [ ] Confirmar SQL antes de aplicar.
- [ ] Aplicar no Supabase remoto correto.
- [ ] Confirmar que as duas tabelas existem.
- [ ] Confirmar FK cascade.
- [ ] Confirmar constraints.
- [ ] Confirmar indices.
- [ ] Confirmar RLS.

### Outras migrations locais

Existem migrations antigas/legado:

- `202605180805_initial_reservations_schema.sql`
- `202605181430_app_users.sql`
- `202605181515_drop_legacy_auth.sql`
- `202605191200_reservation_form_fields.sql`
- `202605191230_image_authorization_text.sql`

Estas dizem respeito a base antiga/legado e autenticacao/formulario antigo. Confirmar estado remoto antes de publicar, mas a publicacao da V2 depende sobretudo das tres migrations V2 acima.

## RLS / Policies

Tabelas V2 com RLS ativo:

- `venue_events`
- `external_events`
- `external_event_services`
- `workshops`
- `workshop_participants`

Policies encontradas nas migrations V2:

- nenhuma policy criada nas migrations V2.

Risco:

- RLS ativo sem policies bloqueia acesso direto via Supabase Data API para roles normais.
- Se a app aceder aos dados exclusivamente pelo backend/API com `DATABASE_URL`, o impacto depende da role usada nessa ligacao Postgres.
- Se no futuro o frontend tentar ler/escrever diretamente estas tabelas com `supabase-js`, essas operacoes podem falhar sem policies.

Estado atual de acesso:

- Frontend usa Supabase Auth para login.
- Frontend chama API/backend com token Bearer.
- Backend valida o token Supabase.
- Backend usa `DATABASE_URL` para aceder a base de dados.
- Frontend nao deve usar `service_role`.

Recomendacao antes de publicar:

- [ ] Confirmar que todas as escritas/leitura dos modulos V2 passam pela API.
- [ ] Confirmar que nao ha leitura direta das tabelas V2 via Supabase client.
- [ ] Decidir se e necessario criar policies para utilizadores autenticados.
- [ ] Se forem criadas policies, fazer numa tarefa separada e com revisao propria.
- [ ] Nunca expor `service_role` no frontend ou Vercel client-side.

## Variaveis de ambiente necessarias

Nao colocar valores reais neste documento.

### Backend/API

Confirmadas no projeto:

- [ ] `DATABASE_URL`
  - usada por `lib/db/src/index.ts`
  - usada por `lib/db/drizzle.config.ts`

- [ ] `SUPABASE_URL`
  - usada por `artifacts/api-server/src/lib/auth.ts`
  - usada por `artifacts/girafinha/dev-api-plugin.ts` em local

- [ ] `SUPABASE_ANON_KEY`
  - usada por `artifacts/api-server/src/lib/auth.ts`
  - usada por `artifacts/girafinha/dev-api-plugin.ts` em local

Fallback observado:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` pode ser usado pelo auth backend como fallback para `SUPABASE_ANON_KEY`, mas a variavel recomendada para esta app e `SUPABASE_ANON_KEY`.

### Frontend/Vite

Confirmadas no projeto:

- [ ] `VITE_SUPABASE_URL`
  - usada por `artifacts/girafinha/src/lib/supabase.ts`

- [ ] `VITE_SUPABASE_ANON_KEY`
  - usada por `artifacts/girafinha/src/lib/supabase.ts`

### Supabase pooler opcional

Encontradas no codigo:

- [ ] `SUPABASE_DB_POOLER_HOST`
- [ ] `SUPABASE_DB_POOLER_PORT`

Estas parecem opcionais porque ha defaults no codigo. Confirmar se serao necessarias em Vercel/producao.

Checklist Vercel env:

- [ ] Confirmar variaveis em Production.
- [ ] Confirmar variaveis em Preview.
- [ ] Confirmar que `VITE_*` nao contem secrets privados.
- [ ] Confirmar que `DATABASE_URL` nao e exposta ao browser.
- [ ] Confirmar que nao ha `service_role` no frontend.

## GitHub / Branch / Push

Estado observado:

- Branch atual: `v2-clean-architecture`
- Working tree no inicio desta checklist: limpo
- Existe stash antigo: `stash@{0}: WIP servicos externos selecao multipla antes da v2`

Antes do push:

- [ ] Executar `git status`.
- [ ] Confirmar branch `v2-clean-architecture`.
- [ ] Confirmar working tree limpo.
- [ ] Confirmar commits locais com `git log --oneline --max-count=20`.
- [ ] Confirmar se o push sera para `v2-clean-architecture`.
- [ ] Decidir se sera aberto PR para `main`.
- [ ] Nao aplicar stash antigo sem revisao.

Ficheiros que nao podem entrar:

- [ ] `.env`
- [ ] `.env.local`
- [ ] `artifacts/girafinha/.env.local`
- [ ] `node_modules`
- [ ] `start-girafinha-local.bat`
- [ ] ficheiros temporarios
- [ ] chaves privadas
- [ ] tokens/secrets

Comandos sugeridos antes do push:

```bash
git status
git log --oneline --max-count=20
git diff --stat
```

Nao fazer push sem autorizacao explicita.

## Vercel

Antes de deploy:

- [ ] Confirmar projeto Vercel correto da app, nao o site/landing page.
- [ ] Confirmar que o site `espaco-girafinha-site` nao sera afetado.
- [ ] Confirmar branch de deploy.
- [ ] Confirmar se sera Preview Deploy ou Production Deploy.
- [ ] Confirmar variaveis de ambiente.
- [ ] Confirmar comando de build.
- [ ] Confirmar output/root do projeto, se configurado na Vercel.
- [ ] Confirmar dominio/subdominio pretendido.
- [ ] Confirmar que producao atual nao sera afetada sem decisao explicita.

Subdominio previsto:

- `reservas.espacogirafinha.pt`

Checklist de dominio:

- [ ] Confirmar DNS.
- [ ] Confirmar dominio ligado ao projeto Vercel correto.
- [ ] Confirmar SSL ativo.
- [ ] Confirmar redirecionamentos, se existirem.

Nao fazer deploy sem autorizacao explicita.

## Build e validacao local

Scripts encontrados:

Raiz:

```bash
corepack pnpm run typecheck
corepack pnpm run build
```

Frontend Girafinha:

```bash
corepack pnpm --filter @workspace/girafinha run dev
corepack pnpm --filter @workspace/girafinha run typecheck
corepack pnpm --filter @workspace/girafinha run build
corepack pnpm --filter @workspace/girafinha run serve
```

API server:

```bash
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run start
```

Comandos recomendados antes de publicar:

- [ ] `corepack pnpm run typecheck`
- [ ] se o global ficar pesado/OOM, usar:
  - [ ] `corepack pnpm --filter @workspace/api-server run typecheck`
  - [ ] `corepack pnpm --filter @workspace/girafinha run typecheck`
- [ ] `corepack pnpm run build`
- [ ] se necessario, build por workspace:
  - [ ] `corepack pnpm --filter @workspace/api-server run build`
  - [ ] `corepack pnpm --filter @workspace/girafinha run build`

Teste local:

```bash
corepack pnpm --filter @workspace/girafinha run dev
```

URL esperada:

- `http://localhost:5173/`

## Testes manuais obrigatorios antes de deploy

### Login

- [ ] Abrir app local.
- [ ] Fazer login com utilizador autorizado.
- [ ] Fazer logout.
- [ ] Confirmar que sem login nao ha acesso.

### Festas no Espaco

- [ ] Criar festa.
- [ ] Editar festa.
- [ ] Apagar festa.
- [ ] Confirmar pagamento sem sinal.
- [ ] Confirmar pagamento parcial.
- [ ] Confirmar totalmente pago.
- [ ] Abrir detalhes.
- [ ] Testar WhatsApp.
- [ ] Confirmar campos principais:
  - cliente;
  - telefone;
  - data;
  - horario;
  - pack;
  - aniversariante;
  - idade;
  - tema;
  - autorizacao de imagem;
  - valor total;
  - valor pago.

### Servicos Externos

- [ ] Criar evento com 1 servico.
- [ ] Criar evento com varios servicos.
- [ ] Editar evento.
- [ ] Adicionar servico em edicao.
- [ ] Remover servico em edicao.
- [ ] Alterar preco de servico.
- [ ] Confirmar subtotal automatico.
- [ ] Confirmar total manual.
- [ ] Confirmar pagamento parcial.
- [ ] Confirmar totalmente pago.
- [ ] Abrir detalhes.
- [ ] Testar WhatsApp.
- [ ] Apagar evento.

### Workshops/Formacoes

- [ ] Criar workshop.
- [ ] Editar workshop.
- [ ] Apagar workshop.
- [ ] Adicionar participante.
- [ ] Editar participante.
- [ ] Registar pagamento parcial.
- [ ] Registar pagamento total.
- [ ] Cancelar participante.
- [ ] Confirmar que participante cancelado nao conta para vagas.
- [ ] Tentar ultrapassar limite de vagas.
- [ ] Confirmar erro claro de capacidade.
- [ ] Testar WhatsApp por participante.

### Dashboard

- [ ] Confirmar cards principais.
- [ ] Confirmar valores recebidos.
- [ ] Confirmar valores por receber.
- [ ] Confirmar resumo por area.
- [ ] Confirmar agenda operacional.
- [ ] Confirmar que workshops cancelados nao contam participantes ativos.

### Calendario

- [ ] Confirmar festas no espaco.
- [ ] Confirmar servicos externos.
- [ ] Confirmar workshops.
- [ ] Confirmar que festas ocupam espaco.
- [ ] Confirmar que servicos externos nao ocupam espaco.
- [ ] Confirmar que workshops ocupam espaco quando location for Espaco Girafinha.
- [ ] Confirmar estados dos dias:
  - livre;
  - com eventos;
  - quase cheio;
  - lotado.

### Relatorios

- [ ] Testar filtro do mes atual.
- [ ] Testar intervalo personalizado.
- [ ] Confirmar receita total.
- [ ] Confirmar recebido.
- [ ] Confirmar por receber.
- [ ] Confirmar numero de eventos.
- [ ] Confirmar ticket medio.
- [ ] Confirmar packs mais vendidos.
- [ ] Confirmar servicos mais vendidos.
- [ ] Confirmar combinacoes de servicos.
- [ ] Confirmar workshops e participantes.
- [ ] Confirmar que por receber e somado por item.
- [ ] Confirmar exportacao CSV.

### Mobile

- [ ] Confirmar menu/bottom navigation.
- [ ] Confirmar cards do Dashboard.
- [ ] Confirmar cards de listas.
- [ ] Confirmar modais de criacao/edicao.
- [ ] Confirmar painel de participantes.
- [ ] Confirmar botoes acessiveis.
- [ ] Confirmar que conteudo nao fica tapado.

## Pontos pendentes antes de publicar

### P0 - bloqueia publicacao

- [ ] Confirmar/aplicar migrations V2 no Supabase remoto.
- [ ] Confirmar variaveis obrigatorias em Vercel.
- [ ] Confirmar build local.

### P1 - importante antes de publicar

- [ ] Decidir estrategia de RLS/policies.
- [ ] Confirmar que a app usa API/backend para modulos V2 e nao acesso direto as tabelas.
- [ ] Validar manualmente Dashboard, Calendario e Relatorios com dados reais/teste.
- [ ] Confirmar que textos com acentos aparecem corretamente no browser.
- [ ] Confirmar que nao ha TODOs/placeholders visiveis nas paginas finais.

### P2 - recomendado, mas nao necessariamente bloqueante

- [ ] Criar helpers partilhados para calculos repetidos nos agregados.
- [ ] Otimizar queries dos agregados se houver muitos dados.
- [ ] Melhorar testes automatizados de API.
- [ ] Documentar comportamento de preco de workshop quando ja existem participantes.
- [ ] Rever se servicos individuais cancelados devem entrar nos relatorios.

### P3 - limpeza futura

- [ ] Remover ficheiros temporarios/legado nao usados, como `business-area-page.tsx`, se confirmado que nao tem rota ativa.
- [ ] Documentar `/reservations` como legado/arquivo.
- [ ] Uniformizar labels de moeda e idioma.
- [ ] Consolidar componentes de badges/cards/status.

## Plano recomendado para publicacao

Ordem segura:

1. [ ] Confirmar migrations localmente.
2. [ ] Rever SQL das migrations V2.
3. [ ] Aplicar migrations no Supabase remoto, apenas com confirmacao explicita.
4. [ ] Validar RLS/policies.
5. [ ] Confirmar variaveis Vercel.
6. [ ] Executar typecheck local.
7. [ ] Executar build local.
8. [ ] Testar app local com dados reais/teste.
9. [ ] Confirmar Git limpo.
10. [ ] Fazer push para branch `v2-clean-architecture`, apenas com autorizacao explicita.
11. [ ] Abrir PR ou gerar preview deploy.
12. [ ] Testar preview deploy.
13. [ ] Validar login e operacoes principais no preview.
14. [ ] Confirmar dominio/subdominio.
15. [ ] So depois promover para producao.

## Confirmacoes desta checklist

- Nao foi feito deploy.
- Nao foi feito push.
- Nao foi feito merge.
- Nao foram criadas migrations.
- Nao foi aplicado nada no Supabase.
- Nao foram alteradas variaveis de ambiente.
- Nao houve alteracao de codigo funcional.
- Nao foi feito commit automaticamente.

