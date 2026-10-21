# Preparação da importação do inventário de decoração — Girafinha

**Estado:** preparação / rascunho. **PROIBIDO executar alterações em produção sem aprovação expressa da gestão.**

## Fonte de verdade

Catálogo-mestre preparado em 21/10/2026, com **185 registos** de materiais, códigos estáveis e fotografias de referência. Entregáveis anexos à conversa de origem:

- `Inventario_Mestre_Girafinha_2026-10-21.xlsx`
- `Girafinha_Fotos_Referencias_2026-10-21.zip`
- `Girafinha_Integracao_Manifesto_REVER.json` (manifesto de pré-importação)
- `Girafinha_Integracao_Lote_Proposto.csv`

O manifesto coloca **171 registos** no lote *pronto para revisão*, **12 pendentes** e **2 materiais emprestados**, fora do stock próprio. Estes números são de **registos**, não necessariamente de unidades físicas, porque existem conjuntos e placas de quantidade desconhecida.

## Diagnóstico da app (consulta, sem mutações)

- Supabase `xxtyrjarnnmihrkseteo`: `public.inventory_items` e `public.inventory_movements` tinham **zero linhas** na verificação de 21/10/2026.
- O backend tem `GET /api/inventory/items` e `POST /api/inventory/items`, protegido por `requireAuth`.
- O `POST` cria o material **e** um movimento inicial (`reason='Stock inicial'`) na mesma transação.
- A tabela `inventory_items` **ainda não tem coluna única para o código do catálogo**; a proposta usa `P01 · Nome` como prefixo do nome, mas isto não é uma garantia transacional contra importações concorrentes.
- `photo_path` está reservado para imagens no Storage com caminho `material/{uuid}/...`. As fotografias no ZIP são **referências de festas**, não estão carregadas nesse Storage.
- A interface limita as categorias à lista existente em `artifacts/girafinha/src/pages/inventory.tsx`, por isso os grupos do catálogo foram mapeados para essas categorias, mantendo a secção detalhada no manifesto/observações.
- Os materiais emprestados **não** devem aparecer como stock próprio. Uma melhoria futura de `ownership_type` pode permitir apresentá-los num separador próprio.
- Campos como medidas (altura/largura/diâmetro), material de fabrico e compatibilidade das capas ainda não têm colunas próprias; são preservados no manifesto e nas notas da proposta.

## Preflight seguro (read-only)

Executar com Node 24:

```bash
node scripts/src/preflight-girafinha-catalog.mjs /caminho/Girafinha_Integracao_Manifesto_REVER.json
```

Para detetar duplicados em relação aos itens já existentes, entregar também um snapshot JSON (array) da resposta autenticada de `GET /api/inventory/items?itemType=material&active=true`:

```bash
node scripts/src/preflight-girafinha-catalog.mjs /caminho/manifesto.json /caminho/inventory-items-existentes.json
```

O script é **exclusivamente de leitura**: não tem `--apply`, não cria itens, não abre transações e não utiliza credenciais de base de dados.

## Antes de autorizar importação real

1. Aprovar os 171 registos propostos, rever dados provisórios e confirmar exclusões dos 12 pendentes e 2 emprestados.
2. Validar códigos/categorias, confrontar o inventário atual, e garantir que a interface encontra os novos artigos.
3. Para **garantia forte de não duplicação**, acrescentar `catalog_code` com constraint `UNIQUE` em migração e suporte nas rotas/validação da app; em alternativa, manter importador serial controlado e fazer verificação de existência em cada operação, aceitando o limite de concorrência.
4. Definir política de fotografias: identificar/cortar peças individuais e carregar ao Storage **após** existir UUID do item; não reutilizar screenshots integrais como se fossem imagens isoladas do objeto.
5. Testar migração/importação em ambiente descartável ou preview com base de dados isolada, e verificar os movimentos gerados.
6. Só após validação e nova autorização explícita, preparar a execução em produção com inventário inicial e resumo de sucesso/falhas.
7. Não mudar reservas, pagamentos, despesas, autenticação, RLS ou deploy de produção neste PR.

## Observação de segurança

Foi detetado um alerta do Supabase relativo a RLS desativado em `public.expenses` e `public.expense_categories`. É independente do inventário e **não está incluído** nesta preparação; requer revisão separada de políticas de acesso antes de qualquer alteração.

## Limite do trabalho deste PR

- Apenas documentação e validação sem escrita.
- Nenhuma importação de stock, fotografia, migração, alteração de schema, endpoint ou UI.
- O lote CSV/JSON é um artefacto de revisão do utilizador, não parte de um deploy automático.
