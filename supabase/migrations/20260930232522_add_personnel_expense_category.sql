insert into public.expense_categories (name, is_active, sort_order)
values ('Pessoal / Colaboradores', true, 35)
on conflict (name) do nothing;
