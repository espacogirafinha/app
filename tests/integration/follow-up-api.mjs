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
  let notice=await request("/notifications");
  assert.equal(notice.status,200,"notification API must return successfully: "+JSON.stringify(notice)+" logs: "+output.slice(-3000));
  assert.equal(notice.data.items.filter(x=>x.type==="venue_preparation_30d").length,1);
  assert.equal(notice.data.unreadCount,1);

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
  const cancelledViaApi=await request("/venue-events/"+uuid(1),"PATCH",{status:"cancelled"});
  assert.equal(cancelledViaApi.status,200,"cancel venue party through actual API: "+JSON.stringify(cancelledViaApi));
  notice=await request("/notifications");
  assert.equal(notice.status,200,"notification API after cancellation");
  assert.equal(notice.data.items.filter(x=>x.type==="venue_preparation_30d").length,0,"cancelled party notification hidden, not physically deleted");
  assert.equal(notice.data.unreadCount,0,"cancelled D-30 not counted as unread");
  const preservedNotification=await pool.query("select count(*)::int as n from app_private.notifications where type='venue_preparation_30d'");
  assert.equal(preservedNotification.rows[0].n,1,"notification history retained");

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
  // Declined opportunity must never become stage-two eligible.
  await venue(6,utcDay(-340),"completed","926111222","Beatriz");
  assert.equal(await sync(),200);
  let declinedResponse=await request("/follow-up");
  let declined=declinedResponse.data.reactivations.find(x=>x.source.id===uuid(6));
  assert.ok(declined && declined.stage==="first","declined test opportunity starts eligible");
  assert.equal((await request("/follow-up/reactivation/"+declined.id,"PATCH",{action:"contact",stage:"first"})).status,204);
  assert.equal((await request("/follow-up/reactivation/"+declined.id,"PATCH",{action:"no_interest"})).status,204);
  declinedResponse=await request("/follow-up");
  declined=declinedResponse.data.reactivations.find(x=>x.source.id===uuid(6));
  assert.equal(declined.noInterest,true);
  assert.equal(declined.stage,null,"second-stage action must not appear");
  assert.equal(declined.firstContactedAt!==null,true);
  assert.equal(declined.secondContactedAt,null);
  assert.equal((await request("/follow-up/reactivation/"+declined.id,"PATCH",{action:"contact",stage:"second"})).status,409,"declined opportunity cannot mark second stage");
  const declinedPersisted=await pool.query("select no_interest_at,first_contacted_at,second_contacted_at from public.customer_reactivations where id=$1",[declined.id]);
  assert.ok(declinedPersisted.rows[0].no_interest_at);
  assert.ok(declinedPersisted.rows[0].first_contacted_at);
  assert.equal(declinedPersisted.rows[0].second_contacted_at,null);
  for(let i=0;i<3;i++)assert.equal(await sync(),200);
  const declinedAgain=(await request("/follow-up")).data.reactivations.find(x=>x.id===declined.id);
  assert.equal(declinedAgain.stage,null);
  assert.equal(declinedAgain.noInterest,true);
  console.log("NO_INTEREST PASS: first-contact preserved, second blocked over repeated sync");
  const finalCounts=await counts();
  for(let i=0;i<3;i++)assert.equal(await sync(),200);
  assert.deepEqual(await counts(),finalCounts,"repeated sync must not create extra records");
  console.log("INTEGRATION PASS",JSON.stringify({before:count,after:finalCounts}));
  for(const [port,writeFlag,vercelEnvironment] of [
    [4884,"false","development"],[4885,"true","preview"],
  ]){
    const disabled=spawn(process.execPath,["artifacts/api-server/dist/index.mjs"],{
      env:{...process.env,PORT:String(port),DATABASE_URL:databaseUrl,
        SUPABASE_URL:"http://127.0.0.1:4882",SUPABASE_ANON_KEY:"isolated",
        FOLLOW_UP_WRITES_ENABLED:writeFlag,VERCEL_ENV:vercelEnvironment,
        CRON_SECRET:"isolated-ci-secret",NODE_ENV:"production"},
      stdio:"ignore",
    });
    try {
      let ready=false;
      for(let i=0;i<70;i++){
        try{
          const r=await fetch("http://127.0.0.1:"+port+"/api/health");
          if(r.status<500){ready=true;break}
        }catch{}
        await new Promise(r=>setTimeout(r,150));
      }
      assert.ok(ready,"disabled/preview API must start");
      const base="http://127.0.0.1:"+port+"/api";
      const write=await fetch(base+"/follow-up/preparation/"+uuid(1),{
        method:"PATCH",headers:{Authorization:"Bearer isolated-test-token","Content-Type":"application/json"},
        body:JSON.stringify({field:"invitations",done:false}),
      });
      assert.equal(write.status,503,"disabled or preview must reject writes");
      const cron=await fetch(base+"/internal/follow-up-sync",{
        headers:{Authorization:"Bearer isolated-ci-secret"},
      });
      assert.equal(cron.status,503,"disabled or preview must reject authorized cron writes");
      assert.deepEqual(await counts(),finalCounts,"disabled/preview must not modify database");
    }finally{disabled.kill("SIGTERM")}
  }
  console.log("OPERATIONAL PROTECTION PASS: disabled and preview reject writes");
  // Time travel is injected only into a second disposable API process, never
  // into application code or Production. Historical 2027/2028 cycles coexist.
  await venue(71,"2026-01-20","completed","918112233","Íris");
  assert.equal(await sync(),200);
  const year27 = await pool.query("select * from public.customer_reactivations where source_venue_event_id=$1 and target_year=2027",[uuid(71)]);
  assert.equal(year27.rows.length,1,"2027 opportunity exists");
  const cycleId=year27.rows[0].id;
  assert.equal((await request("/follow-up/reactivation/"+cycleId,"PATCH",{action:"contact",stage:"first"})).status,204);
  assert.equal((await request("/follow-up/reactivation/"+cycleId,"PATCH",{action:"offer",type:"gift",description:"Mimo 2027",scope:"both"})).status,204);
  const untouched27=await pool.query("select id,first_due_date,second_due_date,first_contacted_at,second_contacted_at,no_interest_at,offer_type,offer_description,offer_proposed_at,offer_used_at,new_venue_event_id,new_external_event_id from public.customer_reactivations where id=$1",[cycleId]);
  const frozenApi=spawn(process.execPath,["--require","./tests/integration/follow-up-clock.cjs","artifacts/api-server/dist/index.mjs"],{
    env:{...process.env,PORT:"4886",SUPABASE_URL:"http://127.0.0.1:4882",SUPABASE_ANON_KEY:"isolated",
      FOLLOW_UP_WRITES_ENABLED:"true",CRON_SECRET:"isolated-ci-secret",
      VERCEL_ENV:"development",NODE_ENV:"production",DATABASE_URL:databaseUrl,
      CI_FOLLOW_UP_CLOCK:"2027-10-21T12:00:00Z"},
    stdio:["ignore","pipe","pipe"],
  });
  let frozenLogs="";frozenApi.stdout.on("data",v=>frozenLogs+=String(v));frozenApi.stderr.on("data",v=>frozenLogs+=String(v));
  try {
    let ready=false;
    for(let i=0;i<90;i++){try{const r=await fetch("http://127.0.0.1:4886/api/health");if(r.status<500){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,150))}
    assert.ok(ready,"time-shifted API startup: "+frozenLogs);
    const frozenBase="http://127.0.0.1:4886/api";
    async function frozenSync(){
      const r=await fetch(frozenBase+"/internal/follow-up-sync",{headers:{Authorization:"Bearer isolated-ci-secret"}});
      assert.equal(r.status,200,"time-shift sync "+(await r.text())+" "+frozenLogs.slice(-500));
    }
    await frozenSync();
    const cycles=await pool.query("select id,target_year,first_contacted_at,offer_description from public.customer_reactivations where source_venue_event_id=$1 order by target_year",[uuid(71)]);
    assert.deepEqual(cycles.rows.map(r=>Number(r.target_year)),[2027,2028],"independent annual 2027 and 2028 cycles");
    assert.notEqual(cycles.rows[0].id,cycles.rows[1].id);
    const preserved=await pool.query("select id,first_due_date,second_due_date,first_contacted_at,second_contacted_at,no_interest_at,offer_type,offer_description,offer_proposed_at,offer_used_at,new_venue_event_id,new_external_event_id from public.customer_reactivations where id=$1",[cycleId]);
    assert.deepEqual(preserved.rows[0],untouched27.rows[0],"2027 commercial history cannot change while generating 2028");
    const beforeCycles=await counts();
    for(let n=0;n<3;n++) await frozenSync();
    assert.deepEqual(await counts(),beforeCycles,"2028 cycle created exactly once");
    console.log("MULTI_YEAR_CYCLES PASS",JSON.stringify({years:cycles.rows.map(r=>Number(r.target_year)),count:cycles.rows.length}));

    // A newly reserved 2027 venue becomes the source for future 2028
    // reactivation and blocks 2028 contact from the older party.
    await venue(72,"2026-01-20","completed","917112233","Inês");
    await venue(73,"2027-01-18","completed","917112233","Inês");
    await frozenSync();
    const superseded=await pool.query("select target_year,new_venue_event_id from public.customer_reactivations where source_venue_event_id=$1 order by target_year",[uuid(72)]);
    assert.deepEqual(superseded.rows.map(row=>Number(row.target_year)),[2027]);
    assert.equal(superseded.rows[0].new_venue_event_id,uuid(73));
    const successor=await pool.query("select target_year from public.customer_reactivations where source_venue_event_id=$1",[uuid(73)]);
    assert.ok(successor.rows.some(row=>Number(row.target_year)===2028),"new celebration can become reference");
    const noCompetingContact=await fetch(frozenBase+"/follow-up",{headers:{authorization:"Bearer isolated-test-token"}});
    assert.equal(noCompetingContact.status,200);
    const state=await noCompetingContact.json();
    assert.ok(!state.reactivations.some(row=>row.source.id===uuid(72) && row.stage!==null),"old source never creates a competing contact");
    const complete=await counts();
    for(let n=0;n<3;n++)await frozenSync();
    assert.deepEqual(await counts(),complete,"no concurrency or duplicates after conversion");
    console.log("REBOOKING_CHAIN PASS");
  }finally{frozenApi.kill("SIGTERM")}

}finally{
 child.kill("SIGTERM");await new Promise(r=>auth.close(r));await pool.end();
}
