import { Router, type IRouter } from "express";
import { requireSettingsAdmin } from "../lib/settings-access";
import { pool } from "@workspace/db";
import {
  cycleDates, todayPortugal, resolveConversion, normalizePortuguesePhone,
  type VenueRecord as VenueForFollowUp, type ExternalRecord as ExternalForFollowUp,
} from "../lib/follow-up-rules";

const router: IRouter = Router();
// Explicit activation only after the database migration is approved and applied.
// Preview deployments never write operational data, including if the flag is set.
const WRITES_ENABLED = process.env.FOLLOW_UP_WRITES_ENABLED === "true" && process.env.VERCEL_ENV !== "preview";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type VenueRow = {
  id: string; customer_name: string; birthday_child_name: string | null;
  phone: string; event_date: string; status: string;
  party_theme: string | null; pack_name: string;
};
type ExternalRow = {
  id: string; customer_name: string; phone: string; event_date: string;
  status: string; event_type: string | null;
};

function dateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
function venue(row: VenueRow): VenueForFollowUp {
  return { id: row.id, customerName: row.customer_name,
    birthdayChildName: row.birthday_child_name, phone: row.phone,
    eventDate: dateString(row.event_date), status: row.status };
}
function external(row: ExternalRow): ExternalForFollowUp {
  return { id: row.id, customerName: row.customer_name,
    phone: row.phone, eventDate: dateString(row.event_date),
    status: row.status, eventType: row.event_type };
}
function remainingDays(date: string, today: string) {
  return Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86_400_000);
}
async function loadSources() {
  const [venues, externals] = await Promise.all([
    pool.query<VenueRow>("select id, customer_name, birthday_child_name, phone, event_date, status, party_theme, pack_name from public.venue_events"),
    pool.query<ExternalRow>("select id, customer_name, phone, event_date, status, event_type from public.external_events"),
  ]);
  return { venues: venues.rows, externals: externals.rows };
}

// Idempotent writes use database uniqueness. The notification is created only once per event,
// regardless of how many times the Dashboard is opened.
async function reconcile(today: string, venues: VenueRow[]) {
  for (const event of venues) {
    const source = venue(event);
    if (event.status !== "cancelled" && source.eventDate >= today && remainingDays(source.eventDate, today) <= 30) {
      await pool.query(
        "insert into public.venue_preparation_states(venue_event_id) values ($1) on conflict (venue_event_id) do nothing",
        [event.id],
      );
      const child = event.birthday_child_name?.trim() || "criança";
      await pool.query(
        `insert into app_private.notifications
          (type,title,message,venue_event_id,destination,source_key)
         values ('venue_preparation_30d',$1,$2,$3,$4,$5)
         on conflict do nothing`,
        [
          "Preparação de festa",
          `A festa da ${child} é daqui a ${remainingDays(source.eventDate, today)} dias. Tratar convites e material.`,
          event.id,
          `/venue-events?open=${event.id}`,
          `venue-preparation-30d:${event.id}`,
        ],
      );
    }
    if (event.status !== "completed" || !normalizePortuguesePhone(event.phone) || !event.birthday_child_name?.trim()) continue;
    const dates = cycleDates(source.eventDate);
    if (dates.firstDue > today) continue;
    await pool.query(
      `insert into public.customer_reactivations
        (source_venue_event_id,target_year,estimated_event_date,first_due_date,second_due_date,
         offer_type,offer_description,offer_value,offer_scope)
       select $1,$2,$3,$4,$5,offer_type,offer_description,offer_value,offer_scope
       from (select * from public.reactivation_campaign_settings where id='default'
         union all
         select 'default','none','',null,'both',now()
         where not exists(select 1 from public.reactivation_campaign_settings where id='default')
       ) settings
       on conflict(source_venue_event_id,target_year) do update
       set estimated_event_date=excluded.estimated_event_date,
           first_due_date=excluded.first_due_date, second_due_date=excluded.second_due_date,
           updated_at=now()`,
      [event.id, Number(dates.nextPartyEstimate.slice(0, 4)), dates.nextPartyEstimate, dates.firstDue, dates.secondDue],
    );
  }
}

export async function refreshDueNotifications(): Promise<void> {
  if (!WRITES_ENABLED) return;
  const { venues } = await loadSources();
  await reconcile(todayPortugal(), venues);
}

