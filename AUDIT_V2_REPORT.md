# Auditoria V2 - App Espaco Girafinha

Data: 2026-05-26
Branch auditada: `v2-clean-architecture`
Projeto: `C:\Dev\Event-Manager-Pro`

## Resumo executivo

A V2 esta bem encaminhada e ja tem a separacao estrutural principal do negocio:

- Festas no Espaco: `venue_events`
- Servicos Externos: `external_events` + `external_event_services`
- Workshops/Formacoes: `workshops` + `workshop_participants`

Dashboard, Calendario e Relatorios V2 ja usam endpoints agregados proprios e nao dependem da tabela antiga `reservations`. A pagina `/reservations` continua como legado/arquivo, o que esta alinhado com a estrategia definida.

Nao foram encontrados problemas de typecheck nos workspaces auditados. Foram encontrados alguns pontos importantes antes de futura publicacao: migrations V2 ainda precisam de estar aplicadas no Supabase remoto, RLS esta ativo sem policies nas novas tabelas, existe texto temporario visivel na area de Festas no Espaco e ha alguns calculos agregados que devem ser alinhados para evitar divergencias entre Dashboard e Relatorios.

## Comandos executados

- `git status --short --branch`
- `git log --oneline --max-count=30`
- `git diff --stat`
- `git stash list`
- `git branch -vv`
- `git log --oneline main..HEAD`
- `git check-ignore -v .env .env.local artifacts\girafinha\.env.local start-girafinha-local.bat node_modules`
- `git ls-files`
- pesquisas com `rg`
- leitura de ficheiros de migrations, backend, frontend e schemas
- `corepack pnpm --filter @workspace/api-server run typecheck`
- `corepack pnpm --filter @workspace/girafinha run typecheck`

Resultado:

- `api-server` typecheck: passou
- `girafinha` typecheck: passou

Nao foi executado typecheck global para evitar risco desnecessario de OOM, conforme indicado.

## 1. Estado Git e seguranca

### Branch atual

Branch atual confirmada:

- `v2-clean-architecture`

### Working tree

Antes da criacao deste relatorio, o working tree estava limpo.

Depois deste relatorio, o unico ficheiro esperado como pendente e:

- `AUDIT_V2_REPORT.md`

### Commits locais relevantes

Existem commits locais da V2 ainda nao enviados para remoto, incluindo:

- `035f81c` - Ligar relatorios ao agregado V2
- `3a2f2cd` - Criar endpoint agregado dos relatorios V2
- `4a8980f` - Ligar calendario ao agregado V2
- `1a53fa7` - Criar endpoint agregado do calendario V2
- `015e39f` - Ligar dashboard ao agregado V2
- `fc4bf5d` - Criar endpoint agregado do dashboard V2
- `15edb73` - Adicionar instrucoes permanentes do projeto
- `51b1247` - Planear dashboard calendario e relatorios V2
- `9b5594c` - Estabilizar modulo de workshops V2
- `eab9ec9` - Implementar gestao de participantes dos workshops V2
- `3df7dbd` - Implementar pagina e formulario de workshops V2
- `6284887` - Criar API de workshops e participantes V2
- `8e1b187` - Criar schema de workshops V2
- `3ba2214` - Implementar pagina e formulario de servicos externos V2
- `26e0423` - Criar API de servicos externos V2
- `3f9e583` - Criar schema de servicos externos V2
- `71f36f8` - Implementar modulo de festas no espaco
- `970d38c` - Criar estrutura limpa da V2 por areas
- `0dcbbdf` - Criar blueprint da V2 limpa

Nao foi feito push.

### Stash

Existe stash pendente:

- `stash@{0}: On v2-clean-architecture: WIP servicos externos selecao multipla antes da v2`

Recomendacao: manter sem aplicar, salvo decisao explicita. Pode conter trabalho antigo pre-V2 e deve ser tratado com cuidado para nao reintroduzir arquitetura confusa.

### Ficheiros sensiveis/local-only

Foram verificados:

- `.env`
- `.env.local`
- `artifacts/girafinha/.env.local`
- `node_modules`
- `start-girafinha-local.bat`

