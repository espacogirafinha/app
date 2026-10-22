import assert from "node:assert/strict";
import test from "node:test";
import {
  GOOGLE_REVIEW_URL,
  buildBookingConfirmationMessage,
  buildBookingConfirmationWhatsAppLink,
  buildBookingFeedbackMessage,
  buildBookingFeedbackWhatsAppLink,
  hasBookingEnded,
  normalizePortugueseWhatsAppPhone,
  resolveBookingConfirmationPayment,
  subtractMinutes,
} from "./booking-confirmation-whatsapp.ts";

const base = {
  customerName: "Cátia Pinto",
  birthdayChildName: "Kelly Pinto",
  phone: "912 345 678",
  eventDate: "2026-11-05",
  startTime: "16:00",
  endTime: "19:00",
  packName: "Pack Premium",
  depositAmount: 110,
  totalPrice: 550,
  totalReceived: 110,
};

test("confirmação usa linguagem neutra, primeiro nome e saldo por liquidar", () => {
  const message = buildBookingConfirmationMessage(base);

  assert.match(message, /^Olá Cátia 😊\n\n/);
  assert.match(
    message,
    /pagamento dos 110,00 € de sinal\. A reserva da festa de Kelly está confirmada 🎉/,
  );
  assert.doesNotMatch(message, /festa da Kelly|festa do Kelly/);
  assert.match(message, /📅 5 de novembro/);
  assert.match(message, /🕓 16h às 19h/);
  assert.match(message, /🎂 Pack Premium/);
  assert.match(
    message,
    /Os pais e a criança podem chegar 30 minutos antes, às 15h30, para fazerem com calma os preparativos que forem necessários\./,
  );
  assert.match(
    message,
    /O valor total é de 550,00 €, ficando 440,00 € por liquidar no dia da festa, em numerário\./,
  );
});

test("festa totalmente paga não anuncia valor em falta", () => {
  const message = buildBookingConfirmationMessage({
    ...base,
    totalReceived: 550,
  });

  assert.match(
    message,
    /O valor total é de 550,00 € e já se encontra totalmente liquidado\./,
  );
  assert.doesNotMatch(message, /por liquidar/);
});

test("hora de chegada é calculada 30 minutos antes", () => {
  assert.equal(subtractMinutes("16:00", 30), "15h30");
  assert.equal(subtractMinutes("10:15", 30), "9h45");
  assert.equal(subtractMinutes("00:15", 30), "23h45");
});

test("telefone português é normalizado para 351 sem alterar a origem", () => {
  const storedPhone = "+351 912 345 678";
  assert.equal(normalizePortugueseWhatsAppPhone(storedPhone), "351912345678");
  assert.equal(normalizePortugueseWhatsAppPhone("912345678"), "351912345678");
  assert.equal(normalizePortugueseWhatsAppPhone("00351 912 345 678"), "351912345678");
  assert.equal(storedPhone, "+351 912 345 678");
});

test("ausência ou telefone inválido não produz URL de WhatsApp", () => {
  assert.equal(normalizePortugueseWhatsAppPhone(""), null);
  assert.equal(normalizePortugueseWhatsAppPhone("12345"), null);

  const confirmation = buildBookingConfirmationWhatsAppLink({
    ...base,
    phone: "",
  });
  const feedback = buildBookingFeedbackWhatsAppLink({
    customerName: base.customerName,
    birthdayChildName: base.birthdayChildName,
    phone: "",
    eventDate: base.eventDate,
    endTime: base.endTime,
  });
  assert.equal(confirmation.url, null);
  assert.equal(feedback.url, null);
});

test("feedback usa primeiros nomes e inclui o URL Google exatamente", () => {
  assert.equal(
    GOOGLE_REVIEW_URL,
    "https://maps.app.goo.gl/ofJkUSP6iVL2YH7j7?g_st=ic",
  );

  const message = buildBookingFeedbackMessage({
    customerName: "Cátia Pinto",
    birthdayChildName: "Kelly Pinto",
    phone: "912345678",
    eventDate: "2026-10-01",
    endTime: "19:00",
  });

  assert.match(message, /^Olá Cátia 😊/);
  assert.match(message, /gostado da festa de Kelly 💛/);
  assert.match(message, /Foi um gosto receber-vos no Espaço Girafinha!/);
  assert.match(message, /⭐ Deixar avaliação no Google:/);
  assert.ok(message.includes(GOOGLE_REVIEW_URL));
  assert.match(message, /este dia tão especial! 🥰$/);
});

