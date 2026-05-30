# Fase 6 - Definicoes e Catalogos Operacionais

## 1. Objetivo da Fase 6

A Fase 6 transforma a pagina de Definicoes numa area real de gestao operacional da app.

O objetivo principal e deixar de ter packs, servicos, extras, templates de mensagens e checklists fixos no codigo. A equipa deve conseguir ajustar estes elementos pela app, sem precisar de alterar codigo sempre que muda um preco, um nome de pack, um servico vendido ou uma mensagem enviada ao cliente.

Esta fase tambem prepara a app para crescer com menos risco:

- configuracoes internas passam a estar centralizadas;
- os formularios podem buscar opcoes dinamicas;
- os modulos V2 continuam separados por area de negocio;
- os valores fixos atuais continuam como fallback ate os catalogos estarem estaveis;
- a publicacao de futuras melhorias passa a ser mais previsivel.

Nesta fase de planeamento nao serao criadas migrations, tabelas, endpoints ou alteracoes funcionais.

## 2. Modulos Sugeridos em Definicoes

### Packs de Festas no Espaco

Gestao dos packs usados em `venue_events`.

Exemplos:

- Aluguer do Espaco;
- Pack Simples;
- Pack Simples com Decoracao;
- Pack VIP;
- Pack Deluxe;
- Pack Personalizado.

Cada pack deve poder ter:

- nome;
- descricao curta;
- preco base;
- duracao/horario sugerido;
- estado ativo/inativo;
- ordem de apresentacao;
- notas internas.

### Catalogo de Servicos Externos

Gestao dos servicos usados em `external_events` e `external_event_services`.

Exemplos:

- Decoracao;
- Catering / Brunch;
- Organizacao de evento;
- Animacao;
- Aluguer de insuflavel;
- Baloes;
- Outro.

Cada servico deve poder ter:

- codigo interno;
- nome visivel;
- descricao;
- preco base opcional;
- estado ativo/inativo;
- ordem de apresentacao;
- campos operacionais relevantes.

### Extras

Catalogo comum para extras que podem ser usados em festas, servicos externos ou, no futuro, workshops.

Exemplos:

- bolo;
- pinturas faciais;
- modelagem de baloes;
- mesa tematica extra;
- hora extra;
- catering adicional.

Cada extra deve poder ter:

- nome;
- categoria;
- preco base;
- modulo onde se aplica;
- estado ativo/inativo;
- notas internas.

### Templates de WhatsApp

Gestao de mensagens padrao para comunicacao com clientes e participantes.

Exemplos:

- confirmacao de festa;
- pedido de sinal;
- confirmacao de pagamento;
- mensagem pos-festa;
- confirmacao de servico externo;
- confirmacao de inscricao em workshop;
- lembrete de workshop.

Cada template deve poder ter:

- nome;
- modulo;
- tipo de momento;
- texto;
- variaveis permitidas;
- estado ativo/inativo.

### Checklists Operacionais

Gestao de modelos de checklist por tipo de evento.

Exemplos:

- checklist de festa no espaco;
- checklist de decoracao externa;
- checklist de catering;
- checklist de insuflavel;
- checklist de workshop.

Cada checklist deve poder ter:

- nome;
- modulo;
- tipo de evento/servico;
- lista ordenada de itens;
- itens obrigatorios/opcionais;
- estado ativo/inativo.

### Preferencias Gerais

Configuracoes simples da app.

Exemplos:

- nome do espaco;
- telefone principal;
- email principal;
- morada;
- numero de slots do espaco por dia;
- horarios padrao de festas;
- moeda;
- texto legal/condicoes;
- configuracoes visuais pequenas.

## 3. Estrategia Tecnica

As entidades futuras devem ser criadas de forma incremental, com migrations pequenas e reversiveis.

Tabelas sugeridas:

### `venue_packs`

Guarda os packs das festas no espaco.

Campos provaveis:

- `id`
- `name`
- `description`
- `base_price`
- `default_start_time`
- `default_end_time`
- `is_active`
- `sort_order`
- `internal_notes`
- `created_at`
- `updated_at`

### `external_service_catalog`

Guarda o catalogo de servicos externos disponiveis.

Campos provaveis:

- `id`
- `code`
- `name`
- `description`
- `base_price`
- `is_active`
- `sort_order`
- `operational_notes`
- `created_at`
- `updated_at`