Estado:

- `.env`, `.env.local` e `artifacts/girafinha/.env.local` estao ignorados por `.gitignore`
- `node_modules` esta ignorado por `.gitignore`
- `start-girafinha-local.bat` esta ignorado por `.git/info/exclude`
- `git ls-files` mostrou apenas `.env.example` como ficheiro env versionado, o que e aceitavel

Risco atual de ficheiros sensiveis em commit: baixo.

## 2. Arquitetura V2

### Separacao por areas

A V2 esta separada corretamente em tres areas principais:

- Festas no Espaco: `venue_events`
- Servicos Externos: `external_events` + `external_event_services`
- Workshops/Formacoes: `workshops` + `workshop_participants`

### Tabela antiga `reservations`

A tabela antiga `reservations` continua a existir como legado/arquivo.

Confirmado:

- Dashboard V2 usa `GET /api/dashboard-v2`
- Calendario V2 usa `GET /api/calendar-v2`
- Relatorios V2 usa `GET /api/reports-v2`
- Os endpoints V2 agregados nao usam `reservations`
- A pagina `/reservations` continua como pagina legada
- O menu principal aponta para as paginas reais da V2

Observacao: existe ainda um componente/pagina temporaria `business-area-page.tsx` com leitura de `reservations`, mas nao aparece como rota principal ativa em `App.tsx`. Pode ser removido numa limpeza futura.

## 3. Migrations e Supabase

### Migrations V2 auditadas

Migrations locais relevantes:

- `supabase/migrations/202605211430_create_venue_events.sql`
- `supabase/migrations/202605211530_create_external_events.sql`
- `supabase/migrations/202605211630_create_workshops.sql`

### Venue events

Tabela:

- `venue_events`

Verificado:

- inclui `create extension if not exists "pgcrypto";`
- usa `gen_random_uuid()`
- tem constraints para `status`, `payment_status` e `image_authorization`
- tem indices por `event_date`, `status` e `payment_status`
- tem RLS ativo

### External events

Tabelas:

- `external_events`
- `external_event_services`

Verificado:

- inclui `create extension if not exists "pgcrypto";`
- `external_event_services` tem FK com `on delete cascade`
- tem constraints para `status`, `payment_status`, `service_type` e status de servico
- tem indices por data/status/pagamento e por evento/tipo/status de servico
- tem RLS ativo nas duas tabelas

### Workshops

Tabelas:

- `workshops`
- `workshop_participants`

Verificado:

- inclui `create extension if not exists "pgcrypto";`
- `workshop_participants` tem FK com `on delete cascade`
- tem constraints para status, payment status, capacidade, preco e valores >= 0
- tem indices por data/status e por workshop/status/pagamento
- tem RLS ativo nas duas tabelas

### RLS e policies

As novas tabelas V2 ativam RLS, mas nao criam policies.

Isto pode ser correto se toda a app aceder aos dados atraves do backend com ligacao direta a Postgres usando uma role que contorna RLS. No entanto, se algum acesso direto via Supabase Data API ou cliente frontend for usado no futuro, as operacoes podem ficar bloqueadas.

Recomendacao antes de deploy:

- confirmar o modelo real de acesso;
- se o acesso for apenas via backend, documentar isso;
- se houver acesso direto via Supabase, criar policies explicitas para utilizadores autenticados/autorizados;
- nunca usar `service_role` no frontend.

### Migrations que precisam estar aplicadas antes de deploy

Antes de publicar a V2, devem estar aplicadas no Supabase remoto:

- `202605211430_create_venue_events.sql`
- `202605211530_create_external_events.sql`
- `202605211630_create_workshops.sql`

Nao foi aplicada nenhuma migration nesta auditoria.

## 4. API/backend

### Autenticacao

O backend aplica `requireAuth` a `/api`, exceto health.

O middleware:

