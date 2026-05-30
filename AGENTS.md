# AGENTS.md - Espaco Girafinha App

## Projeto

Esta app e a V2 da aplicacao interna do Espaco Girafinha.

A arquitetura principal e separada por areas reais do negocio:

- Festas no Espaco: `venue_events`
- Servicos Externos: `external_events` + `external_event_services`
- Workshops/Formacoes: `workshops` + `workshop_participants`

A tabela antiga `reservations` e legado/arquivo e nao deve ser usada como fonte principal da V2.

## Diretorio local

Trabalhar sempre em:

`C:\Dev\Event-Manager-Pro`

## Branch

Trabalhar na branch:

`v2-clean-architecture`

Nunca fazer merge para `main` sem autorizacao explicita.

## Regras de seguranca

Nunca fazer sem autorizacao explicita:

- `git push`
- deploy na Vercel
- merge para `main`
- apagar branches
- apagar dados de producao
- aplicar migrations no Supabase remoto
- alterar variaveis de ambiente
- expor chaves, tokens ou secrets

Nunca incluir em commits:

- `.env`
- `.env.local`
- `node_modules`
- `start-girafinha-local.bat`
- ficheiros com chaves privadas
- ficheiros temporarios

## Supabase

Criar migrations localmente quando necessario, mas nao aplicar automaticamente no Supabase remoto.

No final de qualquer tarefa que crie migration, mostrar o SQL completo e pedir confirmacao antes de aplicar.

## Vercel

Nao fazer deploy automatico.

A Vercel so deve ser usada quando for explicitamente pedido.

## GitHub

Nao fazer push sem autorizacao.

Trabalhar em commits locais pequenos e seguros.

## Validacao obrigatoria

Antes de terminar qualquer tarefa de codigo, executar:

`corepack pnpm run typecheck`

Se falhar, corrigir antes de terminar.

Para tarefas apenas de documentacao/Markdown, seguir a instrucao especifica do pedido. Se o pedido disser para executar apenas `git status`, nao executar typecheck.

## Fluxo de trabalho

Trabalhar sempre por fases pequenas.

Cada tarefa deve:

1. mexer no menor numero possivel de ficheiros;
2. respeitar a arquitetura da V2;
3. nao misturar modulos sem necessidade;
4. nao recuperar stash antigo sem autorizacao;
5. nao alterar a app antiga `/reservations` exceto se for explicitamente pedido.

## Estrutura da V2

### Festas no Espaco

Usar:

- `venue_events`

### Servicos Externos

Usar:

- `external_events`
- `external_event_services`

Um evento externo pode ter varios servicos.

### Workshops/Formacoes

Usar:

- `workshops`
- `workshop_participants`

Um workshop tem varios participantes. Participantes cancelados nao contam para vagas ocupadas.

## Dashboard, Calendario e Relatorios

Devem usar os modulos V2:

- `venue_events`
- `external_events`
- `external_event_services`
- `workshops`
- `workshop_participants`

Nao devem depender da tabela antiga `reservations`.

## Resposta final obrigatoria

No final de cada tarefa, responder sempre com:

- ficheiros criados;
- ficheiros alterados;
- comandos executados;
- se `typecheck` passou;
- se houve ou nao deploy/push/merge;
- se ha migrations pendentes;
- como testar.

Nao fazer commit automaticamente.
