# Fase 4 da V2: Workshops/Formacoes

## 1. Objetivo da Fase 4

A Fase 4 transforma Workshops/Formacoes num modulo proprio da V2, separado do conceito generico de `reservations`.

O objetivo e deixar de tratar cada inscricao como uma reserva normal. A estrutura correta passa a ser:

- criar um workshop/formacao como produto principal;
- gerir participantes dentro desse workshop;
- acompanhar vagas, inscricoes, pagamentos e presencas por participante;
- manter a area de workshops independente das festas no espaco e dos servicos externos.

Exemplo esperado:

- Workshop: Workshop Baloes Nivel 1
- Data: 12 junho
- Vagas: 10
- Preco: 70 EUR
- Participantes: Ana Silva, Maria Santos, Joana Costa

Nesta fase, o modulo deve nascer limpo, sem apagar dados antigos e sem depender da tabela `reservations`.

## 2. Modelo de dados recomendado

### Tabela `workshops`

Representa cada workshop/formacao criado pelo Espaco Girafinha.

Campos sugeridos:

- `id` uuid primary key
- `name` text not null
- `description` text
- `date` date not null
- `start_time` text not null
- `end_time` text
- `capacity` integer not null default 0
- `price` numeric(10,2) not null default 0
- `kit_included` boolean not null default false
- `status` text not null default 'draft'
- `location` text
- `notes` text
- `created_at` timestamp with time zone default now()
- `updated_at` timestamp with time zone default now()

Estados sugeridos para `workshops.status`:

- `draft` - em preparacao
- `open` - inscricoes abertas
- `full` - lotado
- `completed` - concluido
- `cancelled` - cancelado

Indices recomendados:

- `date`
- `status`

### Tabela `workshop_participants`

Representa cada participante inscrito num workshop especifico.

Campos sugeridos:

- `id` uuid primary key
- `workshop_id` uuid not null references `workshops(id)` on delete cascade
- `name` text not null
- `phone` text not null
- `email` text
- `nif` text
- `amount_paid` numeric(10,2) not null default 0
- `amount_due` numeric(10,2) not null default 0
- `payment_method` text
- `payment_status` text not null default 'unpaid'
- `status` text not null default 'registered'
- `notes` text
- `created_at` timestamp with time zone default now()
- `updated_at` timestamp with time zone default now()

Estados sugeridos para `workshop_participants.status`:

- `registered` - inscrito
- `confirmed` - confirmado
- `attended` - participou
- `cancelled` - cancelado

Estados sugeridos para `payment_status`:

- `unpaid` - sem pagamento
- `partial` - pagamento parcial
- `paid` - pago

Indices recomendados:

- `workshop_id`
- `status`
- `payment_status`

## 3. Relacoes

- Um `workshop` tem muitos `workshop_participants`.
- Cada participante pertence a um unico workshop.
- Se um workshop for apagado, os participantes associados podem ser apagados por cascade.
- Os pagamentos devem ficar inicialmente no participante, porque cada pessoa pode pagar em momentos diferentes.
- No futuro, se a app crescer, pode existir uma tabela partilhada de pagamentos para festas, servicos externos e workshops.
- A checklist pode ser inicialmente por workshop, nao por participante.
- No futuro, pode haver tarefas especificas por participante, mas isso nao parece necessario para a primeira versao.

## 4. API necessaria

### Endpoints para workshops

- `GET /api/workshops`
- `GET /api/workshops/:id`
- `POST /api/workshops`
- `PATCH /api/workshops/:id`
- `DELETE /api/workshops/:id`

### Endpoints para participantes

- `POST /api/workshops/:id/participants`
- `PATCH /api/workshops/:id/participants/:participantId`
- `DELETE /api/workshops/:id/participants/:participantId`

### Decisao recomendada

Para a Fase 4, faz mais sentido gerir participantes com endpoints separados.

Motivos:

