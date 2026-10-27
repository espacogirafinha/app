# Comprovativos das despesas

## Modelo

- `public.expense_documents`: um documento, nome original, MIME, tamanho, SHA-256, caminho privado, autor e estado.
- `public.expense_document_links`: relação N:N com despesas existentes; chave composta impede associações repetidas.
- Bucket `expense-documents`: privado, limite de 10 MiB, JPG/PNG/WEBP/PDF. Os buckets de eventos e inventário não são alterados.
- Índice único de SHA-256 para documentos ativos. A mesma fatura em duas despesas corresponde a um objeto e duas associações. Os valores 8,40 € e 45,68 € não são copiados nem recalculados.

## Acesso e API

A API existente `/api/expenses` recebe `documentAction` na query. Ações GET: `list`, `library`, `counts`. Ações POST: `prepare`, `finalize`, `link`, `unlink`, `abort`, `cleanup`. Não existem novas funções físicas nem alterações em `vercel.json`.

Cada operação exige sessão Supabase verificada e papel `admin` ou `staff` na tabela autoritativa `app_private.user_roles`. RLS restringe os documentos e o Storage aos mesmos papéis. As tabelas documentais não aceitam escrita direta de `authenticated`/`anon`. O helper de autorização tem EXECUTE restrito, search_path vazio e não concede acesso ao schema privado.

Upload diretamente do navegador para Storage privado: evita o limite de payload da Vercel. Antes do upload, a API reserva metadados; após o upload, verifica tamanho, assinatura do formato e SHA-256 dos bytes reais. Apenas depois publica a associação. Não há UPDATE/upsert de objetos validados.

Pré-visualização, abertura e download obtêm os bytes pela API autenticada do Storage e criam URLs `blob:` locais, revogadas pelo navegador. Não são guardadas URLs públicas permanentes nem credenciais nos metadados. Um PDF apresenta ícone e nome; as imagens apresentam miniatura.

## Ciclo de vida e recuperação

`pending` → upload e verificação → `ready` → última associação removida → `deleting` → Storage remove confirmado → `deleted`.

Remover apenas uma associação preserva o objeto e as restantes associações. As operações de alteração de associações são serializadas em transações PostgreSQL. A finalização é idempotente, incluindo duas finalizações concorrentes.

Os registos `deleting` são retidos em caso de falha do Storage. A preparação de um novo carregamento repete até 10 limpezas e marca carregamentos pendentes há mais de 24 horas para limpeza; a ação autenticada `cleanup` também pode ser chamada explicitamente. Não foi criado um cron. Sem novas operações, um erro de limpeza permanece registado para repetição; não é esquecido nem apresentado como remoção física concluída.

Os tombstones `deleted` são conservados: impedem novos uploads tardios para caminhos removidos. Um novo upload do mesmo conteúdo usa outro ID/caminho. Não se apaga `storage.objects` por SQL na aplicação.

Despesas anuladas preservam os comprovativos para auditoria. `list` e `unlink` também aceitam uma despesa anulada para permitir remoção explícita da associação; novas associações exigem uma despesa ativa.

## Separação financeira

O módulo só consulta `expenses.id/deleted_at`. Nenhuma ação documental faz INSERT/UPDATE/DELETE em despesas, pagamentos, receitas, eventos, associações de eventos ou relatórios. O teste de integração compara os registos financeiros completos antes/depois. Não foi anexada automaticamente a fatura real nem alterada a repartição Makro em Production.

## Migration e rollback

SQL completo: [`../../supabase/migrations/20261023180715_expense_documents.sql`](../../supabase/migrations/20261023180715_expense_documents.sql).

Rollback completo: [`rollback.sql`](rollback.sql). Antes do rollback, remover os objetos pelo Storage API; o rollback recusa executar se ainda houver objetos no bucket. Os metadados documentais são removidos pelo rollback, as despesas não são alteradas.

A migration não é aplicada automaticamente pelo código ou workflow em qualquer projeto remoto. Em ambiente sem migration, o módulo devolve 503 com explicação; a edição financeira mantém-se disponível.

