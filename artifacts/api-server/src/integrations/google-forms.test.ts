import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {
  normalizePhone,
  parseMoney,
  parseTimeRange,
  normalizePack,
  normalizeImageAuthorization,
  parseAge,
  normalizeSubmission,
  dedupKey,
  verifySignature,
  planImport,
  importSubmission,
} from "./google-forms.ts";

const base = {
  formId: "19JReWvo-11bzk6X1iIARghDLEh0pLDaJHr2Bu8RmMFc",
  submissionId: "row-42",
  submittedAt: "2026-09-26T10:00:00Z",
  fields: {
    customerName: "Adriana Silva",
    phone: "968508692",
    eventDate: "2027-03-27",
    time: "16:00-19:00",
    pack: "Completo",
    birthdayChildName: "Diego Duarte",
    birthdayChildAge: "3",
    partyTheme: "ainda por definir",
    cateringNotes: "lanche infantil incluído",
    allergies: "sem alergias",
    imageAuthorization: "rosto visível",
    deposit: "60",
    paymentMethod: "Outro",
    termsAccepted: "Sim",
  },
};
test("phone PT with spaces and +351", () =>
  assert.equal(normalizePhone("+351 968 508 692"), "968508692"));
test("money 110 €", () => assert.equal(parseMoney("110 €"), 110));
test("money 76,00€", () => assert.equal(parseMoney("76,00€"), 76));
test("invalid money never invented", () =>
  assert.equal(parseMoney("Sim"), null));
test("time 16h-19h", () =>
  assert.deepEqual(parseTimeRange("16h-19h"), {
    startTime: "16:00",
    endTime: "19:00",
  }));
test("time 16:00 - 19:00", () =>
  assert.deepEqual(parseTimeRange("16:00 - 19:00"), {
    startTime: "16:00",
    endTime: "19:00",
  }));
test("pack Premium", () =>
  assert.equal(normalizePack("Pack Premium 550"), "Premium"));
test("image visible", () =>
  assert.equal(normalizeImageAuthorization("rosto visível"), "rosto_visivel"));
test("image covered", () =>
  assert.equal(normalizeImageAuthorization("rosto tapado"), "rosto_tapado"));
test("image disallowed", () =>
  assert.equal(
    normalizeImageAuthorization("não autoriza fotos"),
    "nao_autorizo",
  ));
test("12 months explicit conversion", () =>
  assert.equal(parseAge("12 meses"), 1));
test("ambiguous age remains unknown", () =>
  assert.equal(parseAge("quase 2 anos"), null));
test("new time and email preferred; old fallback", () => {
  const n = normalizeSubmission({
    ...base,
    fields: {
      ...base.fields,
      time: "16h-19h",
      oldTime: "10h-13h",
      email: "new@example.com",
      oldEmail: "old@example.com",
    },
  });
  assert.equal(n.email, "new@example.com");
  assert.equal(n.startTime, "16:00");
});
test("valid HMAC", () => {
  const raw = Buffer.from("{}");
  assert.equal(
    verifySignature(
      raw,
      createHmac("sha256", "secret").update(raw).digest("hex"),
      "secret",
    ),
    true,
  );
});
test("invalid HMAC", () =>
  assert.equal(verifySignature(Buffer.from("{}"), "00", "secret"), false));
test("missing secret", () =>
  assert.equal(verifySignature(Buffer.from("{}"), "00", ""), false));
test("unknown pack never yields zero/zero paid", () =>
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, pack: "Desconhecido" } })
      .status,
    "needs_review",
  ));
