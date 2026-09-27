import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {
  normalizePhone,
  parseMoney,
  parseTimeRange,
  normalizePack,
  normalizeImageAuthorization,
  normalizePaymentMethod,
  parseAge,
  normalizeSubmission,
  dedupKey,
  googleFormsDepositPaymentInput,
  verifySignature,
  planImport,
  importSubmission,
} from "./google-forms.ts";
import { summarizeEventPayments } from "../lib/event-payment-rules.ts";

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
test("valid HMAC binds timestamp and raw body", () => {
  const raw = Buffer.from("{}");
  const timestamp = "1790452800";
  const signature = createHmac("sha256", "secret")
    .update(timestamp)
    .update(".")
    .update(raw)
    .digest("hex");
  assert.equal(
    verifySignature(raw, timestamp, signature, "secret", 1790452800_000),
    true,
  );
});
test("stale webhook timestamp is rejected", () => {
  const raw = Buffer.from("{}");
  const timestamp = "1790452400";
  const signature = createHmac("sha256", "secret")
    .update(timestamp)
    .update(".")
    .update(raw)
    .digest("hex");
  assert.equal(
    verifySignature(raw, timestamp, signature, "secret", 1790452800_000),
    false,
  );
});
test("invalid HMAC is rejected", () =>
  assert.equal(
    verifySignature(Buffer.from("{}"), "1790452800", "00", "secret", 1790452800_000),
    false,
  ));
test("missing secret is rejected", () =>
  assert.equal(
    verifySignature(Buffer.from("{}"), "1790452800", "00", "", 1790452800_000),
    false,
  ));
const packs = [
  { id: "pack-e", name: "Essencial", basePrice: "250.00", isActive: true },
  { id: "pack-c", name: "Completo", basePrice: "400.00", isActive: true },
  { id: "pack-p", name: "Premium", basePrice: "550.00", isActive: true },
];

test("unknown pack never yields zero/zero paid", () => {
  const result = planImport(
    { ...base, fields: { ...base.fields, pack: "Desconhecido" } },
    [],
    packs,
  );
  assert.equal(result.status, "needs_review");
  assert.equal(result.event, null);
});
test("known pack with empty catalog stays review-only", () => {
  const result = planImport(base, [], []);
  assert.equal(result.status, "needs_review");
  assert.equal(result.event, null);
});
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
  }, [], packs);
  assert.equal(result.status, "needs_review");
  assert.ok(result.event);
  assert.equal(result.event.totalPrice, 550);
  assert.equal(result.event.expectedReservationDepositAmount, 110);
  assert.equal(result.event.reservationDepositPolicy, "auto_20");
  assert.equal(result.deposit, null);
});
test("Adriana dry run", () => {
  const result = planImport(base, [], packs);
  assert.equal(result.status, "created");
  assert.equal(result.event?.totalPrice, 400);
  assert.equal(result.event?.expectedReservationDepositAmount, 80);
  assert.equal(result.event?.reservationDepositPolicy, "frozen_after_payment");
  assert.equal(result.deposit?.amount, 60);
  assert.equal(result.deposit?.paymentMethod, null);
  assert.equal(result.deposit?.paidAt, null);
  assert.equal(
    result.deposit?.sourceReference,
    `google_forms:${base.formId}:${base.submissionId}:deposit`,
  );
  assert.deepEqual(result.extras, []);
});
test("ambiguous extras never billed", () =>
  assert.deepEqual(
    planImport(
      {
        ...base,
        fields: { ...base.fields, extras: "talvez queira mascote" },
      },
      [],
      packs,
    ).extras,
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
    packs,
  );
  assert.equal(r.event?.totalPrice, 445);
  assert.equal(r.extras[0]?.unitPrice, 45);
});
test("same submission twice creates one party and one deposit payment", async () => {
  const seen = new Set<string>();
  let created = 0;
  let payments = 0;
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async (id: string) =>
          seen.has(id) ? { status: "created" } : null,
        findEvent: async () => null,
        listExtras: async () => [],
        listPacks: async () => packs,
        saveImport: async (id: string) => {
          seen.add(id);
        },
        createEvent: async () => {
          created++;
          return "id";
        },
        createExtras: async () => {},
        createPayment: async () => {
          payments++;
        },
      });
    },
  };
  await importSubmission(base, store);
  const second = await importSubmission(base, store);
  assert.equal(created, 1);
  assert.equal(payments, 1);
  assert.equal(second.status, "already_exists");
});
test("existing phone and date never overwritten or paid reduced", async () => {
  let writes = 0;
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async () => null,
        findEvent: async () => ({ id: "existing" }),
        listExtras: async () => [],
        listPacks: async () => packs,
        saveImport: async () => {
          writes++;
        },
        createEvent: async () => {
          throw Error("overwrite");
        },
        createExtras: async () => {
          throw Error("overwrite");
        },
        createPayment: async () => {
          throw Error("duplicate payment");
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
test("Google Sheet display date yyyy/mm/dd is normalized", () =>
  assert.equal(
    normalizeSubmission({
      ...base,
      fields: { ...base.fields, eventDate: "2027/12/30" },
    }).eventDate,
    "2027-12-30",
  ));
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
    packs,
  );
  assert.equal(r.status, "needs_review");
  assert.deepEqual(r.extras, []);
});
test("form says no extra, no review", () => {
  for (const requestedService of [
    "Não pretendo adicionar nenhum serviço extra",
    "Não pretendo adicionar nenhum serviço extra.",
  ]) {
    assert.equal(
      planImport({
        ...base,
        fields: {
          ...base.fields,
          requestedService,
        },
      }, [], packs).status,
      "created",
    );
  }
});
test("included child snack on actual form does not require review", () =>
  assert.equal(
    planImport({
      ...base,
      fields: {
        ...base.fields,
        cateringNotes: "Inclui lanche para as crianças",
      },
    }, [], packs).status,
    "created",
  ));