router.get("/follow-up", async (_req, res): Promise<void> => {
  try {
    const today = todayPortugal();
    const { venues, externals } = await loadSources();
    if (WRITES_ENABLED) await reconcile(today, venues);
    const [preps, react, campaign] = await Promise.all([
      pool.query("select * from public.venue_preparation_states"),
      pool.query("select * from public.customer_reactivations order by first_due_date"),
      pool.query("select * from public.reactivation_campaign_settings where id='default'"),
    ]);
    const prepById = new Map(preps.rows.map(row => [row.venue_event_id, row]));
    const validVenues = venues.map(venue);
    const validExternals = externals.map(external);
    const preparations = venues.filter(event =>
      event.status !== "cancelled" && dateString(event.event_date) >= today &&
      remainingDays(dateString(event.event_date), today) <= 30
    ).map(event => {
      const state = prepById.get(event.id);
      return {
        ...venue(event), theme: event.party_theme, packName: event.pack_name,
        daysRemaining: remainingDays(dateString(event.event_date), today),
        invitationsDone: Boolean(state?.invitations_done),
        materialsDone: Boolean(state?.materials_done),
      };
    }).filter(event => !event.invitationsDone || !event.materialsDone);
    const byId = new Map(venues.map(row => [row.id, row]));
    const reactivations = react.rows.flatMap(row => {
      const original = byId.get(row.source_venue_event_id);
      if (!original || original.status !== "completed") return [];
      const source = venue(original);
      const match = resolveConversion(source, validVenues, validExternals);
      const manualConversion = row.new_venue_event_id ? { kind: "venue_event", id: row.new_venue_event_id }
        : row.new_external_event_id ? { kind: "external_event", id: row.new_external_event_id } : null;
      const conversion = manualConversion ?? (match.status === "confirmed" ? match.conversion : null);
      const noInterest = row.no_interest_at !== null;
      const stage = !row.first_contacted_at && dateString(row.first_due_date) <= today ? "first" :
        !row.second_contacted_at && dateString(row.second_due_date) <= today ? "second" : null;
      return [{
        id: row.id, source, theme: original.party_theme, packName: original.pack_name,
        estimate: dateString(row.estimated_event_date),
        firstDue: dateString(row.first_due_date), secondDue: dateString(row.second_due_date),
        firstContactedAt: row.first_contacted_at, secondContactedAt: row.second_contacted_at,
        stage: conversion || noInterest || match.status === "needs_review" ? null : stage,
        needsReview: match.status === "needs_review" && !conversion,
        reviewCandidates: match.status === "needs_review" ? match.candidates : [],
        converted: Boolean(conversion), conversion, noInterest,
        offer: { type: row.offer_type, value: row.offer_value === null ? null : Number(row.offer_value),
          description: row.offer_description, scope: row.offer_scope,
          proposedAt: row.offer_proposed_at, usedAt: row.offer_used_at },
      }];
    });
    res.json({
      preparations,
      reactivations,
      campaign: campaign.rows[0] ?? { offer_type:"none", offer_description:"", offer_value:null, offer_scope:"both" },
      preparationCount: preparations.length,
      contactCount: reactivations.filter(item => item.stage !== null).length,
    });
  } catch (error) {
    console.error("Follow-up retrieval failed", error);
    res.status(500).json({ error: "Não foi possível carregar o acompanhamento." });
  }
});

router.use("/follow-up", (_req, res, next) => {
  if (WRITES_ENABLED) return next();
  res.status(503).json({ error: "Acompanhamento ainda não ativado. Migration pendente de aprovação." });
});

router.patch("/follow-up/preparation/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const field = req.body?.field;
  const done = req.body?.done;
  if (!UUID.test(id) || !["invitations", "materials"].includes(field) || typeof done !== "boolean") {
    res.status(400).json({ error: "Pedido inválido" }); return;
  }
  const key = field === "invitations" ? "invitations" : "materials";
  try {
    const result = await pool.query(
      `update public.venue_preparation_states set ${key}_done=$2,
       ${key}_done_at=case when $2 then now() else null end, updated_at=now()
       where venue_event_id=$1 and exists(
         select 1 from public.venue_events v where v.id=$1 and v.status<>'cancelled'
       ) returning venue_event_id`, [id, done],
    );
    if (!result.rowCount) { res.status(404).json({ error: "Tarefa não encontrada" }); return; }
    res.sendStatus(204);
  } catch { res.status(500).json({ error: "Erro ao atualizar a preparação" }); }
});

