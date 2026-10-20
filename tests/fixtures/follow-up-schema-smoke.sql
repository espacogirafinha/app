\set ON_ERROR_STOP on
insert into public.venue_events(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.external_events(id) values ('22222222-2222-4222-8222-222222222222');
insert into public.event_checklists(module,entity_id,title)
 values ('venue_events','11111111-1111-4111-8111-111111111111','Preparação D-30') on conflict do nothing;
insert into public.event_checklists(module,entity_id,title)
 values ('venue_events','11111111-1111-4111-8111-111111111111','Preparação D-30') on conflict do nothing;
do $$ begin
  if (select count(*) from public.event_checklists where title='Preparação D-30')<>1
    then raise exception 'Duplicate checklist'; end if;
end $$;
insert into public.event_checklist_items(checklist_id,label)
  select id,'Convites tratados' from public.event_checklists;
insert into public.event_checklist_items(checklist_id,label)
  select id,'Convites tratados' from public.event_checklists
  on conflict do nothing;
do $$ begin
  if (select count(*) from public.event_checklist_items where label='Convites tratados')<>1
    then raise exception 'Duplicate checklist task'; end if;
end $$;
insert into app_private.notifications(type,title,message,venue_event_id,destination,source_key)
 values ('venue_preparation_30d','Test','Test',
 '11111111-1111-4111-8111-111111111111','/venue-events?open=1','venue-preparation-30d:1')
 on conflict do nothing;
insert into app_private.notifications(type,title,message,venue_event_id,destination,source_key)
 values ('venue_preparation_30d','Test','Test',
 '11111111-1111-4111-8111-111111111111','/venue-events?open=1','venue-preparation-30d:1')
 on conflict do nothing;
do $$ begin
  if (select count(*) from app_private.notifications where type='venue_preparation_30d')<>1
    then raise exception 'Duplicate D-30 notification'; end if;
end $$;
insert into public.customer_reactivations(source_venue_event_id,target_year,estimated_event_date,first_due_date,second_due_date)
 values ('11111111-1111-4111-8111-111111111111',2027,'2027-01-20','2026-10-20','2026-12-09')
 on conflict do nothing;
insert into public.customer_reactivations(source_venue_event_id,target_year,estimated_event_date,first_due_date,second_due_date)
 values ('11111111-1111-4111-8111-111111111111',2028,'2028-01-20','2027-10-20','2027-12-09')
 on conflict do nothing;
do $$ begin
  if (select count(*) from public.customer_reactivations)<>2
    then raise exception 'Distinct annual cycles not preserved'; end if;
end $$;
-- Invalid simultaneous conversion must be rejected.
do $$ begin
  begin
    update public.customer_reactivations
      set new_venue_event_id='11111111-1111-4111-8111-111111111111',
          new_external_event_id='22222222-2222-4222-8222-222222222222';
    raise exception 'Both conversions were accepted';
  exception when check_violation then null;
  end;
end $$;
select 'follow-up-schema-smoke PASS' as result;
