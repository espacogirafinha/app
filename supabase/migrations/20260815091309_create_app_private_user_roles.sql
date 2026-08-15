create schema if not exists app_private;

revoke all privileges on schema app_private from public, anon, authenticated;

create table app_private.user_roles (
  user_id uuid primary key,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint user_roles_role_check check (role in ('admin', 'staff')),
  constraint user_roles_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint user_roles_updated_by_fkey
    foreign key (updated_by)
    references auth.users (id)
    on delete set null
);

alter table app_private.user_roles enable row level security;

revoke all privileges on table app_private.user_roles
from public, anon, authenticated;
