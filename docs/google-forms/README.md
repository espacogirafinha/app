# Google Forms → Girafinha V2 (preparação; desativado)

Form `19JReWvo-11bzk6X1iIARghDLEh0pLDaJHr2Bu8RmMFc` → spreadsheet `1NfrBGvwW-E9ncHnvhlMDgl_qbTiMraJD8N2Un9mIwe0` → installable `onGirafinhaFormSubmit` → HMAC SHA-256 → `POST /api/integrations/google-forms/venue-event` → transação PostgreSQL (`venue_events`, `event_selected_extras`, `google_form_imports`). Não há escrita direta do Apps Script no Supabase. Não ativar sem revisão.

A API precisa de `DATABASE_URL` existente e `GOOGLE_FORMS_INTEGRATION_SECRET` novo, apenas no servidor. No Apps Script, configurar Script Properties `GOOGLE_FORMS_INTEGRATION_SECRET` e `GIRAFINHA_INTEGRATION_URL` (URL completa HTTPS terminada em `/api/integrations/google-forms/venue-event`). Nunca colocar segredos na folha, browser, código fonte ou logs. Este trabalho não altera nenhuma variável real.

## Antes de ativar

1. Confirmar que o ZIP corresponde ao `main` atual; rever diff contra o repositório remoto. Rever e aplicar **mais tarde** a migração `20260926113000_create_google_form_imports.sql`, com autorização específica.
2. A primeira linha da folha foi verificada por leitura em 26/09/2026; `Code.gs` usa índices 1-based e confirma o cabeçalho de cada coluna em cada execução. Antes da ativação, voltar a verificar a estrutura da folha e testar com uma resposta fictícia. A tabela de colunas abaixo corresponde ao estado observado; alterações ao formulário podem acrescentar ou deslocar colunas.
3. Rever categorias/preços ativos do catálogo `event_extras`. Os packs usam preço base fixo 250/400/550 sem depender do catálogo atualmente vazio. Não foi feito seed remoto.
4. Testar primeiro localmente sem credenciais nem banco real: `node --experimental-strip-types --test artifacts/api-server/src/integrations/google-forms.test.ts`. Patrícia fica em `needs_review` (sem festa); Adriana produz plano 400/60, pagamento parcial. Não enviar casos reais ao endpoint.
5. Para ativação futura: configurar segredos iguais nos dois servidores, publicar versão revista, instalar manualmente um trigger **From spreadsheet → On form submit** para `onGirafinhaFormSubmit`. Enviar uma resposta fictícia e verificar o registo de import e a festa, sem reimportar dados históricos automaticamente.

## Regras operacionais

O identificador é `spreadsheetId:sheetId:SHA256(timestamp + respostas capturadas)`, para continuar igual se a linha for movida. Uma edição posterior das respostas altera o identificador e requer revisão manual. A chave única `(form_id, submission_id)` e os bloqueios transacionais evitam duplicados; o segundo bloqueio usa data e telefone **normalizados**. Se existir festa na mesma data e telefone, regista `already_exists` sem alterar a festa ou pagamentos. Extras apenas se associam quando um processo autenticado indicar `extrasConfirmed: true` **e** o nome corresponder exatamente a um extra ativo do catálogo. O formulário atual nunca envia essa confirmação. Alterações posteriores do catálogo não afetam o preço copiado para a festa. O total continua editável na app.

As duas perguntas do formulário «Pretende adicionar algum extra?» e «Pretende adicionar algum serviço extra?» representam **pedidos**, não confirmação de preço. `Code.gs` envia-os como `requestedExtras` e `requestedService`: criam revisão, sem adicionar `event_selected_extras` nem cobrar. O campo técnico `extras` e `extrasConfirmed: true` só devem ser preenchidos por um processo futuro de confirmação explícita, nunca diretamente por essas perguntas. Falta de sinal válido ou de aceitação dos termos também gera revisão, sem festa automática. Os horários do PDF têm o formato `16:00h às 19:00h`; as autorizações são «Sim, com rostos visíveis», «Sim, com rostos tapados» ou «Não autorizo».

## Colunas verificadas na folha (26/09/2026)

| Coluna | Significado |
|---|---|
| A | Carimbo de data/hora |
| B | Email principal atual |
| C, D, E, F | Nome, telefone, email antigo, NIF, respetivamente; títulos duplicados distinguidos pela posição e formato |
| G, H, I | Criança, idade, data da festa |
| J | Horário antigo (fallback) |
| K–W | Pack, decoração, catering, pedidos de extras, alergias, imagens, sinal, pagamento, termos, origem e notas; índices exatos em `Code.gs` |
| X | Horário novo, preferido quando preenchido |
| Y | Pedido de serviço extra, sem preço confirmado |
| Z | Coluna 24, não usada |

Para desativar: remover/desativar o trigger instalado no Apps Script; opcionalmente desativar a variável do servidor em operação autorizada. Sem secret o endpoint rejeita pedidos. Dados importados já existentes não são apagados automaticamente.

## Limites antes da ativação

- Os imports com `needs_review` ficam guardados em `google_form_imports.payload`. O ecrã **Pedidos do Formulário** (`/google-forms-review`) permite aos utilizadores autenticados consultar os pendentes por páginas de 100 e apenas os campos relevantes. Permite deixar pendente, descartar com confirmação ou associar a uma festa já gravada com **a mesma data e telefone normalizado**. Uma festa que falte pode ser criada manualmente em Festas no Espaço e associada depois. Não cria festa automaticamente, não altera pagamentos ou extras. A API disponibiliza `GET /api/integrations/google-forms/review` (cursor opcional) e `POST /api/integrations/google-forms/review/:id/resolve` com Bearer token normal. Falhas de associação mantêm o pedido pendente; sem migração o ecrã indica que a lista está indisponível.
- A atomicidade e a migração foram revistas no código, mas ainda não foram ensaiadas contra uma base PostgreSQL de teste. Não apontar o endpoint para produção para os validar.
- O identificador derivado de timestamp e respostas é estável perante ordenação da folha, mas uma edição posterior da resposta muda o hash. Nessa situação, a verificação data + telefone evita criar outra festa; o conflito continua a precisar de revisão humana.