### `event_extras`

Guarda extras reutilizaveis.

Campos provaveis:

- `id`
- `name`
- `category`
- `base_price`
- `applies_to`
- `is_active`
- `sort_order`
- `internal_notes`
- `created_at`
- `updated_at`

### `message_templates`

Guarda templates de WhatsApp e mensagens operacionais.

Campos provaveis:

- `id`
- `name`
- `module`
- `trigger_type`
- `body`
- `variables`
- `is_active`
- `created_at`
- `updated_at`

### `checklist_templates`

Guarda o modelo principal de cada checklist.

Campos provaveis:

- `id`
- `name`
- `module`
- `event_type`
- `service_type`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

### `checklist_template_items`

Guarda os itens de cada modelo de checklist.

Campos provaveis:

- `id`
- `template_id`
- `label`
- `description`
- `is_required`
- `sort_order`
- `created_at`
- `updated_at`

### `app_settings`

Guarda preferencias gerais simples.

Campos provaveis:

- `id`
- `key`
- `value`
- `value_type`
- `description`
- `updated_at`

## 4. Integracao com Modulos Existentes

### Festas no Espaco

O modulo `venue-events` deve passar a buscar packs de `venue_packs`.

Estrategia recomendada:

1. manter os packs fixos atuais como fallback;
2. criar API para listar packs ativos;
3. ligar o formulario de Nova Festa ao catalogo;
4. gravar no evento o nome/preco escolhido no momento da reserva;
5. nao depender do catalogo para recalcular eventos antigos.

Isto evita que alterar o preco de um pack hoje mude historico de festas antigas.

### Servicos Externos

O modulo `external-events` deve passar a buscar servicos de `external_service_catalog`.

Estrategia recomendada:

1. manter os servicos fixos atuais como fallback;
2. listar servicos ativos no seletor multiplo;
3. ao guardar um evento externo, copiar `service_type`, `service_label` e preco para `external_event_services`;
4. preservar eventos antigos mesmo que o catalogo mude.

### Workshops/Formacoes

Workshops podem usar templates de mensagens e, numa fase futura, preferencias gerais.

Exemplos:

- mensagem de confirmacao de inscricao;
- lembrete antes do workshop;
- mensagem de pagamento pendente;
- texto de kit incluído.

Nesta fase, workshops nao precisam obrigatoriamente de catalogo de produtos.

### Checklists

Checklists devem evoluir para modelos reutilizaveis.

Estrategia recomendada:

1. criar templates por modulo/tipo;
2. ao criar evento, copiar os itens do template para uma checklist operacional do evento;
3. permitir editar a checklist do evento sem alterar o template original;
4. manter templates como ponto de partida, nao como historico vivo.

### WhatsApp

Templates de WhatsApp devem substituir textos fixos gradualmente.

Estrategia recomendada:

1. criar templates por modulo e momento;
2. suportar variaveis simples, como `{customerName}`, `{eventDate}`, `{startTime}`, `{amountDue}`;
3. renderizar mensagem antes de abrir o WhatsApp;
4. manter fallback fixo caso nao exista template ativo.

## 5. Fases Pequenas Recomendadas

### Fase 6.1 - Plano e desenho das entidades

Objetivo:

- validar este plano;
- decidir campos minimos;
- confirmar ordem de implementacao;
- confirmar que catalogos nao alteram historico.

Entrega:

- documento de plano;
- nenhuma alteracao funcional;
- nenhum schema novo.

### Fase 6.2 - Schema/migrations de catalogos basicos

Objetivo:

- criar tabelas essenciais;
- ativar RLS seguindo o padrao do projeto;
- nao aplicar migrations automaticamente no Supabase remoto.

Entidades prioritarias:

- `venue_packs`;
- `external_service_catalog`;
- `event_extras`.

Entrega:

- migrations locais;
- schema Drizzle;
- typecheck.

### Fase 6.3 - API de packs e servicos

Objetivo:

- criar endpoints para listar, criar, editar e desativar packs/servicos;
- gerar OpenAPI/Zod/API client;
- manter endpoints protegidos pela auth existente.

Endpoints provaveis:

