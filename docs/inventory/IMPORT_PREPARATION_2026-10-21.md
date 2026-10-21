# Girafinha — importação de catálogo de decoração, em preparação

**Estado:** PR #72, rascunho. **Não houve importação de dados em Production, migração aplicada ou merge.**

## Fontes de dados

O catálogo-mestre foi entregue à gestão por ficheiros privados na conversa:
- `Inventario_Mestre_Girafinha_2026-10-21.xlsx`
- `Girafinha_Integracao_Manifesto_REVER.json`
- `Girafinha_Integracao_Lote_Proposto.csv`
- `Girafinha_Fotos_Referencias_2026-10-21.zip`

**Não adicionar o manifesto real ou fotos de festas ao repositório público.** Contém referências e dados comerciais da Girafinha.

## Resultado da validação do catálogo

- 185 registos / 185 códigos únicos;
- 171 próprios preparados para revisão, 12 pendentes e 2 empréstimos fora do stock próprio;
- 35 fotografias de referência JPEG presentes, legíveis e inferiores a 5 MB;
- medidas e modelos provisórios continuam marcados para validação;
- fotografias de cenários não são fotografias recortadas individuais e não foram inseridas no Storage.

## Implementação sem produção

### Validação de leitura
```bash
node scripts/src/preflight-girafinha-catalog.mjs /caminho/manifesto.json
```

### Preparação e SQL para ambiente descartável (não executa)
```bash
node scripts/src/girafinha-inventory-preview.mjs /caminho/manifesto.json \
  --photos-dir /caminho/Fotos \
  --out /tmp/girafinha-preview.sql
```

Opcional: fornecer um snapshot JSON já existente (array de objetos da API) com `--existing /caminho/existing.json` para saltar códigos já presentes.

O script:
- rejeita códigos repetidos e quantidades inválidas;
- exclui empréstimos e linhas pendentes;
- verifica que todas as referências fotográficas existem e são JPEG;
- prepara INSERT com `ON CONFLICT DO NOTHING` e movimento inicial para novos artigos;
- gera texto SQL, **sem abrir ligações, sem chaves Supabase e sem modo `--apply`**.

### SQL para ambiente descartável — NÃO Production

Existe **apenas uma proposta de migração**, em `supabase/migrations/20261021160000_inventory_catalog_code_unique_preview.sql`.
Cria índice único funcional sobre o código prefixado no nome de materiais e permite importações idempotentes.

Para a executar e importar dados seria necessário, após auditoria do alvo:
1. Criar um PostgreSQL efémero ou uma branch Supabase isolada **sem acesso às credenciais de produção**.
2. Validar o esquema real do inventário e aplicar, apenas nesse alvo, a migração proposta.
3. Ler e auditar o SQL gerado antes de o executar.
4. Usar, na sessão de teste, `SET app.girafinha_import_target = 'isolated';` antes de executar o SQL.
5. Validar contagens de artigos, movimentos e fotografias; repetir e assegurar idempotência.

**A variável de sessão não comprova por si só o destino:** é obrigatória uma revisão independente do host/projeto. Não executar SQL preparado no Supabase da produção mesmo que a variável seja definida.

## Testes automáticos

Workflow `.github/workflows/inventory-preview.yml`:
- testes Node `node:test`: categorização, prefixos estáveis, ausência de empréstimos, deduplicação, quantidades, imagens, SQL escapado, bloqueio de Production;
- teste de **PostgreSQL 16 temporário em GitHub Actions**, com migração proposta e dados fictícios;
- verifica duas inserções e dois movimentos iniciais, reimportação sem duplicados, constraint unique e bloqueio antes da confirmação de alvo;
- sem DATABASE_URL ou chaves Supabase.

A execução da workflow no commit `f6666e0` concluiu com **success**. Consultar Actions e confirmar novamente em commits posteriores.

## Estado da aplicação

A Preview Vercel previamente existente nesta branch antecede a implementação do importador e **não demonstra uma visualização dos materiais dentro da app**. A implementação atual é de pré-importação segura, não um novo ecrã ou serviço de importação da aplicação.

Antes de apresentar dados reais em Vercel Preview, é necessário assegurar uma base de dados dedicada: as configurações Preview da Vercel podem apontar para a BD de Production. Criar uma branch Supabase poderá ter custos e requer confirmação prévia.

## Proteções e próximas fases

- Nenhuma alteração nos fluxos de reservas, pagamentos, acompanhamento, autenticação, routing, finanças, cron ou RLS;
- empréstimos não são stock próprio e não podem entrar no lote importado;
- pendências exigem revisão humana;
- fotos originais não são carregadas automaticamente para Supabase Storage;
- depois de validado o ambiente Preview isolado, testar o lote real completo, fotos de produto e UI;
- **nenhuma promoção/merge/aplicação em Production sem aprovação explícita da gestão**.

Observação separada: a auditoria inicial do Supabase identificou RLS desligado em `expenses` e `expense_categories`. Não alterar estas tabelas neste PR.
