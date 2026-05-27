# Verificacao read-only Supabase remoto - V2

Projeto local: `C:\Dev\Event-Manager-Pro`
Branch: `v2-clean-architecture`
Data: 2026-05-27

Projeto Supabase verificado:

- Nome: `Espaco Girafinha Reservas`
- Ref/project id: `xxtyrjarnnmihrkseteo`
- Organizacao: `ppbczuvzxrycaxtqqqyh`
- Estado: `ACTIVE_HEALTHY`
- Regiao: `eu-north-1`
- Postgres: `17`

Esta verificacao foi feita em modo read-only. Nao foram aplicadas migrations, nao foram criadas policies, nao foi alterado RLS e nao foram alterados dados.

## Resumo executivo

As cinco tabelas V2 necessarias existem no Supabase remoto:

- `venue_events`
- `external_events`
- `external_event_services`
- `workshops`
- `workshop_participants`

As estruturas principais coincidem com as migrations locais V2:

- primary keys presentes;
- foreign keys com `on delete cascade` presentes onde aplicavel;
- constraints principais presentes;
- indices principais presentes;
- RLS ativo nas cinco tabelas V2.

Ponto principal antes de publicar:

- As tabelas V2 tem RLS ativo, mas nao tem policies. Isto pode estar correto se todo o acesso for via backend/API com `DATABASE_URL`, mas bloqueia acesso direto via Supabase Data API para roles normais. Antes do deploy, e necessario confirmar o modelo de acesso e decidir se serao criadas policies numa tarefa separada.

Classificacao:

- Estrutura V2: OK para avancar.
- Migrations V2: parecem aplicadas.
- RLS/policies: precisa de confirmacao manual antes de publicacao.

## Tabelas encontradas

| Tabela | Encontrada | RLS | Linhas atuais |
| --- | --- | --- | --- |
| `venue_events` | Sim | Ativo | 0 |
| `external_events` | Sim | Ativo | 0 |
| `external_event_services` | Sim | Ativo | 0 |
| `workshops` | Sim | Ativo | 0 |
| `workshop_participants` | Sim | Ativo | 0 |

## Tabelas em falta

Nenhuma tabela V2 em falta.

## Estrutura por tabela

### `venue_events`

Estado:

- Tabela existe.
- Primary key existe em `id`.
- RLS ativo.
- Policies encontradas: nenhuma.

Colunas principais confirmadas:

- `id`
- `customer_name`
- `phone`
- `email`
- `nif`
- `event_date`
- `start_time`
- `end_time`
- `status`
- `payment_status`
- `source`
- `pack_name`
- `birthday_child_name`
- `birthday_child_age`
- `children_count`
- `children_ages`
- `party_theme`
- `decoration_notes`
- `catering_notes`
- `allergies`
- `image_authorization`
- `terms_accepted`
- `total_price`
- `amount_paid`
- `payment_method`
- `notes`
- `created_at`
- `updated_at`

Constraints principais confirmadas:

- `venue_events_pkey`
- `venue_events_status_check`
- `venue_events_payment_status_check`
- `venue_events_image_authorization_check`

Indices confirmados:

- `venue_events_pkey`
- `venue_events_event_date_idx`
- `venue_events_status_idx`
- `venue_events_payment_status_idx`

Comparacao com migration local:

- Migration `202605211430_create_venue_events.sql` parece aplicada.

### `external_events`

Estado:

- Tabela existe.
- Primary key existe em `id`.
- RLS ativo.
- Policies encontradas: nenhuma.

Colunas principais confirmadas:

- `id`
- `customer_name`
- `phone`
- `email`
- `nif`
- `event_date`
- `start_time`
- `end_time`
- `status`
- `payment_status`
- `source`
- `event_location`
- `guest_count`
- `event_type`
- `event_theme`
- `setup_notes`
- `teardown_notes`
- `access_notes`
- `total_price`
- `amount_paid`
- `payment_method`
- `notes`
- `created_at`
- `updated_at`

Constraints principais confirmadas:

- `external_events_pkey`
- `external_events_status_check`
- `external_events_payment_status_check`

Indices confirmados:

- `external_events_pkey`
- `external_events_event_date_idx`
- `external_events_status_idx`
- `external_events_payment_status_idx`

Comparacao com migration local:

- Parte `external_events` da migration `202605211530_create_external_events.sql` parece aplicada.

### `external_event_services`

Estado:

- Tabela existe.
- Primary key existe em `id`.
- Foreign key existe para `external_events`.
- `on delete cascade` confirmado.
- RLS ativo.
- Policies encontradas: nenhuma.

Colunas principais confirmadas:

- `id`
- `external_event_id`
- `service_type`
- `service_label`
- `price`
- `status`
- `notes`
- `sort_order`
- `created_at`
- `updated_at`

Constraints principais confirmadas:

- `external_event_services_pkey`
- `external_event_services_external_event_id_fkey`
- `external_event_services_service_type_check`
- `external_event_services_status_check`

Foreign key:

- `external_event_services.external_event_id -> external_events.id`
- `on delete cascade`

Indices confirmados:

- `external_event_services_pkey`
- `external_event_services_external_event_id_idx`
- `external_event_services_service_type_idx`
- `external_event_services_status_idx`

Comparacao com migration local:

- Parte `external_event_services` da migration `202605211530_create_external_events.sql` parece aplicada.

### `workshops`

Estado:

- Tabela existe.
- Primary key existe em `id`.
- RLS ativo.
- Policies encontradas: nenhuma.

Colunas principais confirmadas:

