# Espaço Girafinha App

Aplicação interna para gestão de reservas, pagamentos, calendário, relatórios e workshops do Espaço Girafinha.

## Desenvolvimento local

```bash
corepack pnpm install
corepack pnpm --filter @workspace/girafinha run dev
```

A app abre em `http://localhost:5173/`.

O login em producao usa Supabase Auth. Em desenvolvimento local, garante que as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estao configuradas se quiseres testar o mesmo fluxo de login.

## Producao

- Repositorio da app: `espacogirafinha/app`
- Projeto Supabase da app: `Espaco Girafinha Reservas`
- Supabase project ref: `xxtyrjarnnmihrkseteo`
- Host da base de dados: `db.xxtyrjarnnmihrkseteo.supabase.co`
- Projeto Vercel da app: `app`
- Vercel project id: `prj_iTPDDaIx9bPQAmkuImroPElgiWdF`
- Subdominio pretendido: `reservas.espacogirafinha.pt`

Variaveis necessarias em producao:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

O ficheiro `.env.example` mostra o formato esperado. A password da base de dados deve ser obtida/definida no painel Supabase, nunca guardada no repositorio.

## Estrutura

- `artifacts/girafinha`: frontend Vite + React + TypeScript.
- `artifacts/api-server`: API Express para ambiente backend.
- `lib/api-client-react`: cliente React Query gerado.
- `lib/api-zod`: tipos e schemas gerados da API.
- `lib/db`: schema Drizzle/Postgres.

## Scripts principais

```bash
corepack pnpm run typecheck
corepack pnpm --filter @workspace/girafinha run build
```
