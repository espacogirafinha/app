# Phase 3 Plan - Servicos Externos V2

## 1. Objetivo da Fase 3

A Fase 3 deve transformar "Servicos Externos" num modulo proprio da V2, separado da tabela legada `reservations`.

O problema principal a resolver e que um evento externo nao e apenas uma reserva com um unico tipo de servico. Na pratica, um mesmo evento pode incluir varios servicos:

- Decoracao + Catering
- Decoracao + Catering + Aluguer de insuflavel
- Catering + Animacao
- Organizacao de evento + Baloes + Brunch

A arquitetura recomendada para a V2 e:

- `external_events`: evento externo principal
- `external_event_services`: servicos incluidos dentro desse evento

A tabela antiga `reservations` deve continuar a existir como legado/backup. A pagina antiga de reservas nao deve ser apagada nesta fase.

## 2. Modelo de dados recomendado

## Tabela `external_events`

Representa o evento externo principal.

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `customer_name text not null`
- `phone text not null`
- `email text`
- `nif text`
- `event_date date not null`
- `start_time text not null`
- `end_time text`
- `status text not null default 'draft'`
- `payment_status text not null default 'unpaid'`
- `source text`
- `event_location text`
- `guest_count integer default 0`
- `event_type text`
- `event_theme text`
- `setup_notes text`
- `teardown_notes text`
- `access_notes text`
- `total_price numeric(10,2) not null default 0`
- `amount_paid numeric(10,2) not null default 0`
- `payment_method text`
- `notes text`
- `created_at timestamp with time zone default now()`
- `updated_at timestamp with time zone default now()`

Estados sugeridos para `external_events.status`:

- `draft`
- `confirmed`
- `completed`
- `cancelled`

Estados sugeridos para `external_events.payment_status`:

- `unpaid`
- `partial`
- `paid`

## Tabela `external_event_services`

Representa cada servico incluido num evento externo.

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `external_event_id uuid not null references external_events(id) on delete cascade`
- `service_type text not null`
- `service_label text not null`
- `price numeric(10,2) default 0`
- `status text not null default 'planned'`
- `notes text`
- `sort_order integer default 0`
- `created_at timestamp with time zone default now()`
- `updated_at timestamp with time zone default now()`

Tipos de servico sugeridos para `service_type`:

- `decoracao`
- `catering`
- `organizacao_evento`
- `animacao`
- `insuflavel`
- `baloes`
- `outro`

Labels visuais:

- Decoracao
- Catering / Brunch
- Organizacao de evento
- Animacao
- Aluguer de insuflavel
- Baloes
- Outro

Estados sugeridos para `external_event_services.status`:

- `planned`
- `in_progress`
- `completed`
- `cancelled`

## Decisao recomendada

Usar tabela relacionada e nao array/JSON como modelo principal.

Motivo:

- permite varios servicos no mesmo evento;
- permite preco por servico;
- permite notas por servico;
- permite estado por servico;
- facilita relatorios;
- facilita evoluir para checklist por servico no futuro.

JSON pode ser usado apenas como snapshot interno ou campo auxiliar no futuro, mas nao deve ser a fonte principal dos servicos.

## 3. Relacoes

Relacoes principais:

- um `external_event` tem muitos `external_event_services`;
- cada `external_event_service` pertence a um `external_event`;
- pagamentos podem ficar inicialmente no `external_event`;
- checklist pode ficar inicialmente por `external_event`;
- no futuro, se fizer sentido, pode haver checklist por servico.

Modelo inicial recomendado:

- O evento guarda cliente, local, data, total, pago, estado geral e notas operacionais.
- Os servicos guardam tipo, label, preco individual opcional, estado e notas especificas.

Exemplo:

Evento externo:

- Cliente: Ana Silva
- Data: 2026-06-12
- Local: Quinta X
- Tipo: Batizado
- Total: 780 euros
- Pago: 150 euros

Servicos:

- Decoracao, 350 euros
- Catering / Brunch, 300 euros
- Baloes, 130 euros

## 4. API necessaria

Endpoints principais:

- `GET /api/external-events`
- `GET /api/external-events/:id`
- `POST /api/external-events`
- `PATCH /api/external-events/:id`
- `DELETE /api/external-events/:id`

Endpoints para servicos dentro do evento:

- `POST /api/external-events/:id/services`
- `PATCH /api/external-events/:id/services/:serviceId`
- `DELETE /api/external-events/:id/services/:serviceId`

## Criar/editar evento e servicos no mesmo payload?

Ha duas abordagens possiveis.

### Opcao A: endpoints separados

Criar evento primeiro, depois adicionar/remover servicos.

Vantagens:

- API mais normalizada;
- facil de editar um servico isolado;
- melhor para futuras checklists por servico.

Desvantagens:

- frontend precisa de coordenar varias chamadas;
- fluxo de criacao inicial fica um pouco mais complexo.

### Opcao B: criar/editar evento com servicos no mesmo payload

Exemplo:

`POST /api/external-events`