- participantes entram e saem ao longo do tempo;
- pagamentos sao registados individualmente;
- editar um participante nao deve obrigar a reenviar o workshop inteiro;
- evita conflitos quando a equipa estiver a atualizar inscricoes;
- fica mais parecido com a realidade operacional: primeiro cria-se o workshop, depois gerem-se inscricoes.

Ainda assim, `GET /api/workshops/:id` deve devolver o workshop com a lista de participantes, para facilitar a pagina de detalhes.

## 5. Frontend necessario

Pagina principal:

- `artifacts/girafinha/src/pages/workshops.tsx`

Componentes sugeridos:

- `artifacts/girafinha/src/components/workshop-modal.tsx`
- `artifacts/girafinha/src/components/workshop-form.tsx`
- `artifacts/girafinha/src/components/workshop-card.tsx`
- `artifacts/girafinha/src/components/workshop-participants-panel.tsx`
- `artifacts/girafinha/src/components/workshop-participant-modal.tsx`

A pagina deve mostrar:

- titulo: `Workshops/Formacoes`
- subtitulo curto sobre gestao de workshops, inscricoes e participantes
- botao: `+ Novo Workshop`
- cards resumo:
  - Workshops agendados
  - Inscricoes
  - Por receber
  - Vagas disponiveis
- lista de workshops

Cada workshop deve mostrar:

- nome
- data/hora
- vagas
- inscritos
- vagas livres
- preco
- recebido
- por receber
- estado
- botoes: Detalhes, Editar, Apagar, Adicionar participante

A interface deve ser mobile-first: cards limpos em mobile e uma lista mais densa apenas em desktop, se fizer sentido.

## 6. Formulario de novo workshop

Campos principais:

- Nome do workshop
- Descricao
- Data
- Hora inicio
- Hora fim
- Numero de vagas
- Preco por participante
- Kit incluido: sim/nao
- Local
- Estado
- Observacoes

Regras recomendadas:

- `name`, `date`, `start_time`, `capacity` e `price` devem ser obrigatorios.
- `capacity` deve ser maior que 0.
- `price` pode ser 0 para workshops gratuitos ou promocionais.
- `status` deve comecar como `draft` ou `open`, conforme escolha da equipa.
- O formulario nao deve pedir participantes no momento de criar o workshop, para manter o fluxo simples.

## 7. Gestao de participantes

Dentro de cada workshop, deve ser possivel:

- ver lista de participantes;
- adicionar participante;
- editar participante;
- remover/cancelar participante;
- registar valor pago;
- calcular valor em falta;
- mostrar estado de pagamento;
- abrir WhatsApp basico para o participante.

Campos do participante:

- Nome
- Telemovel
- Email
- NIF opcional
- Valor pago
- Valor em falta calculado
- Metodo de pagamento
- Estado
- Observacoes

Regras recomendadas:

- `amount_due` deve ser calculado com base no preco do workshop menos `amount_paid`, mas pode ser guardado para facilitar relatorios.
- `payment_status` deve ser calculado automaticamente:
  - `unpaid` se `amount_paid = 0`
  - `partial` se `amount_paid > 0` e menor que o preco
  - `paid` se `amount_paid >= price`
- Participantes cancelados nao devem contar como vaga ocupada.
- Participantes com estado `registered`, `confirmed` ou `attended` contam para inscricoes/vagas ocupadas.

## 8. Estrategia de implementacao

### Fase 4.1

Criar migration e schema Drizzle para:

- `workshops`
- `workshop_participants`

Incluir constraints, indices e RLS ativado, seguindo o padrao de `venue_events` e `external_events`.

### Fase 4.2

Criar API, OpenAPI/Zod e client gerado:

- CRUD de workshops
- CRUD de participantes dentro de workshops
- calculo automatico de pagamentos de participantes

### Fase 4.3

Substituir a pagina temporaria `workshops.tsx` por uma pagina real ligada a `workshops`.

Incluir cards resumo, listagem e estado vazio.

### Fase 4.4

Implementar formulario criar/editar workshop.

Manter simples: dados do workshop primeiro, participantes depois.