## Verificação

- Validação de formatos/tamanho/hash: `node --experimental-strip-types --test artifacts/api-server/src/lib/expense-document-validation.test.ts`.
- Ciclo, concorrência, RLS e rollback: `DOCUMENT_TEST_DATABASE_URL=postgres://...@127.0.0.1:5432/... node tests/integration/expense-documents.mjs`. Só aceita localhost e exige base descartável vazia.
- Variante local PostgreSQL WASM: `PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node tests/integration/expense-documents.mjs`. A dependência de teste não foi adicionada ao projeto.
- Teste com Express/Auth/Storage reais: workflow `Expense documents validation`, job `supabase-storage`. Inicia Supabase local descartável, cria utilizadores fictícios e aplica a migration apenas nesse ambiente. Sem ligação a projeto remoto.
- UI: `corepack pnpm exec playwright test --config playwright.expense-documents.config.ts`; servidor Vite de testes em 127.0.0.1:4175, configuração Supabase fictícia. Testa computador e viewport iPhone em Chromium; a câmara física e Safari nativo requerem validação num dispositivo real.
- Obrigatórios: `corepack pnpm run typecheck` e `corepack pnpm run build`.

## Revisão técnica e segurança — 27/10/2026

Aprovação funcional pela responsável concluída; PR #75 marcado **Ready for Review**, ainda **sem autorização para merge, migrations remotas ou Production**.

### Novo registo com comprovativo no mesmo formulário

- Em **Despesas → Adicionar despesa**, os botões **Anexar comprovativo** e **Tirar fotografia** surgem antes de guardar.
- Os ficheiros JPG/PNG/WEBP/PDF até 10 MiB são selecionados e apresentados numa lista removível em memória local do formulário; ainda não criam objetos Storage nem dados financeiros.
- Ao guardar, a API financeira cria a despesa **uma única vez** e devolve o ID. Só depois o frontend envia cada ficheiro ao módulo privado de documentos, ligando-o à nova despesa.
- Guardar sem anexos mantém a criação normal. Enquanto decorre o envio, o formulário impede uma segunda submissão e desativa Cancelar.
- Se falhar um anexo, a despesa já criada é preservada. O formulário muda para **Editar despesa**, mostra o nome do ficheiro falhado e permite repetir o carregamento, sem criar uma segunda despesa. Os ficheiros falhados devem ser selecionados de novo na edição.
- O Preview gratuito inclui uma simulação autónoma de criação, sem sessão/recursos de Production. O fluxo real é validado com mocks no Playwright; Storage/Auth/PostgreSQL são validados em Docker descartável separado.

### Orçamento 0 € e capacidade disponível

A organização Supabase `espacogirafinha's Org` foi confirmada no plano **Free** em 27/10/2026, com dois projetos existentes. Consulta apenas de leitura ao catálogo `storage.objects`: o projeto **Espaço Girafinha Reservas** tinha 7 objetos, que somavam 3.620.938 bytes nos metadados; o projeto do site `espacogirafinha.pt` tinha 0 objetos. Estes valores são inventário pontual, **não medem consumo médio faturado, largura de banda/egress nem garantem quota futura**. O plano Free inclui 1 GB de ficheiros por organização, sem taxas de overage; ultrapassar os limites pode restringir o serviço. Confirmar o consumo no Dashboard antes de qualquer go-live. Fontes oficiais: https://supabase.com/docs/guides/platform/billing-on-supabase e https://supabase.com/docs/guides/platform/cost-control.

A migration permanece **apenas no repositório**: a pesquisa em Production confirmou que `expense_documents`, `expense_document_links` e o bucket `expense-documents` ainda não existem. Nenhuma alteração remota foi efetuada. Câmara física e Safari nativo de iPhone ainda exigem teste manual.

## Aprovação