- espera `Authorization: Bearer <access_token>`
- valida o token contra Supabase Auth usando `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- devolve 401 se faltar token ou se for invalido

Risco:

- neste momento, qualquer utilizador autenticado no projeto Supabase pode potencialmente usar a API, salvo se houver controlo adicional noutro ponto.

Recomendacao:

- antes de publicacao, confirmar se sera necessario allow-list por email, role interna ou claims de admin.

### Endpoints auditados

Endpoints V2:

- `/api/venue-events`
- `/api/external-events`
- `/api/workshops`
- `/api/dashboard-v2`
- `/api/calendar-v2`
- `/api/reports-v2`

### Venue events

Estado:

- CRUD implementado
- schemas Zod/OpenAPI usados
- `paymentStatus` calculado pelo backend com base em `totalPrice` e `amountPaid`
- delete disponivel

Observacao:

- checklist propria de festas ainda nao esta integrada.

### External events

Estado:

- CRUD implementado
- POST cria evento + servicos numa transacao
- PATCH atualiza evento e substitui lista completa de servicos quando `services` e enviado
- DELETE remove evento e servicos por cascade
- `paymentStatus` calculado no backend

Bom sinal:

- transacao protege contra gravacao parcial de evento/servicos.

Ponto a rever:

- estatisticas agregadas podem incluir servicos com status `cancelled`, se o evento pai estiver ativo. Se a operacao real usar cancelamento de servicos individuais, as agregacoes devem filtrar esses servicos.

### Workshops e participantes

Estado:

- CRUD de workshops implementado
- endpoints de participantes implementados
- GET de workshops devolve agregados
- capacidade validada ao adicionar participante ativo
- participantes cancelados nao contam para vagas ocupadas
- `paymentStatus` e `amountDue` calculados no backend com base no preco do workshop e valor pago

Ponto a rever:

- se o preco do workshop for alterado depois de existirem participantes, os `amountDue` guardados nos participantes podem ficar desatualizados ate cada participante ser editado.

### Dashboard V2

Estado:

- usa apenas tabelas V2
- exclui cancelados por regra geral
- nao usa `reservations`

Ponto a rever:

- `activeParticipantsCount` pode incluir participantes ativos de workshops cancelados, dependendo da agregacao. Recomenda-se alinhar para contar apenas participantes de workshops ativos.

### Calendar V2

Estado:

- usa apenas tabelas V2
- festas ocupam espaco
- servicos externos aparecem como operacionais e nao ocupam espaco
- workshops ocupam espaco quando `location` corresponde a Espaco Girafinha
- exclui cancelados por defeito
- suporta `startDate` e `endDate`

Ponto UX:

- dias apenas com servicos externos podem aparecer como quase cheios, apesar de nao ocuparem o espaco. Pode ser util, mas deve ficar visualmente claro para nao parecer falta de disponibilidade do espaco.

### Reports V2

Estado:

- usa apenas tabelas V2
- exclui eventos cancelados
- exclui participantes cancelados
- workshops somam pagamentos dos participantes, nao o preco isolado do workshop

Ponto a corrigir:

- em festas e servicos externos, o valor por receber e calculado como `receita - recebido` agregado. Isto permite que overpayments de um evento reduzam o pendente de outro. O ideal e somar por linha `max(totalPrice - amountPaid, 0)`.

### Duplicacao de logica

Existe logica repetida entre:

- `dashboard-v2.ts`
- `calendar-v2.ts`
- `reports-v2.ts`

Exemplos:

- calculo de pendente
- filtros de cancelados
- normalizacao de dinheiro
- status de pagamento
- agregacao por area

Recomendacao:

- criar helpers partilhados de dominio antes de expandir relatorios e metricas.

## 5. Frontend

### Paginas V2 auditadas

- `artifacts/girafinha/src/pages/dashboard.tsx`
- `artifacts/girafinha/src/pages/venue-events.tsx`
- `artifacts/girafinha/src/pages/external-events.tsx`
- `artifacts/girafinha/src/pages/workshops.tsx`
- `artifacts/girafinha/src/pages/calendar.tsx`
- `artifacts/girafinha/src/pages/reports.tsx`
- `artifacts/girafinha/src/components/layout.tsx`
- `artifacts/girafinha/src/pages/reservations.tsx`

### Dependencias dos modulos corretos

Confirmado:

- Dashboard usa `useGetDashboardV2`
- Calendario usa `useGetCalendarV2`
- Relatorios usa `useGetReportsV2`
- Festas no Espaco usa `useListVenueEvents`
- Servicos Externos usa `useListExternalEvents`
- Workshops usa `useListWorkshops`
- `/reservations` continua a usar a API antiga, como legado

### Navegacao

O menu principal aponta para:

- Dashboard
- Festas no Espaco
- Servicos Externos
- Workshops/Formacoes
- Calendario
- Relatorios
- Definicoes

Nao aponta para `/reservations` como area principal.

### Mobile-first

O padrao geral de cards e modais e aceitavel para mobile:

- cards por modulo;
- modais em secoes;
- botoes claros;
- listas sem depender apenas de tabelas apertadas.

Recomendacao:

- fazer um teste manual real em viewport mobile antes de publicacao, especialmente em modais de servicos externos e participantes.

### Textos temporarios e encoding

Foram encontrados pontos a rever:

- `venue-events.tsx` contem texto visivel: `TODO V2: checklist propria de festas`
- `business-area-page.tsx` contem texto temporario sobre vista simples baseada em reservas, embora aparentemente nao esteja no fluxo principal
- varias strings aparecem como mojibake em leitura de ficheiros, por exemplo formas como `EspaÃ§o`, `ServiÃ§os`, `RelatÃ³rios` ou simbolos de euro quebrados

Recomendacao:

- verificar visualmente no browser;
- se o mojibake aparecer na UI, corrigir encoding/textos antes de publicacao.

### Estados vazios e erros

As paginas principais tem estados vazios e mensagens de loading/erro. Em geral estao compreensiveis.

Melhoria recomendada:

- uniformizar estilo das mensagens de erro;
- garantir que erros de API mostram causa clara quando for acao de guardar/editar.

## 6. Funcionalidade por modulo

### Festas no Espaco

Estado observado no codigo:

- criar festa: implementado
- editar festa: implementado
- apagar festa: implementado
- detalhes: implementado
- pagamento: `totalPrice`, `amountPaid`, `paymentStatus`
- estados: `draft`, `confirmed`, `completed`, `cancelled`
- WhatsApp: existe acao basica
- formulario proprio: implementado
- packs e precos base: implementados
- autorizacao de imagem: `rosto_visivel`, `rosto_tapado`, `nao_autorizo`

Pontos pendentes:

- checklist propria da V2 ainda nao integrada
- texto `TODO V2` visivel deve ser removido ou substituido por mensagem final

### Servicos Externos

Estado observado no codigo:

- criar evento com um servico: implementado
- criar evento com varios servicos: implementado
- editar/adicionar/remover servicos: implementado
- total automatico pela soma dos servicos: implementado
- total manual: suportado com indicacao de ajuste e opcao de recalculo
- pagamento: implementado
- badges de servicos: implementados
- WhatsApp: acao basica implementada
- apagar: implementado com confirmacao

Pontos a testar manualmente:

- remover servico em edicao e guardar;
- alterar preco individual e confirmar total/listagem/detalhes;
- criar evento com total manual diferente do subtotal;
- confirmar se servicos cancelados devem ou nao entrar em relatorios.

### Workshops/Formacoes

Estado observado no codigo:

- criar workshop: implementado
- editar workshop: implementado
- apagar workshop: implementado
- adicionar participante: implementado
- editar participante: implementado
- pagamento parcial/total: implementado
- cancelar participante: implementado
- participante cancelado nao deve contar para vagas
- erro ao ultrapassar capacidade tratado no frontend
- WhatsApp por participante: implementado

Pontos a testar manualmente:

- alterar preco de workshop com participantes existentes;
- confirmar se participantes existentes devem recalcular pendente automaticamente ou manter historico;
- validar UX em mobile no painel de participantes.

## 7. Dashboard, Calendario e Relatorios

### Dashboard

Estado:

- ligado ao endpoint V2
- nao depende de `reservations`
- mostra resumo geral e por area
- mostra agenda operacional

Ponto a rever:

- alinhar contagem de participantes ativos para excluir workshops cancelados.

### Calendario

Estado:

- ligado ao endpoint V2
- mostra festas, servicos externos e workshops
- distingue `occupiesSpace`
- servicos externos nao ocupam espaco
- workshops ocupam espaco conforme `location`

Ponto a rever:

- garantir que a legenda deixa claro que servicos externos sao operacionais e nao bloqueiam a disponibilidade do espaco.

### Relatorios

Estado:

- ligado ao endpoint V2
- nao depende de `reservations`
- exportacao CSV usa dados agregados V2
- filtros por periodo usam o endpoint V2

Ponto a corrigir:

- alinhar calculo de por receber com Dashboard, somando pendentes por item em vez de `receita - recebido` agregado.

### Coerencia entre Dashboard e Relatorios

Ha uma diferenca natural de escopo:

- Dashboard tende a mostrar estado operacional atual/proximos eventos;
- Relatorios usam periodo filtrado.

Antes de comparar valores diretamente, e preciso garantir que os periodos comparados sao iguais.

## 8. Performance e manutencao

### Queries e agregacoes

Os endpoints agregados fazem leituras amplas e calculam em memoria. Para o volume inicial do Espaco Girafinha, isto deve ser aceitavel.

Risco futuro:

- com muito historico, Dashboard/Calendario/Relatorios podem ficar mais lentos.

Recomendacao:

- aplicar filtros de data/status no SQL sempre que possivel;
- criar helpers partilhados para calculos de dinheiro, pendentes e status;
- considerar endpoints mais especificos se os dados crescerem.

### Duplicacao

Ha duplicacao entre agregados:

- normalizacao de numeros;
- exclusao de cancelados;
- calculos de recebido/pendente;
- agrupamentos por area;
- labels e statuses.

Recomendacao:

- criar uma camada pequena de servicos/helpers no backend, por exemplo `domain-metrics.ts`.

### Codegen

Foi referido anteriormente um export duplicado em `lib/api-zod/src/index.ts`.

Recomendacao:

- confirmar se o problema ficou resolvido de forma estavel;
- se o codegen voltar a gerar duplicados, corrigir a fonte do gerador ou documentar passo de correcao.

### Typecheck

Typecheck dos workspaces auditados passou:

- API server: passou
- Girafinha frontend: passou

O typecheck global nao foi executado nesta auditoria.

## 9. Preparacao para publicacao futura

Checklist antes de push/deploy:

- aplicar migrations V2 no Supabase remoto;
- confirmar se RLS precisa de policies;
- confirmar variaveis Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `DATABASE_URL`
  - variaveis frontend `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- executar typecheck dos workspaces;