test("included pack catering does not require review", () =>
  assert.equal(
    planImport({
      ...base,
      fields: { ...base.fields, cateringNotes: "Pack com catering" },
    }, [], packs).status,
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
    planImport({ ...base, fields: { ...base.fields, deposit: "" } }, [], packs).status,
    "needs_review",
  ));
test("unaccepted or blank terms never create an ordinary party", () => {
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, termsAccepted: "Não" } }, [], packs)
      .status,
    "needs_review",
  );
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, termsAccepted: "" } }, [], packs)
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
    packs,
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
    packs,
  );
  assert.equal(r.status, "created");
  assert.equal(r.event?.totalPrice, 445);
  assert.equal(r.extras[0]?.unitPrice, 45);
});
test("retry of a needs-review import stays needs_review without duplicating its party", async () => {
  const seen = new Map();
  let created = 0;
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
        listPacks: async () => packs,
        saveImport: async (key: string, status: string) => {
          seen.set(key, { status });
        },
        createEvent: async () => {
          created++;
          return "review-party";
        },
        createExtras: async () => {},
        createPayment: async () => {
          throw Error("invalid deposit must not create a payment");
        },
      });
    },
  };
  const first = await importSubmission(uncertain, store),
    second = await importSubmission(uncertain, store);
  assert.equal(first.status, "needs_review");
  assert.equal(first.venueEventId, "review-party");
  assert.equal(second.status, "needs_review");
  assert.equal(created, 1);
});
test("missing required photo choice is held for review", () =>
  assert.equal(
    planImport({ ...base, fields: { ...base.fields, imageAuthorization: "" } }, [], packs)
      .status,
    "needs_review",
  ));

test("payment methods from the form normalize conservatively", () => {
  assert.equal(normalizePaymentMethod(" Dinheiro "), "cash");
  assert.equal(normalizePaymentMethod("Transferência"), "bank_transfer");
  assert.equal(normalizePaymentMethod("Transferencia"), "bank_transfer");
  assert.equal(normalizePaymentMethod("Transferência bancária"), "bank_transfer");
  assert.equal(normalizePaymentMethod("  TRANSFERÊNCIA   BANCÁRIA "), "bank_transfer");
  assert.equal(normalizePaymentMethod("MB Way"), "mbway");
  assert.equal(normalizePaymentMethod("Mbway"), "mbway");
  assert.equal(normalizePaymentMethod("MBWay"), "mbway");
  assert.equal(normalizePaymentMethod("mb way"), "mbway");
  assert.equal(normalizePaymentMethod("Outro"), null);
  assert.equal(normalizePaymentMethod(""), null);
});

test("Premium 550 with 100 deposit keeps 20 percent expected signal and 10 remaining", () => {
  const result = planImport({
    ...base,
    submissionId: "premium-100",
    fields: {
      ...base.fields,
      pack: "Premium",
      deposit: "100",
      paymentMethod: "MB Way",
    },
  }, [], packs);

  assert.equal(result.event?.totalPrice, 550);
  assert.equal(result.event?.expectedReservationDepositAmount, 110);
  assert.equal(result.event?.reservationDepositPolicy, "frozen_after_payment");
  assert.equal(result.deposit?.amount, 100);
  assert.equal(result.deposit?.paymentMethod, "mbway");
  assert.equal(result.deposit?.paidAt, null);

  const summary = summarizeEventPayments({
    totalPrice: result.event?.totalPrice ?? 0,
    expectedDeposit: result.event?.expectedReservationDepositAmount ?? null,
    payments: result.deposit
      ? [{
          paymentType: "reservation_deposit",
          amount: result.deposit.amount,
          deletedAt: null,
        }]
      : [],
  });
  assert.equal(summary.depositRemaining, 10);
});