```json
{
  "customerName": "Ana Silva",
  "phone": "912345678",
  "eventDate": "2026-06-12",
  "startTime": "15:00",
  "eventLocation": "Quinta X",
  "services": [
    { "serviceType": "decoracao", "serviceLabel": "Decoracao", "price": 350 },
    { "serviceType": "catering", "serviceLabel": "Catering / Brunch", "price": 300 }
  ],
  "totalPrice": 650,
  "amountPaid": 150
}
```

Vantagens:

- formulario de criacao fica mais simples;
- uma chamada cria tudo;
- menos risco de evento sem servicos.

Desvantagens:

- PATCH precisa de uma estrategia clara para atualizar/adicionar/remover servicos;
- mais cuidado no backend para transacoes.

## Recomendacao

Para a Fase 3, usar payload combinado no `POST /api/external-events`, criando evento e servicos numa transacao.

Para edicao:

- permitir `PATCH /api/external-events/:id` para dados gerais e lista completa de `services`;
- o backend substitui os servicos do evento dentro de uma transacao, ou faz upsert/delete por id;
- manter endpoints individuais de servicos para uma fase posterior, se necessario.

Isto reduz complexidade no primeiro fluxo real, sem impedir a normalizacao da base de dados.

## 5. Frontend necessario

Pagina principal:

- `artifacts/girafinha/src/pages/external-events.tsx`

Componentes sugeridos:

- `artifacts/girafinha/src/components/external-event-modal.tsx`
- `artifacts/girafinha/src/components/external-event-form.tsx`
- `artifacts/girafinha/src/components/external-event-services-selector.tsx`
- `artifacts/girafinha/src/components/external-event-card.tsx`

## Pagina Servicos Externos

Deve ter:

- titulo: "Servicos Externos"
- subtitulo: "Gestao de decoracao, catering, animacao, insuflaveis e servicos fora do espaco."
- botao: "+ Novo Servico"

Cards resumo:

- Proximos servicos
- Por receber
- Pagos
- Proximos 7 dias

Lista de eventos externos:

Cada evento deve mostrar:

- data/hora
- cliente
- telefone
- local
- tipo de evento
- servicos incluidos como badges
- valor total
- valor pago
- valor em falta
- estado
- botoes: WhatsApp, Detalhes, Editar, Apagar

## 6. Formulario de novo Servico Externo

## Dados do cliente

- Nome
- Telefone
- Email
- NIF
- Origem

## Dados do evento

- Data
- Horario
- Local/morada
- Numero de pessoas/convidados
- Tipo de evento
- Tema/estilo

## Servicos incluidos

Permitir selecionar varios:

- Decoracao
- Catering / Brunch
- Organizacao de evento
- Animacao
- Aluguer de insuflavel
- Baloes
- Outro

Para cada servico selecionado:

- permitir preco individual opcional;
- permitir notas especificas opcionais;
- permitir remover o servico antes de guardar.

## Campos condicionais recomendados

Se selecionar Decoracao:

- Tema/estilo
- Notas de decoracao

Se selecionar Catering / Brunch:

- Numero de pessoas
- Alergias/restricoes
- Notas de catering

Se selecionar Aluguer de insuflavel:

- Local/morada
- Notas de acesso/montagem

Se selecionar Animacao:

- Numero de criancas/participantes
- Idades/observacoes

Se selecionar Outro:

- Nome/descricao do servico
- Notas especificas

## Notas operacionais

- Montagem
- Desmontagem
- Acessos ao local
- Pedidos especiais

## Pagamento

- Valor total
- Valor pago/sinal
- Metodo de pagamento
- Estado de pagamento calculado automaticamente:
  - `unpaid` se `amount_paid = 0`
  - `partial` se `amount_paid > 0` e `amount_paid < total_price`
  - `paid` se `amount_paid >= total_price`

## Observacoes internas

- `notes`

## 7. Estrategia de implementacao

## Fase 3.1 - Migration e schema Drizzle

Criar:

- migration `external_events`
- migration `external_event_services`
- schema Drizzle `external-events.ts`
- export em `lib/db/src/schema/index.ts`

Validar:

- constraints de status;
- indices em `event_date`, `status`, `payment_status`;
- foreign key com `on delete cascade`;
- RLS ativa, mantendo politica a decidir antes de aplicar em remoto.

## Fase 3.2 - API e schemas OpenAPI/Zod

Criar:

- schemas OpenAPI para `ExternalEvent`, `ExternalEventService`, `CreateExternalEventBody`, `UpdateExternalEventBody`
- endpoints em `artifacts/api-server/src/routes/external-events.ts`
- gerar novamente `lib/api-zod/src/generated/*`
- gerar novamente `lib/api-client-react/src/generated/*`

Validar:

- API antiga de `reservations` continua intacta;
- `venue_events` continua intacto;
- typecheck passa.

## Fase 3.3 - Pagina e listagem

Substituir a vista temporaria em:

- `artifacts/girafinha/src/pages/external-events.tsx`

Criar lista real ligada a `external_events`.

Mostrar:

