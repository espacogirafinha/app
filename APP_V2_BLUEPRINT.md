# APP V2 Blueprint - Espaco Girafinha

## Objetivo da V2

A V2 deve deixar de tratar tudo como uma unica "reserva" generica e passar a refletir as tres areas reais do negocio:

1. Festas/Eventos no Espaco
2. Servicos Externos
3. Workshops/Formacoes

A app deve continuar simples para uso diario, mas com uma arquitetura mais clara: cada area tem a sua pagina, fluxo, dados, checklist, pagamentos e relatorios proprios.

## 1. Estrutura de navegacao ideal

- Dashboard
- Festas no Espaco
- Servicos Externos
- Workshops/Formacoes
- Calendario
- Relatorios
- Definicoes

### Dashboard

Painel geral de operacao. Deve mostrar prioridades, proximos eventos, valores por receber, tarefas pendentes e indicadores principais das tres areas.

### Festas no Espaco

Area dedicada a aniversarios e eventos realizados fisicamente no Espaco Girafinha.

### Servicos Externos

Area dedicada a eventos fora do espaco, onde um mesmo evento pode incluir varios servicos.

### Workshops/Formacoes

Area dedicada a workshops, formacoes e inscricoes de participantes.

### Calendario

Vista visual de disponibilidade, ocupacao do espaco, eventos externos e workshops.

### Relatorios

Analise de faturacao, ocupacao, servicos mais vendidos, packs mais vendidos, workshops e valores por receber.

### Definicoes

Gestao de packs, servicos, extras, templates de WhatsApp, checklist padrao, metodos de pagamento e preferencias internas.

## 2. Descricao das areas

## Festas no Espaco

Esta area deve gerir aniversarios e eventos realizados no Espaco Girafinha.

### Packs

- Aluguer do Espaco
- Pack Simples
- Pack Simples com Decoracao
- Pack VIP
- Pack Deluxe
- Pack Personalizado

### Dados principais

- Cliente/responsavel
- Telemovel
- Email
- NIF, quando necessario
- Data
- Horario
- Pack
- Aniversariante
- Idade
- Numero de criancas
- Idades/observacoes
- Tema
- Decoracao
- Catering/extras
- Pedido especial
- Alergias/restricoes
- Autorizacao de imagem
- Condicoes aceites
- Pagamentos
- Checklist
- WhatsApp
- Observacoes internas

### Fluxo recomendado

1. Criar festa.
2. Escolher pack.
3. Registar dados do aniversariante e tema.
4. Adicionar extras, catering e decoracao.
5. Registar sinal e metodo de pagamento.
6. Acompanhar checklist.
7. Enviar mensagens WhatsApp nos momentos certos.
8. Fechar festa como concluida apos pagamento final.

## Servicos Externos

Esta area deve gerir eventos realizados fora do Espaco Girafinha.

Ao contrario das festas no espaco, um evento externo pode incluir varios servicos ao mesmo tempo. Por exemplo:

- Decoracao + Catering
- Decoracao + Catering + Aluguer de insuflavel
- Catering + Animacao
- Organizacao de evento + Baloes + Brunch

### Servicos possiveis

- Decoracao
- Catering / Brunch
- Organizacao de evento
- Animacao
- Aluguer de insuflavel
- Baloes
- Outro

### Dados principais

- Cliente/responsavel
- Telemovel
- Email
- NIF, quando necessario
- Data
- Horario
- Local/morada
- Numero de pessoas/convidados
- Tipo de evento
- Tema/estilo
- Servicos incluidos
- Notas de montagem/desmontagem
- Acessos ao local
- Pedido especial
- Pagamentos
- Checklist
- WhatsApp
- Observacoes internas

### Melhor forma de guardar servicos externos na base de dados

Existem tres opcoes principais:

### Opcao A: array de texto

Exemplo: `external_service_types text[]`

Vantagens:

- Simples de implementar.
- Bom para uma primeira versao.
- Facil de guardar uma lista de servicos escolhidos.

Limites:

- Pouco flexivel para preco por servico.
- Pouco flexivel para estado por servico.
- Dificulta relatorios detalhados.
- Dificulta checklist especifica por servico.

### Opcao B: JSON

Exemplo: `services jsonb`

Vantagens:

- Flexivel.
- Permite guardar detalhes diferentes por tipo de servico.
- Bom para prototipagem.

Limites:

- Relatorios ficam mais dificeis.
- Validacao fica mais fraca.
- Consultas e filtros sao menos simples.

### Opcao C: tabela relacionada

Exemplo:

- `external_events`
- `external_event_services`

Esta e a opcao recomendada para a V2.

Vantagens:

- Permite varios servicos no mesmo evento.
- Permite preco, notas, estado e checklist por servico.
- Melhor para relatorios.
- Melhor para crescer sem remendos.

Modelo recomendado:

- `external_events` guarda o evento principal.
- `external_event_services` guarda cada servico incluido nesse evento.

Exemplo:

Um evento externo pode ter:

