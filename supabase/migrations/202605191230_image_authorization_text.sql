alter table public.reservations
  alter column image_authorization type text
  using case
    when image_authorization is true then 'rosto_visivel'
    when image_authorization is false then 'nao_autorizo'
    else null
  end;