router.patch("/follow-up/reactivation/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const action = req.body?.action;
  if (!UUID.test(id)) { res.status(400).json({ error: "Oportunidade inválida" }); return; }
  try {
    if (action === "contact") {
      const stage = req.body?.stage;
      if (stage !== "first" && stage !== "second") { res.status(400).json({ error: "Etapa inválida" }); return; }
      // A server-side eligibility check prevents stale UI from allowing a repeated message.
      const sources = await loadSources();
      const current = await pool.query(
        "select * from public.customer_reactivations where id=$1", [id],
      );
      const record = current.rows[0];
      const sourceRow = sources.venues.find(v => v.id === record?.source_venue_event_id);
      if (!record || !sourceRow || sourceRow.status !== "completed" || record.no_interest_at ||
          record.new_venue_event_id || record.new_external_event_id) {
        res.status(409).json({ error: "Contacto não permitido" }); return;
      }
      const match = resolveConversion(venue(sourceRow), sources.venues.map(venue), sources.externals.map(external));
      if (match.status !== "none") { res.status(409).json({ error: "Nova reserva ou correspondência para rever" }); return; }
      const col = stage === "first" ? "first_contacted_at" : "second_contacted_at";
      const due = stage === "first" ? "first_due_date" : "second_due_date";
      const result = await pool.query(
        `update public.customer_reactivations set ${col}=now(), updated_at=now(),
          offer_proposed_at=case when $2='second' and offer_type<>'none' then coalesce(offer_proposed_at,now()) else offer_proposed_at end
         where id=$1 and ${col} is null and ${due}<= $3::date and no_interest_at is null
         returning id`, [id, stage, todayPortugal()],
      );
      if (!result.rowCount) { res.status(409).json({ error: "Etapa já concluída ou ainda indisponível" }); return; }
      res.sendStatus(204); return;
    }
    if (action === "no_interest") {
      await pool.query("update public.customer_reactivations set no_interest_at=coalesce(no_interest_at,now()),updated_at=now() where id=$1", [id]);
      res.sendStatus(204); return;
    }
    if (action === "offer") {
      const { type, description, value, scope } = req.body;
      if (!["none","fixed","percent","gift","custom"].includes(type) ||
        !["venue_only","external_only","both"].includes(scope) ||
        ((type === "fixed" || type === "percent") && (!Number.isFinite(value) || value <= 0 || (type === "percent" && value > 100))) ||
        (["gift","custom"].includes(type) && !String(description ?? "").trim())) {
        res.status(400).json({ error: "Oferta inválida" }); return;
      }
      await pool.query(
        `update public.customer_reactivations set
          offer_type=$2, offer_description=$3, offer_value=$4, offer_scope=$5, updated_at=now()
         where id=$1 and offer_used_at is null`,
        [id,type,String(description ?? ""),["fixed","percent"].includes(type) ? value : null,scope],
      );
      res.sendStatus(204); return;
    }
    if (action === "convert") {
      const kind = req.body?.kind;
      const bookingId = String(req.body?.bookingId ?? "");
      if (!UUID.test(bookingId) || !["venue_event","external_event"].includes(kind)) {
        res.status(400).json({ error: "Nova reserva inválida" }); return;
      }
      const table = kind === "venue_event" ? "venue_events" : "external_events";
      const column = kind === "venue_event" ? "new_venue_event_id" : "new_external_event_id";
      const check = await pool.query(`select id from public.${table} where id=$1 and status<>'cancelled'`, [bookingId]);
      if (!check.rowCount) { res.status(404).json({ error: "Reserva não encontrada" }); return; }
      const result = await pool.query(
        `update public.customer_reactivations set ${column}=$2,updated_at=now()
        where id=$1 and new_venue_event_id is null and new_external_event_id is null returning id`,
        [id, bookingId],
      );
      if (!result.rowCount) { res.status(409).json({ error: "Já existe conversão" }); return; }
      res.sendStatus(204); return;
    }
    res.status(400).json({ error: "Operação inválida" });
  } catch (error) {
    console.error("Follow-up update failed", error);
    res.status(500).json({ error: "Não foi possível atualizar a oportunidade." });
  }
});
export default router;
