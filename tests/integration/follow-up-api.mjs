import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
const pg = createRequire(new URL("../../lib/db/package.json", import.meta.url))("pg");

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl?.includes("127.0.0.1"), "Integration test must use localhost Postgres");
const pool = new pg.Pool({connectionString:databaseUrl});
const uuid = n => "00000000-0000-4000-8000-" + String(n).padStart(12,"0");
const utcDay = delta => {
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const [y,m,d] = today.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d+delta,12)).toISOString().slice(0,10);
};
const auth = createServer((req,res)=>{
  if(req.url === "/auth/v1/user" && req.headers.authorization === "Bearer isolated-test-token"){
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({id:uuid(900),email:"test@example.invalid"}));
  } else { res.writeHead(401);res.end(); }
});
await new Promise(resolve=>auth.listen(4882,"127.0.0.1",resolve));
const child=spawn(process.execPath,["artifacts/api-server/dist/index.mjs"],{
  env:{...process.env,PORT:"4883",SUPABASE_URL:"http://127.0.0.1:4882",SUPABASE_ANON_KEY:"isolated",
  FOLLOW_UP_WRITES_ENABLED:"true",CRON_SECRET:"isolated-ci-secret",VERCEL_ENV:"development",
  NODE_ENV:"production",DATABASE_URL:databaseUrl},stdio:["ignore","pipe","pipe"]
});
let output="";child.stdout.on("data",v=>output+=String(v));child.stderr.on("data",v=>output+=String(v));
const endpoint="http://127.0.0.1:4883/api";
async function request(path,method="GET",body,token="isolated-test-token"){
  const r=await fetch(endpoint+path,{method,headers:{authorization:"Bearer "+token,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  let data=null;try{data=await r.json()}catch{}
  return {status:r.status,data};
}
async function sync(token="isolated-ci-secret"){
  const response=await fetch(endpoint+"/internal/follow-up-sync",{headers:{authorization:"Bearer "+token}});
  return response.status;
}
async function counts(){
  const result=await pool.query("select (select count(*)::int from public.event_checklists where title='Preparação D-30') checklists,(select count(*)::int from public.event_checklist_items where label in ('Convites tratados','Material tratado')) tasks,(select count(*)::int from app_private.notifications where type='venue_preparation_30d') notifications,(select count(*)::int from public.customer_reactivations) reactivations");
  return result.rows[0];
}
async function venue(n,day,status="confirmed",phone="912345678",child="Matilde"){
 await pool.query("insert into public.venue_events(id,customer_name,birthday_child_name,phone,event_date,status,party_theme,pack_name,total_price) values($1,$2,$3,$4,$5,$6,'Princesas','Premium',550)",[uuid(n),"Ana",child,phone,day,status]);
}
try{
  for(let n=0;n<80;n++){try{const r=await fetch(endpoint+"/health");if(r.status<500)break}catch{}await new Promise(r=>setTimeout(r,200));}
  assert.equal(child.exitCode,null,"API process exited: "+output);
  assert.equal(await sync("wrong"),401,"Invalid cron secret must reject");
  await venue(1,utcDay(30));
  assert.equal(await sync(),200,"cron sync should succeed");
  let count=await counts();
  assert.deepEqual(count,{checklists:1,tasks:2,notifications:1,reactivations:0});
  assert.equal(await sync(),200);
  assert.deepEqual(await counts(),count,"D-30 cron must be idempotent");
  let page=await request("/follow-up");
  assert.equal(page.status,200,JSON.stringify(page));
  assert.equal(page.data.preparationCount,1);
  assert.equal(await request("/follow-up/preparation/"+uuid(1),"PATCH",{field:"invitations",done:true}).then(r=>r.status),204);
  page=await request("/follow-up");
  assert.equal(page.data.preparations[0].invitationsDone,true);
  assert.equal(page.data.preparations[0].materialsDone,false);
  assert.equal(await request("/follow-up/preparation/"+uuid(1),"PATCH",{field:"materials",done:true}).then(r=>r.status),204);
  page=await request("/follow-up");
  assert.equal(page.data.preparationCount,0);
  assert.equal(await sync(),200);
  assert.deepEqual(await counts(),count,"completed tasks never recreated");
  await pool.query("update public.venue_events set event_date=$2 where id=$1",[uuid(1),utcDay(50)]);
  assert.equal(await sync(),200);
  assert.deepEqual(await counts(),count,"rescheduling must preserve checklist and notification");
  await pool.query("update public.venue_events set event_date=$2 where id=$1",[uuid(1),utcDay(12)]);
  assert.equal(await sync(),200);
  assert.deepEqual(await counts(),count);
  await pool.query("update public.venue_events set status='cancelled' where id=$1",[uuid(1)]);
  page=await request("/follow-up");
  assert.equal(page.data.preparationCount,0);
  assert.equal(await sync(),200);
  assert.deepEqual(await counts(),count);

  // Completed event from the previous annual cycle. Both stages already due,
  // but first contact has priority until explicitly completed.
  await venue(2,utcDay(-340),"completed","934123456","Leonor");
  assert.equal(await sync(),200);
  page=await request("/follow-up");
  let opportunity=page.data.reactivations.find(x=>x.source.id===uuid(2));
  assert.ok(opportunity,"annual reactivation exists");
  assert.equal(opportunity.stage,"first");
  assert.equal(opportunity.firstContactedAt,null,"opening prefilled WhatsApp is a client-only action");
  const id=opportunity.id;
  assert.equal(await request("/follow-up/reactivation/"+id,"PATCH",{action:"contact",stage:"first"}).then(r=>r.status),204);
  assert.equal(await request("/follow-up/reactivation/"+id,"PATCH",{action:"contact",stage:"first"}).then(r=>r.status),409);
  page=await request("/follow-up");
  opportunity=page.data.reactivations.find(x=>x.id===id);
  assert.ok(opportunity.firstContactedAt);
  assert.equal(opportunity.stage,"second");
  for(const scope of ["venue_only","external_only","both"]){
    assert.equal(await request("/follow-up/reactivation/"+id,"PATCH",{action:"offer",type:"fixed",value:10,scope,description:"Regresso"}).then(r=>r.status),204);
    const row=await pool.query("select offer_scope from public.customer_reactivations where id=$1",[id]);
    assert.equal(row.rows[0].offer_scope,scope);
  }
  assert.equal(await request("/follow-up/reactivation/"+id,"PATCH",{action:"contact",stage:"second"}).then(r=>r.status),204);
  assert.equal(await request("/follow-up/reactivation/"+id,"PATCH",{action:"contact",stage:"second"}).then(r=>r.status),409);
  const contacted=await pool.query("select first_contacted_at,second_contacted_at,offer_proposed_at from public.customer_reactivations where id=$1",[id]);
  assert.ok(contacted.rows[0].second_contacted_at);
  assert.ok(contacted.rows[0].offer_proposed_at);
  assert.equal(await request("/follow-up/reactivation/"+id,"PATCH",{action:"offer",type:"percent",value:5,scope:"both"}).then(r=>r.status),204);
  const afterProposed=await pool.query("select offer_type,offer_value from public.customer_reactivations where id=$1",[id]);
  assert.equal(afterProposed.rows[0].offer_type,"fixed","already proposed offer must remain fixed");
  await venue(3,utcDay(40),"confirmed","934123456","Leonor");
  assert.equal(await sync(),200);
  page=await request("/follow-up");
  opportunity=page.data.reactivations.find(x=>x.id===id);
  assert.equal(opportunity.converted,true);
  assert.equal(opportunity.conversion.kind,"venue_event");
  assert.equal(opportunity.stage,null);
  const financial=await pool.query("select total_price from public.venue_events where id=$1",[uuid(3)]);
  assert.equal(Number(financial.rows[0].total_price),550,"offer cannot change event price");
  assert.equal(await sync(),200);
  const c2=await counts();
  assert.equal(c2.reactivations,1);
  // Another completed event with a matching external service requires review.
  await venue(4,utcDay(-340),"completed","961234567","Lourenço");
  await pool.query("insert into public.external_events(id,customer_name,phone,event_date,status,total_price) values($1,'Outro','961234567',$2,'confirmed',200)",[uuid(5),utcDay(39)]);
  assert.equal(await sync(),200);
  page=await request("/follow-up");
  const external=page.data.reactivations.find(x=>x.source.id===uuid(4));
  assert.equal(external.needsReview,true);
  assert.equal(external.stage,null);
  assert.equal(await request("/follow-up/reactivation/"+external.id,"PATCH",{action:"convert",kind:"external_event",bookingId:uuid(5)}).then(r=>r.status),204);
  page=await request("/follow-up");
  assert.equal(page.data.reactivations.find(x=>x.id===external.id).conversion.kind,"external_event");
  assert.equal(await request("/follow-up/reactivation/"+external.id,"PATCH",{action:"convert",kind:"venue_event",bookingId:uuid(3)}).then(r=>r.status),409);
  const finalCounts=await counts();
  for(let i=0;i<3;i++)assert.equal(await sync(),200);
  assert.deepEqual(await counts(),finalCounts,"repeated sync must not create extra records");
  console.log("INTEGRATION PASS",JSON.stringify({before:count,after:finalCounts}));
}finally{
 child.kill("SIGTERM");await new Promise(r=>auth.close(r));await pool.end();
}