- `id`
- `name`
- `description`
- `date`
- `start_time`
- `end_time`
- `capacity`
- `price`
- `kit_included`
- `status`
- `location`
- `notes`
- `created_at`
- `updated_at`

Constraints principais confirmadas:

- `workshops_pkey`
- `workshops_status_check`
- `workshops_capacity_check`
- `workshops_price_check`

Indices confirmados:

- `workshops_pkey`
- `workshops_date_idx`
- `workshops_status_idx`

Comparacao com migration local:

- Parte `workshops` da migration `202605211630_create_workshops.sql` parece aplicada.

### `workshop_participants`

Estado:

- Tabela existe.
- Primary key existe em `id`.
- Foreign key existe para `workshops`.
- `on delete cascade` confirmado.
- RLS ativo.
- Policies encontradas: nenhuma.

Colunas principais confirmadas:

- `id`
- `workshop_id`
- `name`
- `phone`
- `email`
- `nif`
- `amount_paid`
- `amount_due`
- `payment_method`
- `payment_status`
- `status`
- `notes`
- `created_at`
- `updated_at`

Constraints principais confirmadas:

- `workshop_participants_pkey`
- `workshop_participants_workshop_id_fkey`
- `workshop_participants_payment_status_check`
- `workshop_participants_status_check`
- `workshop_participants_amount_paid_check`
- `workshop_participants_amount_due_check`

Foreign key:

- `workshop_participants.workshop_id -> workshops.id`
- `on delete cascade`

Indices confirmados:

- `workshop_participants_pkey`
- `workshop_participants_workshop_id_idx`
- `workshop_participants_status_idx`
- `workshop_participants_payment_status_idx`

Comparacao com migration local:

- Parte `workshop_participants` da migration `202605211630_create_workshops.sql` parece aplicada.

## Policies

Consulta read-only a `pg_policies` para as tabelas V2 devolveu zero policies:

- `venue_events`: nenhuma policy
- `external_events`: nenhuma policy
- `external_event_services`: nenhuma policy
- `workshops`: nenhuma policy
- `workshop_participants`: nenhuma policy

Interpretacao:

- Como RLS esta ativo, acesso direto via Supabase Data API com roles normais podera ficar bloqueado sem policies.
- Como a app V2 foi desenhada para usar backend/API, isto pode ser aceitavel se o backend usar `DATABASE_URL` e a aplicacao nunca escrever diretamente nestas tabelas pelo frontend.
- A decisao sobre policies deve ser feita antes de publicacao, mas numa tarefa separada.

## Migrations locais comparadas

### `202605211430_create_venue_events.sql`

Estado remoto:

- Parece aplicada.

Evidencias:

- tabela `venue_events` existe;
- colunas esperadas existem;
- constraints esperadas existem;
- indices esperados existem;
- RLS ativo.

### `202605211530_create_external_events.sql`

Estado remoto:

- Parece aplicada.

Evidencias:

- tabelas `external_events` e `external_event_services` existem;
- colunas esperadas existem;
- FK com cascade existe;
- constraints esperadas existem;
- indices esperados existem;
- RLS ativo.

### `202605211630_create_workshops.sql`

Estado remoto:

- Parece aplicada.

Evidencias:

- tabelas `workshops` e `workshop_participants` existem;
- colunas esperadas existem;
- FK com cascade existe;
- constraints esperadas existem;
- indices esperados existem;
- RLS ativo.

## Observacao sobre tabelas antigas

O Supabase retornou tambem um advisory indicando RLS desativado em:

- `public.reservations`
- `public.tasks`

Estas tabelas pertencem ao legado/arquivo, nao aos modulos V2 principais. Mesmo assim, antes de publicacao, convem decidir se devem continuar acessiveis, ser protegidas por RLS/policies ou ficar fora do fluxo principal.

Nao foi feita qualquer alteracao nestas tabelas.

## Risco de publicacao

Classificacao atual:

- Estrutura de base de dados V2: OK.
- Migrations V2: parecem aplicadas.
- RLS nas tabelas V2: ativo.
- Policies nas tabelas V2: ausentes.
- Publicacao: precisa de confirmacao manual sobre RLS/policies antes de avancar.

Resultado:

- Nao parece bloqueado por falta de tabelas/migrations V2.
- Pode ficar bloqueado se a app depender de acesso direto via Supabase client as tabelas V2.
- Se a app usar exclusivamente API/backend para os dados V2, a estrutura remota parece pronta para testes de preview.

## Recomendacao antes de deploy

Antes de publicar:

1. Confirmar que o frontend V2 nao faz CRUD direto nas tabelas V2 via Supabase client.
2. Confirmar que os endpoints V2 usam `DATABASE_URL` corretamente em Vercel.
3. Confirmar variaveis Vercel:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Decidir formalmente se as tabelas V2 precisam de policies.
5. Se forem necessarias policies, criar numa tarefa separada, com SQL revisto antes de aplicar.
6. Fazer teste de preview antes de producao.

## Proximos passos

1. Rever este relatorio.
2. Confirmar estrategia RLS/policies.
3. Confirmar variaveis Vercel.
4. Fazer push da branch apenas quando autorizado.
5. Criar preview deploy apenas quando autorizado.
6. Testar login e CRUD dos tres modulos no preview.
7. So depois decidir publicacao em producao.

## Confirmacoes

- Nao foram aplicadas migrations.
- Nao foram criadas migrations.
- Nao foram alterados dados.
- Nao foram criadas policies.
- Nao foi alterado RLS.
- Nao houve deploy.
- Nao houve push.
- Nao houve merge.
- Nao houve commit.
- Nao foram alteradas variaveis de ambiente.