test("Patricia needs review, never invents payment", () => {
  const result = planImport({
    ...base,
    submissionId: "patricia",
    fields: {
      ...base.fields,
      customerName: "Patricia Leonor Gonçalves Guia",
      phone: "961148868",
      email: "pgoncalve@gmail.com",
      nif: "231013256",
      eventDate: "2026-11-01",
      pack: "Premium",
      birthdayChildName: "Vitória Leonor Gonçalves Guia",
      birthdayChildAge: "12 meses",
      partyTheme: "LaLe Ki LoLu",
      decorationNotes:
        "As personagens principais Lolo Du e a fada Ki num mundo encantado.",
      cateringNotes: "Catering personalizado",
      allergies: "",
      imageAuthorization: "não autoriza fotos",
      deposit: "Sim",
      paymentMethod: "transferência bancária",
    },
  });
  assert.equal(result.status, "needs_review");
  assert.equal(result.event, null);
});
test("Adriana dry run", () => {
  const result = planImport(base);
  assert.equal(result.status, "created");
  assert.equal(result.event?.totalPrice, 400);
  assert.equal(result.event?.amountPaid, 60);
  assert.equal(result.event?.paymentStatus, "partial");
  assert.deepEqual(result.extras, []);
});
test("ambiguous extras never billed", () =>
  assert.deepEqual(
    planImport({
      ...base,
      fields: { ...base.fields, extras: "talvez queira mascote" },
    }).extras,
    [],
  ));
test("confirmed active exact extra uses immutable catalog price", () => {
  const r = planImport(
    {
      ...base,
      fields: { ...base.fields, extras: "Mascote", extrasConfirmed: true },
    },
    [
      {
        id: "x",
        name: "Mascote",
        basePrice: "45.00",
        isActive: true,
        appliesTo: "venue_events",
      },
    ],
  );
  assert.equal(r.event?.totalPrice, 445);
  assert.equal(r.extras[0]?.unitPrice, 45);
});
test("same submission twice creates only once", async () => {
  const seen = new Set<string>();
  let created = 0;
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async (id: string) =>
          seen.has(id) ? { status: "created" } : null,
        findEvent: async () => null,
        listExtras: async () => [],
        saveImport: async (id: string) => {
          seen.add(id);
        },
        createEvent: async () => {
          created++;
          return "id";
        },
        createExtras: async () => {},
      });
    },
  };
  await importSubmission(base, store);
  const second = await importSubmission(base, store);
  assert.equal(created, 1);
  assert.equal(second.status, "already_exists");
});
test("existing phone and date never overwritten or paid reduced", async () => {
  let writes = 0;
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async () => null,
        findEvent: async () => ({ id: "existing", amountPaid: "100.00" }),
        listExtras: async () => [],
        saveImport: async () => {
          writes++;
        },
        createEvent: async () => {
          throw Error("overwrite");
        },
        createExtras: async () => {
          throw Error("overwrite");
        },
      });
    },
  };
  const r = await importSubmission(base, store);
  assert.equal(r.status, "already_exists");
  assert.equal(writes, 1);
});
test("thousands separator is not mistaken for decimal", () =>
  assert.equal(parseMoney("1.000,00 €"), 1000));
test("invalid calendar date stays unknown", () =>
  assert.equal(
    normalizeSubmission({
      ...base,
      fields: { ...base.fields, eventDate: "2027-02-30" },
    }).eventDate,
    null,
  ));
test("integer thousands separator is 1000", () =>
  assert.equal(parseMoney("1.000 €"), 1000));
test("age written as 3 anos", () => assert.equal(parseAge("3 anos"), 3));
test("source from form is preserved", () =>
  assert.equal(
    normalizeSubmission({
      ...base,
      fields: { ...base.fields, source: "Instagram" },
    }).source,
    "Instagram",
  ));
test("actual form schedule 16:00h às 19:00h", () =>
  assert.deepEqual(parseTimeRange("16:00h às 19:00h"), {
    startTime: "16:00",
    endTime: "19:00",
  }));
test("actual form schedule 10:00h às 12:30h", () =>
  assert.deepEqual(parseTimeRange("10:00h às 12:30h"), {
    startTime: "10:00",
    endTime: "12:30",
  }));
test("actual form image option visible", () =>
  assert.equal(
    normalizeImageAuthorization("Sim, com rostos visíveis"),
    "rosto_visivel",
  ));
test("actual form image option covered", () =>
  assert.equal(
    normalizeImageAuthorization("Sim, com rostos tapados"),
    "rosto_tapado",
  ));