- `GET /api/settings/venue-packs`
- `POST /api/settings/venue-packs`
- `PATCH /api/settings/venue-packs/:id`
- `GET /api/settings/external-services`
- `POST /api/settings/external-services`
- `PATCH /api/settings/external-services/:id`

Entrega:

- API funcional;
- sem ligacao aos formularios principais ainda.

### Fase 6.4 - Pagina Definicoes com gestao de packs

Objetivo:

- transformar `/settings` numa area real;
- gerir packs de festas no espaco;
- permitir ativar/desativar packs sem apagar historico.

Entrega:

- UI mobile-first;
- CRUD de packs;
- validacao local.

### Fase 6.5 - Gestao de servicos externos

Objetivo:

- gerir catalogo de servicos externos;
- controlar labels, precos base e ordem;
- preparar seletor multiplo dinamico.

Entrega:

- CRUD de servicos externos;
- sem quebrar eventos existentes.

### Fase 6.6 - Templates WhatsApp

Objetivo:

- criar estrutura para mensagens editaveis;
- suportar variaveis simples;
- ligar primeiro a uma area piloto, preferencialmente workshops ou festas.

Entrega:

- catalogo de templates;
- preview de mensagem;
- fallback seguro.

### Fase 6.7 - Checklists

Objetivo:

- criar templates de checklist;
- criar itens por template;
- preparar copia de template para evento.

Entrega:

- gestao de templates;
- sem migrar checklists antigas automaticamente.

### Fase 6.8 - Integracao gradual nos formularios existentes

Objetivo:

- ligar packs dinamicos ao formulario de festas;
- ligar catalogo dinamico ao formulario de servicos externos;
- ligar extras dinamicos onde fizer sentido;
- manter fallbacks ate os catalogos estarem validados em preview.

Entrega:

- formularios usando catalogos;
- testes manuais por area;
- preview antes de merge.

## 6. Regras de Seguranca

Esta fase deve seguir as regras permanentes do projeto:

- nunca mexer em producao diretamente;
- trabalhar sempre numa branch propria;
- fazer commits pequenos e seguros;
- criar preview antes de qualquer merge;
- nao aplicar migrations no Supabase remoto sem confirmacao explicita;
- nao alterar variaveis Vercel sem autorizacao;
- nao quebrar dados existentes;
- nao remover valores fixos ate os catalogos estarem estaveis;
- manter a app antiga `/reservations` como legado;
- nao recuperar stash antigo sem autorizacao;
- nao apagar branches sem autorizacao;
- nao expor secrets em ficheiros, logs ou mensagens.

## 7. Riscos e Decisoes a Confirmar

### Risco: alterar catalogos pode afetar historico

Recomendacao:

- eventos devem guardar snapshot dos nomes/precos escolhidos;
- catalogos servem para novas escolhas, nao para recalcular historico.

### Risco: Definicoes ficar demasiado grande

Recomendacao:

- organizar por tabs ou secoes:
  - Packs;
  - Servicos;
  - Extras;
  - Mensagens;
  - Checklists;
  - Preferencias.

### Risco: permissoes de administracao

Recomendacao:

- nesta fase, manter acesso apenas a utilizadores autenticados da app;
- numa fase futura, avaliar roles/admin permissions.

### Risco: duplicar logica entre catalogo e eventos

Recomendacao:

- catalogos definem defaults;
- eventos guardam snapshot operacional;
- updates em catalogo nao alteram eventos ja criados.

## 8. Plano de Testes Futuro

Antes de publicar qualquer implementacao da Fase 6:

- criar pack novo em preview;
- editar preco de pack;
- desativar pack;
- confirmar que evento antigo nao muda;
- criar servico externo novo;
- usar servico externo novo num evento;
- editar catalogo sem alterar eventos existentes;
- criar extra;
- testar UI mobile;
- testar auth;
- testar typecheck;
- testar build;
- testar preview Vercel;
- limpar dados de teste.

## 9. Recomendacao Final

A melhor ordem e comecar por packs de Festas no Espaco e catalogo de Servicos Externos.

Sao os catalogos com maior impacto imediato e menor risco, porque ja existem formularios V2 estaveis e os valores fixos atuais podem continuar como fallback.

Templates WhatsApp e checklists devem vir depois, porque mexem em fluxos operacionais mais sensiveis e beneficiam de uma base de Definicoes ja testada.