- cards resumo;
- lista mobile-first;
- badges dos servicos incluidos;
- pagamento;
- estado;
- detalhes basicos.

## Fase 3.4 - Formulario criar/editar

Criar:

- `external-event-modal.tsx`
- `external-event-form.tsx`
- `external-event-services-selector.tsx`

Regras:

- obrigatorio selecionar pelo menos um servico;
- servicos podem ter preco individual;
- total pode ser calculado pela soma dos servicos, mas deve ser editavel manualmente;
- payment_status calculado automaticamente.

## Fase 3.5 - Detalhes, apagar, WhatsApp basico e pagamentos

Adicionar:

- detalhes expandidos;
- editar;
- apagar;
- WhatsApp basico;
- marcar pago, se fizer sentido nesta fase;
- placeholder de checklist se ainda nao houver checklist V2.

## Fase 3.6 - Testes e commit

Executar:

- criar evento externo com 1 servico;
- criar evento externo com varios servicos;
- editar evento;
- editar lista de servicos;
- apagar servico;
- apagar evento;
- testar mobile;
- executar `corepack pnpm run typecheck`;
- fazer commit local seguro.

## 8. Riscos e decisoes

## Servicos no mesmo POST do evento

Recomendado para a Fase 3.

Motivo:

- melhora UX;
- evita criar evento vazio sem servicos;
- permite guardar tudo numa transacao.

Decisao tecnica:

- `POST /api/external-events` deve aceitar `services`;
- backend cria `external_events` e `external_event_services` numa transacao;
- se algum servico for invalido, nada fica guardado.

## Preco individual vs total do evento

Recomendacao:

- guardar preco individual em `external_event_services.price`;
- guardar total final em `external_events.total_price`;
- por defeito, preencher total com soma dos servicos;
- permitir editar total manualmente para ajustes comerciais.

Assim temos relatorios por servico, mas mantemos flexibilidade comercial.

## Compatibilidade com `reservations` antigas

Nao migrar automaticamente na Fase 3.

Recomendacao:

- comecar limpo no modulo `external_events`;
- manter `reservations` como legado;
- mais tarde criar script de migracao opcional para reservas antigas do tipo `external_service`;
- se uma reserva antiga tiver apenas `pack`, tentar inferir um unico servico.

## Migrar dados antigos ou comecar limpo

Recomendacao:

- comecar limpo;
- so migrar depois de validar o modulo;
- evitar misturar dados legados com modelo novo antes de estabilizar.

## Evitar acoplamento a `/reservations`

Regras:

- nao importar logica da pagina antiga de reservas;
- nao usar filtros de URL para simular modulo;
- nao depender de `reservationType`;
- criar API, tipos e componentes proprios.

## Checklist

Na Fase 3, checklist pode ficar por evento externo.

No futuro, se houver necessidade real:

- checklist por `external_event_service`;
- tarefas especificas para decoracao, catering, insuflavel, etc.

## 9. O que reaproveitar

Da Fase 2:

- estrutura de `venue-events`;
- padrao de migration;
- schema Drizzle;
- rotas Express;
- calculo de `payment_status`;
- `dev-api-plugin`;
- OpenAPI/Zod/React Query client;
- cards resumo;
- pagina mobile-first;
- modal especifico;
- detalhes expandidos;
- fluxo de typecheck.

Componentes/padroes a reaproveitar:

- `VenueEventModal` como referencia, nao como base direta;
- `VenueEventsPage` como referencia de listagem;
- cards de pagamento;
- badges de estado;
- dialogs de apagar;
- estrutura de `Dialog` para criar/editar.

O formulario deve ser proprio para Servicos Externos, nao uma extensao do formulario de Festas.

## 10. Plano de testes

Testes funcionais:

- criar evento externo com 1 servico;
- criar evento externo com varios servicos;
- verificar se servicos aparecem como badges na lista;
- editar dados do evento;
- editar servicos incluidos;
- apagar um servico;
- apagar evento;
- verificar calculo de valor em falta;
- verificar `payment_status`:
  - sem pagamento = `unpaid`;
  - sinal parcial = `partial`;
  - totalmente pago = `paid`;
- verificar WhatsApp basico;
- testar detalhes expandidos;
- testar mobile;
- confirmar que `/reservations` antiga continua intacta;
- confirmar que `/venue-events` continua intacta;
- executar `corepack pnpm run typecheck`.

Testes de dados:

- evento com Decoracao apenas;
- evento com Catering / Brunch apenas;
- evento com Decoracao + Catering + Insuflavel;
- evento com Outro e descricao manual;
- evento cancelado;
- evento concluido;
- evento sem pagamento;
- evento com sinal;
- evento totalmente pago.

## Recomendacao final

Implementar a Fase 3 seguindo o mesmo padrao da Fase 2, mas com uma diferenca importante:

- `external_events` e a entidade principal;
- `external_event_services` e obrigatoria para representar os servicos incluidos;
- o formulario deve guardar evento e servicos no mesmo fluxo.

Isto resolve o problema estrutural sem voltar ao modelo antigo de "uma reserva = um servico".