test("form request for service is review, even if catalog matches", () => {
  const r = planImport(
    {
      ...base,
      fields: { ...base.fields, requestedService: "Animação com mascote" },
    },
    [
      {
        id: "x",
        name: "Animação com mascote",
        basePrice: "45.00",
        isActive: true,
        appliesTo: "venue_events",
      },
    ],
  );
  assert.equal(r.status, "needs_review");
  assert.deepEqual(r.extras, []);
});
test("form says no extra, no review", () =>
  assert.equal(
    planImport({
      ...base,
      fields: {
        ...base.fields,
        requestedService: "Não pretendo adicionar nenhum serviço extra",
      },
    }).status,
    "created",
  ));
test("included child snack on actual form does not require review", () =>
  assert.equal(
    planImport({
      ...base,
      fields: {
        ...base.fields,
        cateringNotes: "Inclui lanche para as crianças",
      },
    }).status,
    "created",
  ));
test("included pack catering does not require review", () =>
  assert.equal(
    planImport({
      ...base,
      fields: { ...base.fields, cateringNotes: "Pack com catering" },
    }).status,
    "created",
  ));
test("historical Google Sheet schedule 16h às 19h", () =>
  assert.deepEqual(parseTimeRange("16h às 19h"), {
    startTime: "16:00",
    endTime: "19:00",
  }));
test("new X empty falls back to old J", () =>
  assert.equal(
    normalizeSubmission({
      ...base,
      fields: { ...base.fields, time: "", oldTime: "10h às 13h" },
    }).startTime,
    "10:00",
  ));
test("blank required deposit is held for review", () =>
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, deposit: "" } }).status,
    "needs_review",
  ));
test("unaccepted or blank terms never create an ordinary party", () => {
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, termsAccepted: "Não" } })
      .status,
    "needs_review",
  );
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, termsAccepted: "" } })
      .status,
    "needs_review",
  );
});
test("same date and phone formats use one dedup lock key", () => {
  const first = dedupKey({
    ...base,
    fields: {
      ...base.fields,
      eventDate: "27/03/2027",
      phone: "+351 968 508 692",
    },
  });
  const second = dedupKey({
    ...base,
    fields: { ...base.fields, eventDate: "2027-03-27", phone: "968508692" },
  });
  assert.equal(first, second);
});
test("matching catalog name alone is not confirmation", () => {
  const r = planImport(
    { ...base, fields: { ...base.fields, extras: "Mascote" } },
    [
      {
        id: "x",
        name: "Mascote",
        basePrice: "45.00",
        isActive: true,
        appliesTo: "venue_events",
      },
    ],
  );
  assert.equal(r.status, "needs_review");
  assert.deepEqual(r.extras, []);
});
test("explicitly confirmed catalog extra is billed at snapshot price", () => {
  const r = planImport(
    {
      ...base,
      fields: { ...base.fields, extras: "Mascote", extrasConfirmed: true },
    },
    [
      {
        id: "x",
        name: "Mascote",
        basePrice: "45.00",
        isActive: true,
        appliesTo: "venue_events",
      },
    ],
  );
  assert.equal(r.status, "created");
  assert.equal(r.event?.totalPrice, 445);
  assert.equal(r.extras[0]?.unitPrice, 45);
});
test("retry of a needs-review import stays needs_review without a party", async () => {
  const seen = new Map();
  const uncertain = {
    ...base,
    submissionId: "review-retry",
    fields: { ...base.fields, deposit: "Sim" },
  };
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async (key: string) => seen.get(key) ?? null,
        findEvent: async () => null,
        listExtras: async () => [],
        saveImport: async (key: string, status: string) => {
          seen.set(key, { status });
        },
        createEvent: async () => {
          throw Error("unexpected party");
        },
        createExtras: async () => {},
      });
    },
  };
  const first = await importSubmission(uncertain, store),
    second = await importSubmission(uncertain, store);
  assert.equal(first.status, "needs_review");
  assert.equal(second.status, "needs_review");
});
test("missing required photo choice is held for review", () =>
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, imageAuthorization: "" } })
      .status,
    "needs_review",
  ));