PR independente da main `005f77190a2d35c4ed5564879138124a2ce1b3fc`. O PR #73 não foi modificado nem incorporado. Não fazer merge, deploy Production ou migration em Production sem autorização expressa. A demonstração gratuita no Preview permite aprovação visual e funcional com dados fictícios. A ligação Preview→base remota persistente fica fora do âmbito de orçamento 0 €; o armazenamento real é validado em Supabase Docker descartável no CI.

## Evidência da entrega (23/10/2026)

- PR: https://github.com/espacogirafinha/app/pull/75 (Ready for Review), branch `feat/expense-documents`.
- Código testado: `389dbc41ca3781d16cb122efaa27c0d57f4622e4`.
- CI completo: https://github.com/espacogirafinha/app/actions/runs/40004692750 — ambos os jobs aprovados.
- 229 testes unitários locais aprovados; 6 E2E UI desktop/mobile aprovados; integração PostgreSQL 17, RLS, concorrência, recuperação e rollback aprovados.
- Job `supabase-storage` aprovado: Express real, Supabase Auth/Storage reais em Docker descartável; quatro formatos, download de bytes, bloqueio público/sem papel, ficheiros imutáveis, PDF partilhado, persistência, remoção do último objeto e snapshot financeiro idêntico.
- Preview técnico READY: `dpl_9yGjGALTVuTbo7GTyEwTWeTFwd5D`, https://app-9y5fogwks-espacogirafinhas-projects.vercel.app.
- Probes HTTP em Preview real (mesmo código de backend, deployment `dpl_rb21uZoXYvXmyxcRUCynKnFy7yfT`): GET list/counts e POST prepare/link/unlink devolveram 401 JSON da aplicação depois do acesso temporário pela proteção Vercel. Sem escritas, credenciais ou sessão da aplicação.
- Não há novas funções físicas; não foram alteradas `api/` nem `vercel.json`.
- Não houve alterações financeiras remotas, migration remota, merge, deploy Production ou alterações de variáveis de ambiente.
- Atualização do âmbito de validação: usar a demonstração gratuita com mocks no próprio Preview; não ativar a migration em nenhuma base remota. A câmara física/Safari num iPhone real não foram testados.

## Validação gratuita e demonstração (atualização 23/10/2026)

Orçamento adicional autorizado: **0 €**. Não criar projetos, branches Supabase ou serviços pagos. Não aplicar migrations remotas, não alterar Production e não fazer merge.

O Docker não está disponível no executor local. Os testes reais de Express + PostgreSQL + Supabase Auth/Storage são executados em Docker descartável nos runners GitHub Actions já existentes deste repositório público, sem ligação a qualquer projeto remoto. As instâncias são paradas e eliminadas no fim. Não são criados serviços cloud ou cobrados ambientes Supabase adicionais.

A alternativa de validação no Preview é `/comprovativos-demo.html`, usando exatamente o componente real de comprovativos com um transporte em memória. Duas despesas fictícias (8,40 € e 45,68 €) partilham um PDF fictício de 54,08 €. É possível carregar imagens/PDFs, abrir/descarregar, associar ficheiros existentes e remover associações. O transporte aplica os mesmos limites de MIME/tamanho e SHA-256 do cliente real. O teste impede chamadas de rede e verifica que os valores fictícios não mudam.

A página não importa a sessão da aplicação nem acede a Supabase/API. Uma política CSP `connect-src 'none'` bloqueia ligações de dados. Os ficheiros ficam apenas na memória da página, sem localStorage/IndexedDB; recarregar ou fechar repõe os exemplos. O build inclui a página apenas em Vercel Preview (ou no build local explicitamente marcado `EXPENSE_DOCUMENTS_DEMO=1`), nunca num build `VERCEL_ENV=production`.

Limitações gratuitas explicitamente aceites para a demonstração: não persiste entre carregamentos nem entre dispositivos; não testa a ligação Preview→base real; permissões e persistência reais são verificadas separadamente na integração Supabase local em Docker. A câmara física e Safari nativo num iPhone requerem um teste manual no dispositivo. O PR está Ready for Review após aprovação funcional, sem autorização para merge ou ativação remota; não há pedido de ambiente pago.