test("submitted_at is never used as paid_at", () => {
  const result = planImport({
    ...base,
    submissionId: "no-payment-date",
    submittedAt: "2026-09-27T20:30:00Z",
    fields: {
      ...base.fields,
      deposit: "100",
      paymentMethod: "MBWay",
    },
  }, [], packs);

  assert.equal(result.deposit?.paidAt, null);
});

test("form without a received deposit creates no event payment", async () => {
  const submission = {
    ...base,
    submissionId: "no-deposit",
    fields: { ...base.fields, deposit: "0", paymentMethod: "" },
  };
  let payments = 0;
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async () => null,
        findEvent: async () => null,
        listExtras: async () => [],
        listPacks: async () => packs,
        saveImport: async () => {},
        createEvent: async () => "no-deposit-event",
        createExtras: async () => {},
        createPayment: async () => {
          payments++;
        },
      });
    },
  };

  const result = await importSubmission(submission, store);
  assert.equal(result.status, "created");
  assert.equal(payments, 0);
});

test("existing party never receives an automatic duplicate deposit", async () => {
  let payments = 0;
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async () => null,
        findEvent: async () => ({ id: "existing-party" }),
        listExtras: async () => [],
        listPacks: async () => packs,
        saveImport: async () => {},
        createEvent: async () => {
          throw Error("must not create event");
        },
        createExtras: async () => {
          throw Error("must not create extras");
        },
        createPayment: async () => {
          payments++;
        },
      });
    },
  };

  const result = await importSubmission(base, store);
  assert.equal(result.status, "already_exists");
  assert.equal(payments, 0);
});

test("historical imported party is not backfilled by new webhook logic", async () => {
  let payments = 0;
  const store = {
    async transact(fn: any) {
      return fn({
        findImport: async () => ({ status: "created", venueEventId: "historical-party" }),
        findEvent: async () => null,
        listExtras: async () => [],
        listPacks: async () => packs,
        saveImport: async () => {
          throw Error("existing import must not be rewritten");
        },
        createEvent: async () => {
          throw Error("historical import must not create event");
        },
        createExtras: async () => {
          throw Error("historical import must not create extras");
        },
        createPayment: async () => {
          payments++;
        },
      });
    },
  };

  const result = await importSubmission(base, store);
  assert.equal(result.status, "already_exists");
  assert.equal(result.venueEventId, "historical-party");
  assert.equal(payments, 0);
});

test("refundable deposit is outside Google Forms payment reconciliation", () => {
  const summary = summarizeEventPayments({
    totalPrice: 550,
    expectedDeposit: 110,
    refundableDepositAmount: 500,
    payments: [{
      paymentType: "reservation_deposit",
      amount: 100,
      deletedAt: null,
    }],
  });
  assert.equal(summary.received, 100);
  assert.equal(summary.remainingBalance, 450);
  assert.equal(summary.depositRemaining, 10);
});

test("Google Forms event, extras, deposit and import record are one atomic unit", async () => {
  const state = {
    events: [] as string[],
    extras: [] as string[],
    payments: [] as string[],
    imports: [] as string[],
  };

  const store = {
    async transact(fn: any) {
      const snapshot = {
        events: [...state.events],
        extras: [...state.extras],
        payments: [...state.payments],
        imports: [...state.imports],
      };
      try {
        return await fn({
          findImport: async () => null,
          findEvent: async () => null,
          listExtras: async () => [],
          listPacks: async () => packs,
          createEvent: async () => {
            state.events.push("event-1");
            return "event-1";
          },
          createExtras: async () => {
            state.extras.push("extras-complete");
          },
          createPayment: async () => {
            state.payments.push("deposit-started");
            throw new Error("payment write failed");
          },
          saveImport: async () => {
            state.imports.push("import-saved");
          },
        });
      } catch (error) {
        state.events = snapshot.events;
        state.extras = snapshot.extras;
        state.payments = snapshot.payments;
        state.imports = snapshot.imports;
        throw error;
      }
    },
  };

  await assert.rejects(importSubmission(base, store));
  assert.deepEqual(state, {
    events: [],
    extras: [],
    payments: [],
    imports: [],
  });
});

test("Google Forms deposit maps explicitly to reservation_deposit ledger input", () => {
  const result = planImport({
    ...base,
    submissionId: "ledger-map",
    fields: {
      ...base.fields,
      pack: "Premium",
      deposit: "100",
      paymentMethod: "MB Way",
    },
  }, [], packs);

  assert.ok(result.deposit);
  assert.deepEqual(
    googleFormsDepositPaymentInput("venue-1", result.deposit),
    {
      module: "venue_events",
      entityId: "venue-1",
      paymentType: "reservation_deposit",
      amount: 100,
      paymentMethod: "mbway",
      paidAt: null,
      notes: null,
      source: "google_forms",
      sourceReference: `google_forms:${base.formId}:ledger-map:deposit`,
    },
  );
});