- executar build local;
- testar login;
- testar criar/editar/apagar Festa no Espaco;
- testar criar/editar/apagar Servico Externo com varios servicos;
- testar criar/editar/apagar Workshop;
- testar adicionar/editar/cancelar participante;
- testar limite de capacidade;
- testar pagamentos parciais e totais;
- testar Dashboard V2;
- testar Calendario V2;
- testar Relatorios V2 e CSV;
- confirmar que `/reservations` fica legado;
- confirmar que menu principal nao depende de `/reservations`;
- confirmar que nao ha `.env`, `.env.local`, `node_modules` ou ficheiros locais no Git;
- confirmar que textos com acentos aparecem corretamente;
- confirmar que nao ha TODOs visiveis na UI final.

## 10. Classificacao de problemas

### P0 - bloqueia uso/publicacao

Nenhum P0 confirmado por typecheck local.

Nota: a publicacao ficara bloqueada se as migrations V2 ainda nao estiverem aplicadas no Supabase remoto, porque os endpoints dependem das novas tabelas.

### P1 - importante corrigir antes de publicar

1. Migrations V2 precisam estar aplicadas no Supabase remoto antes de deploy.
2. RLS esta ativo nas novas tabelas sem policies. Confirmar modelo de acesso antes de publicar.
3. Possivel mojibake/encoding em textos de UI. Verificar visualmente e corrigir se aparecer no browser.
4. Texto visivel `TODO V2: checklist propria de festas` em Festas no Espaco.
5. Relatorios calculam pendente de festas/servicos por agregacao `receita - recebido`; deve ser soma por item de `max(total - pago, 0)`.
6. Dashboard pode contar participantes ativos de workshops cancelados.