- Decoracao
- Catering / Brunch
- Aluguer de insuflavel

Cada linha em `external_event_services` pode ter:

- tipo de servico
- preco
- notas
- estado
- ordem
- detalhes especificos

## Workshops/Formacoes

Workshops e formacoes nao devem ser tratados como reservas normais.

A entidade principal deve ser o Workshop/Formacao. Dentro dela, devem existir participantes.

### Workshop/Formacao

Campos principais:

- Nome
- Data
- Horario
- Vagas
- Preco
- Kit incluido ou nao
- Estado
- Local
- Observacoes

Estados sugeridos:

- Rascunho
- Aberto
- Completo
- Concluido
- Cancelado

### Participante

Campos principais:

- Nome
- Telemovel
- Email
- Valor pago
- Valor em falta
- Metodo de pagamento
- Observacoes

### Fluxo recomendado

1. Criar workshop.
2. Definir vagas, preco, data e horario.
3. Adicionar participantes.
4. Registar pagamentos por participante.
5. Ver ocupacao/vagas disponiveis.
6. Enviar WhatsApp aos participantes.
7. Fechar workshop como concluido.

## 3. Modelo de dados recomendado

## Tabelas principais sugeridas

### `venue_events`

Guarda festas e eventos realizados no Espaco Girafinha.

Campos essenciais:

- id
- customer_name
- phone
- email
- nif
- event_date
- event_time
- status
- pack_id ou pack_name
- birthday_child_name
- birthday_child_age
- children_count
- children_ages
- party_theme
- decoration_notes
- catering_notes
- allergies
- image_authorization
- terms_accepted
- total_price
- amount_paid
- notes
- created_at
- updated_at

Campos opcionais:

- source
- payment_method
- partner_reference
- internal_priority

### `venue_event_extras`

Guarda extras associados a festas no espaco, caso se queira estruturar melhor os extras.

Campos essenciais:

- id
- venue_event_id
- name
- quantity
- unit_price
- total_price
- notes

Numa primeira fase, os extras podem continuar em JSON se isso simplificar a migracao.

### `external_events`

Guarda eventos realizados fora do espaco.

Campos essenciais:

- id
- customer_name
- phone
- email
- nif
- event_date
- event_time
- status
- event_location
- guest_count
- event_type
- event_theme
- setup_notes
- teardown_notes
- access_notes
- total_price
- amount_paid
- payment_method
- source
- notes
- created_at
- updated_at

### `external_event_services`

Guarda os varios servicos incluidos num evento externo.

Campos essenciais:

- id
- external_event_id
- service_type
- service_label
- price
- status
- notes
- sort_order
- created_at
- updated_at

Tipos sugeridos:

- decoracao
- catering
- organizacao_evento
- animacao
- insuflavel
- baloes
- outro

### `workshops`

Guarda workshops/formacoes.

Campos essenciais:

- id
- name
- date
- start_time
- end_time
- capacity
- price
- kit_included
- status
- notes
- created_at
- updated_at

### `workshop_participants`

Guarda participantes de cada workshop/formacao.

Campos essenciais:

- id
- workshop_id
- name
- phone
- email
- amount_paid
- amount_due
- payment_method
- status
- notes
- created_at
- updated_at

### `payments`

Tabela partilhada para pagamentos, se quisermos historico detalhado.

Campos essenciais:

- id
- owner_type
- owner_id
- amount
- payment_method
- payment_date
- note
- created_at

`owner_type` pode ser:

- venue_event
- external_event
- workshop_participant

### `checklist_items`

Tabela partilhada para checklist/tarefas operacionais.

Campos essenciais:

- id
- owner_type
- owner_id
- title
- description
- status
- due_date
- completed_at
- sort_order

### `message_logs`

Registo de mensagens enviadas por WhatsApp.

Campos essenciais:

- id
- owner_type
- owner_id
- message_type
- sent_at
- phone
- note

### `pack_catalog`

Catalogo editavel de packs de festas no espaco.

Campos essenciais:

- id
- name
- description
- base_price
- active
- sort_order

### `service_catalog`

Catalogo editavel de servicos externos.

Campos essenciais:

- id
- service_type
- label
- description
- default_price
- active
- sort_order

## Relacoes principais

- `venue_events` tem muitos `venue_event_extras`
- `venue_events` tem muitos `payments`
- `venue_events` tem muitos `checklist_items`
- `venue_events` tem muitos `message_logs`
- `external_events` tem muitos `external_event_services`
- `external_events` tem muitos `payments`
- `external_events` tem muitos `checklist_items`
- `external_events` tem muitos `message_logs`
- `workshops` tem muitos `workshop_participants`
- `workshop_participants` pode ter muitos `payments`
- `workshops` pode ter muitos `checklist_items`
- `workshops` e `workshop_participants` podem ter `message_logs`

## Como reaproveitar dados atuais

A tabela atual `reservations` deve ser tratada como origem de migracao e compatibilidade, nao como modelo final da V2.

Mapeamento recomendado:

