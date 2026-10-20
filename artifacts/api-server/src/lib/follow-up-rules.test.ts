import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonths, cycleDates, normalizePortuguesePhone, resolveConversion,
  type VenueRecord, type ExternalRecord,
} from "./follow-up-rules.ts";

const old: VenueRecord = {
  id:"old", customerName:"Ana Silva", birthdayChildName:"Matilde Silva",
  phone:"912 345 678", eventDate:"2026-01-20", status:"completed",
};
const next: VenueRecord = {
  ...old, id:"new", eventDate:"2027-01-15", status:"confirmed",
  phone:"+351912345678", birthdayChildName:"Matilde Silva",
};
const outside: ExternalRecord = {
  id:"external", customerName:"Ana Silva", phone:"912345678",
  eventDate:"2027-01-19", eventType:"Decoração", status:"confirmed",
};
test("annual follow-ups preserve 3 months and 42 days", () => {
  assert.deepEqual(cycleDates("2026-01-20"), {
    nextPartyEstimate:"2027-01-20",firstDue:"2026-10-20",secondDue:"2026-12-09",
  });
  assert.equal(addMonths("2024-01-31",1),"2024-02-29");
});
test("phones must be valid Portuguese numbers", () => {
  assert.equal(normalizePortuguesePhone("+351 912 345 678"),"351912345678");
  assert.equal(normalizePortuguesePhone("000"),null);
});
test("a unique child-and-phone venue match converts automatically", () => {
  assert.deepEqual(resolveConversion(old,[old,next],[]),{
    status:"confirmed",conversion:{kind:"venue_event",id:"new"},
  });
});
test("external services with same phone always require manual review", () => {
  assert.deepEqual(resolveConversion(old,[old],[outside]),{
    status:"needs_review",candidates:[{kind:"external_event",id:"external"}],
  });
});
test("different phone, next cycle, cancellation prevent external suggestions", () => {
  assert.equal(resolveConversion(old,[old],[{...outside,phone:"934123456"}]).status,"none");
  assert.equal(resolveConversion(old,[old],[{...outside,status:"cancelled"}]).status,"none");
  assert.equal(resolveConversion(old,[old],[{...outside,eventDate:"2030-01-19"}]).status,"none");
});
test("ambiguous venue results require review", () => {
  const second={...next,id:"another"};
  const resolution=resolveConversion(old,[old,next,second],[]);
  assert.equal(resolution.status,"needs_review");
});
test("a cancelled new venue is ignored", () => {
  assert.equal(resolveConversion(old,[old,{...next,status:"cancelled"}],[]).status,"none");
});

test("missing child name: retain a manual review candidate, never auto-convert", () => {
  const unknownChild = {...old,birthdayChildName:null};
  const result = resolveConversion(unknownChild,[unknownChild,next],[outside]);
  assert.equal(result.status,"needs_review");
  if(result.status==="needs_review") {
    assert.equal(result.candidates.length,2);
  }
});