### P2 - melhoria recomendada

1. Criar helpers partilhados para calculos de dinheiro, pendentes, status e exclusao de cancelados.
2. Filtrar mais no SQL nos endpoints agregados para reduzir leituras completas.
3. Clarificar visualmente dias com servicos externos no Calendario para nao parecerem ocupacao do espaco.
4. Definir comportamento quando o preco de um workshop muda depois de existirem participantes.
5. Decidir se servicos individuais cancelados entram ou nao em relatorios de Servicos Externos.
6. Reforcar autorizacao interna para API, se mais utilizadores Supabase puderem existir.
7. Melhorar CSV dos Relatorios se for necessario export detalhado por evento.

### P3 - limpeza futura

1. Remover `business-area-page.tsx` se ja nao for usado.
2. Manter `/reservations` como legado, mas documentar claramente.
3. Uniformizar labels de moeda e idioma (`EUR`, `€`, acentos).
4. Consolidar componentes de cards, badges, estados e pagamento.
5. Criar testes automatizados basicos para endpoints V2.

## 11. Checklist de testes manuais

### Login e base

- entrar na app local;
- confirmar que o menu mostra as areas V2;
- confirmar que `/reservations` nao e o centro da navegacao.

### Festas no Espaco

- criar festa com Pack Simples;
- editar data/hora;
- alterar valor total e sinal;
- testar autorizacao de imagem;
- abrir detalhes;
- apagar festa;
- testar WhatsApp.