- `reservationType = venue_party` passa para `venue_events`
- `reservationType = external_service` passa para `external_events`
- `externalServiceTypes`, se existir, passa para `external_event_services`
- se nao existir `externalServiceTypes`, tentar inferir a partir de `pack`
- `reservationType = workshop` deve ser analisado caso a caso:
  - se for um workshop real, criar registo em `workshops`
  - se representar uma inscricao, criar `workshop_participant`

Durante a transicao:

- manter os dados antigos como backup
- evitar apagar a tabela antiga ate a V2 estar validada
- criar scripts de migracao pequenos e reversiveis
- testar com copia dos dados antes de tocar em producao

## 4. Plano de implementacao por fases

## Fase 1 - Estrutura limpa

Objetivo:

Criar a estrutura de navegacao e paginas limpas, sem logica complexa.

Entregas:

- Menu com as areas definitivas
- Pagina Festas no Espaco
- Pagina Servicos Externos
- Pagina Workshops/Formacoes
- Dashboard reorganizado
- Rotas claras
- Sem filtros de URL a fingir paginas diferentes

Sem alterar ainda a base de dados.

## Fase 2 - Festas no Espaco completas

Objetivo:

Implementar Festas no Espaco como fluxo proprio.

Entregas:

- Formulario especifico para festas
- Packs corretos
- Aniversariante, idade, tema e numero de criancas
- Decoracao e catering/extras
- Pagamentos
- Checklist
- WhatsApp
- Autorizacao de imagem
- Condicoes aceites

## Fase 3 - Servicos Externos com varios servicos

Objetivo:

Permitir que um evento externo tenha varios servicos associados.

Entregas:

- Formulario proprio de servicos externos
- Selecao multipla de servicos
- Tabela relacionada `external_event_services`
- Local, montagem, desmontagem e acessos
- Checklist especifica por servico
- Pagamentos
- WhatsApp
- Relatorios por tipo de servico

## Fase 4 - Workshops/Formacoes com participantes

Objetivo:

Separar workshop de participante.

Entregas:

- Criar workshop/formacao
- Definir vagas, preco, horario e estado
- Adicionar participantes
- Pagamentos por participante
- Lista de inscritos
- Controlo de vagas
- WhatsApp por participante ou grupo

## Fase 5 - Dashboard e Relatorios por area

Objetivo:

Refazer indicadores com base nas tres areas reais.

Dashboard deve mostrar:

- Hoje
- Proximos 7 dias
- Valores por receber
- Tarefas pendentes
- Proximas festas
- Proximos servicos externos
- Proximos workshops

Relatorios devem mostrar:

- Faturacao mensal
- Valor recebido
- Valor por receber
- Ocupacao do espaco
- Packs mais vendidos
- Servicos externos mais vendidos
- Workshops mais vendidos
- Ticket medio por area

## Fase 6 - Limpeza de codigo antigo

Objetivo:

Remover caminhos confusos e reduzir divida tecnica.

Entregas:

- Remover conceito generico de reserva para tudo
- Remover paginas que apenas filtram a mesma lista
- Remover campos e adaptadores temporarios
- Simplificar tipos TypeScript
- Simplificar schemas Zod/API
- Atualizar nomes e organizacao de ficheiros

## 5. O que aproveitar do codigo atual

- Auth Supabase
- Componentes UI
- Base visual da app
- Sistema de WhatsApp
- Checklist
- Pagamentos
- Extras
- API client/Zod quando fizer sentido
- Estilos base
- Layout mobile-first
- Experiencia adquirida nos fluxos atuais

## 6. O que deve ser eliminado ou refatorado

- Paginas que simulam areas diferentes apenas com filtros de URL
- Conceito generico demais de "Reservas" para tudo
- Workshops tratados como simples reserva
- Servicos externos tratados como escolha unica
- Navegacao confusa
- Formularios demasiado longos com campos irrelevantes para o tipo escolhido
- Logica condicional excessiva dentro de um unico modal
- Relatorios baseados numa entidade generica que mistura areas diferentes

## 7. Estrategia recomendada

- Reconstruir dentro do mesmo repositorio
- Usar a branch `v2-clean-architecture`
- Manter commits antigos como backup
- Trabalhar em fases pequenas
- Fazer commit no fim de cada fase
- Nao fazer deploy ate a V2 estar estavel
- Evitar grandes reescritas invisiveis
- Validar cada area com dados reais de teste
- Criar migrations apenas quando a fase precisar mesmo de novos dados
- Manter a app atual funcional enquanto a V2 nasce

## Decisao tecnica recomendada

A melhor direcao e deixar de ter uma unica entidade central chamada "reserva" para tudo.

Modelo recomendado:

- Festas no Espaco: `venue_events`
- Servicos Externos: `external_events` + `external_event_services`
- Workshops/Formacoes: `workshops` + `workshop_participants`

Pagamentos, checklist e mensagens podem ser partilhados por tipo de entidade usando `owner_type` e `owner_id`.

Esta arquitetura mantem a app simples para usar, mas muito mais clara para crescer.