### Fase 4.5

Implementar painel de participantes dentro do workshop:

- adicionar participante
- editar participante
- cancelar/remover participante
- pagamento por participante

### Fase 4.6

Completar detalhes operacionais:

- WhatsApp basico
- apagar com confirmacao
- estados visuais
- testes manuais
- typecheck
- commit seguro

## 9. Riscos e decisoes

### Participantes no payload do workshop ou endpoints separados

Recomendacao: endpoints separados.

Criar participantes dentro do payload do workshop pode parecer mais rapido, mas complica edicoes, pagamentos parciais e cancelamentos. Como participantes sao uma entidade viva, devem ter endpoints proprios.

### Como calcular vagas ocupadas

Vagas ocupadas devem contar apenas participantes ativos:

- `registered`
- `confirmed`
- `attended`

Participantes `cancelled` nao devem ocupar vaga.

### Como impedir ultrapassar capacidade

Na API, antes de adicionar participante ativo, contar participantes ativos existentes.

Se `activeParticipants >= capacity`, a API deve devolver erro claro.

Excecao futura possivel: permitir overbooking manual com confirmacao, mas nao na primeira versao.

### Como lidar com cancelamentos

Cancelar deve ser preferivel a apagar quando ja houve contacto ou pagamento.

Apagar pode continuar disponivel para erros de introducao, mas a acao normal deve ser marcar como `cancelled`.

### Como calcular recebido e por receber

Por workshop:

- Recebido = soma de `amount_paid` dos participantes nao cancelados
- Por receber = soma de `amount_due` dos participantes nao cancelados

Por participante:

- Valor em falta = `workshop.price - amount_paid`, minimo 0

### Waitlist/lista de espera

Nao implementar agora, mas o modelo pode evoluir facilmente com novo estado:

- `waitlist`

Ou com uma tabela propria no futuro se houver muita procura.

### Compatibilidade com reservas antigas tipo workshop

A tabela antiga `reservations` deve ficar como legado/backup.

Decisao recomendada:

- comecar limpo na V2;
- nao migrar automaticamente dados antigos;
- se houver workshops antigos importantes, migrar manualmente depois de validar o modulo.

### Evitar acoplamento ao modulo antigo

A pagina nova de Workshops nao deve depender de filtros em `/reservations`.

Deve usar apenas as tabelas novas quando a Fase 4 estiver implementada.

## 10. O que reaproveitar

Da Fase 2 e Fase 3, podemos reaproveitar:

- padrao de migration e schema Drizzle;
- rotas API com auth e tratamento de erros;
- OpenAPI/Zod/client gerado;
- `dev-api-plugin` para desenvolvimento local;
- modais mobile-first;
- cards resumo;
- badges de estado/pagamento;
- calculo automatico de pagamento;
- confirmacao antes de apagar;
- botao WhatsApp basico;
- layout e componentes UI existentes.

O mais importante e reaproveitar padroes, nao copiar complexidade desnecessaria.

## 11. Plano de testes

Testes manuais recomendados:

- criar workshop;
- editar workshop;
- apagar workshop;
- adicionar participante;
- editar participante;
- remover/cancelar participante;
- registar pagamento parcial;
- registar pagamento total;
- verificar valor em falta por participante;
- verificar recebido total do workshop;
- verificar por receber do workshop;
- verificar vagas disponiveis;
- tentar adicionar participante acima da capacidade;
- confirmar que participante cancelado liberta vaga;
- abrir WhatsApp basico para participante;
- testar mobile;
- executar `corepack pnpm run typecheck`.

## Estrategia recomendada

A Fase 4 deve seguir o mesmo metodo que funcionou nas fases anteriores:

1. criar base de dados e schema;
2. criar API e client;
3. criar pagina real;
4. criar formulario de workshop;
5. adicionar gestao de participantes;
6. testar e commitar em partes pequenas.

Assim mantemos a V2 previsivel, com commits seguros e sem misturar workshops com reservas antigas.