test("feedback só fica disponível depois da data e hora de fim", () => {
  const event = { eventDate: "2026-10-13", endTime: "19:00" };
  assert.equal(
    hasBookingEnded(event, new Date("2026-10-13T17:59:00.000Z")),
    false,
  );
  assert.equal(
    hasBookingEnded(event, new Date("2026-10-13T18:01:00.000Z")),
    true,
  );
});

test("URLs codificam acentos, emojis, quebras de linha e o link Google", () => {
  const confirmation = buildBookingConfirmationWhatsAppLink(base);
  const feedback = buildBookingFeedbackWhatsAppLink({
    customerName: base.customerName,
    birthdayChildName: base.birthdayChildName,
    phone: base.phone,
    eventDate: "2026-10-01",
    endTime: base.endTime,
  });

  for (const link of [confirmation, feedback]) {
    assert.ok(link.url);
    assert.match(link.url!, /^https:\/\/wa\.me\/351912345678\?text=/);
    assert.match(link.url!, /%C3%/);
    assert.match(link.url!, /%F0%9F/);
    assert.match(link.url!, /%0A/);
    const encoded = link.url!.split("?text=")[1];
    assert.equal(decodeURIComponent(encoded), link.message);
  }

  assert.ok(feedback.message.includes(GOOGLE_REVIEW_URL));
  assert.ok(
    feedback.url!.includes(encodeURIComponent(GOOGLE_REVIEW_URL)),
  );
});


test("festa nova com reservation_deposit mantém confirmação normal", () => {
  const result = resolveBookingConfirmationPayment({
    eventDate: "2026-11-05",
    endTime: "19:00",
    payments: [{ paymentType: "reservation_deposit", amount: 110 }],
    now: new Date("2026-10-14T10:00:00.000Z"),
  });

  assert.deepEqual(result, {
    eligible: true,
    depositAmount: 110,
    source: "reservation_deposit",
  });
});

test("festa antiga terminada com legacy_payment usa fallback sem inventar sinal", () => {
  const result = resolveBookingConfirmationPayment({
    eventDate: "2026-10-01",
    endTime: "19:00",
    payments: [{ paymentType: "legacy_payment", amount: 110 }],
    now: new Date("2026-10-14T10:00:00.000Z"),
  });

  assert.deepEqual(result, {
    eligible: true,
    depositAmount: null,
    source: "legacy_payment",
  });

  const message = buildBookingConfirmationMessage({
    ...base,
    eventDate: "2026-10-01",
    depositAmount: null,
  });

  assert.match(
    message,
    /Temos um pagamento registado\. A reserva da festa de Kelly está confirmada 🎉/,
  );
  assert.doesNotMatch(message, /de sinal/);
  assert.doesNotMatch(message, /pagamento dos 110,00 €/);
});

test("festa antiga sem qualquer pagamento não fica elegível para confirmação", () => {
  const result = resolveBookingConfirmationPayment({
    eventDate: "2026-10-01",
    endTime: "19:00",
    payments: [],
    now: new Date("2026-10-14T10:00:00.000Z"),
  });

  assert.deepEqual(result, {
    eligible: false,
    depositAmount: null,
    source: null,
  });
});

test("legacy_payment confirma também uma festa futura sem inventar sinal", () => {
  const result = resolveBookingConfirmationPayment({
    eventDate: "2026-11-05",
    endTime: "19:00",
    payments: [{ paymentType: "legacy_payment", amount: 110 }],
    now: new Date("2026-10-14T10:00:00.000Z"),
  });

  assert.deepEqual(result, {
    eligible: true,
    depositAmount: null,
    source: "legacy_payment",
  });
});


test("sem pagamento pede sinal sem confirmar pagamento ou reserva", () => {
  const message = buildBookingConfirmationMessage({ ...base, depositAmount: null, totalReceived: 0 });
  assert.match(message, /Para confirmar a reserva/);
  assert.match(message, /pagamento do sinal/);
  assert.doesNotMatch(message, /Temos um pagamento|Já recebemos|está confirmada|totalmente liquidado|por liquidar no dia/);
});

test("reserva gratuita confirma sem mencionar pagamentos", () => {
  const message = buildBookingConfirmationMessage({ ...base, depositAmount: null, totalPrice: 0, totalReceived: 0 });
  assert.match(message, /está confirmada/);
  assert.doesNotMatch(message, /pagamento|sinal|liquid|valor total|numerário/i);
});

test("reserva gratuita não menciona pagamentos mesmo com histórico positivo", () => {
  for (const depositAmount of [null, 110]) {
    const message = buildBookingConfirmationMessage({ ...base, totalPrice: 0, totalReceived: 110, depositAmount });
    assert.match(message, /está confirmada/);
    assert.doesNotMatch(message, /pagamento|sinal|liquid|valor total|numerário/i);
  }
});