### Servicos Externos

- criar evento com um servico;
- criar evento com varios servicos;
- editar evento e remover um servico;
- alterar preco de um servico;
- confirmar que subtotal e total final ficam corretos;
- testar total manual diferente do subtotal;
- abrir detalhes;
- apagar evento;
- testar WhatsApp.

### Workshops/Formacoes

- criar workshop;
- editar workshop;
- adicionar participante sem pagamento;
- adicionar participante com pagamento parcial;
- adicionar participante totalmente pago;
- editar participante;
- cancelar participante;
- confirmar libertacao de vaga;
- tentar ultrapassar capacidade;
- testar WhatsApp;
- apagar workshop.

### Dashboard, Calendario e Relatorios

- confirmar Dashboard com dados das tres areas;
- confirmar Calendario com festa, servico externo e workshop;
- confirmar que servico externo nao ocupa espaco;
- confirmar que workshop no Espaco Girafinha ocupa espaco;
- confirmar que cancelados nao entram em receita ativa;
- confirmar Relatorios com filtro do mes atual;
- exportar CSV e validar valores.

### Mobile

- testar menu/bottom navigation;
- testar modais de festa, servico externo e workshop;
- testar painel de participantes;
- confirmar que botoes nao ficam tapados;
- confirmar que cards continuam legiveis.

## Proximos passos recomendados

1. Corrigir P1 de calculos agregados:
   - pendente por item em Relatorios;
   - participantes de workshops cancelados no Dashboard.
2. Remover texto `TODO V2` visivel em Festas no Espaco.
3. Fazer revisao visual de encoding no browser.
4. Decidir modelo RLS/policies antes de aplicar Supabase remoto.
5. Aplicar migrations V2 no Supabase remoto apenas com confirmacao explicita.
6. Executar build local e testes manuais completos.
7. So depois preparar push/deploy controlado.

## Confirmacoes da auditoria

- Nao houve deploy.
- Nao houve push.
- Nao houve merge.
- Nao houve commit.
- Nao foram criadas migrations.
- Nao foi aplicada nenhuma alteracao no Supabase.
- Nao foi recuperado nem aplicado stash antigo.
- Nao houve alteracao de codigo funcional.

