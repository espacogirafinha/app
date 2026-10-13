export const GOOGLE_REVIEW_URL =
  "https://maps.app.goo.gl/ofJkUSP6iVL2YH7j7?g_st=ic";

export type BookingConfirmationInput = {
  customerName: string;
  birthdayChildName?: string | null;
  phone: string;
  eventDate: string;
  startTime: string;
  endTime?: string | null;
  packName: string;
  depositAmount: number;
  totalPrice: number;
  totalReceived: number;
};

export type BookingFeedbackInput = {
  customerName: string;
  birthdayChildName?: string | null;
  phone: string;
  eventDate: string;
  endTime?: string | null;
};

export type BookingConfirmationLink = {
  phone: string | null;
  message: string;
  url: string | null;
  remainingBalance: number;
};

export type BookingFeedbackLink = {
  phone: string | null;
  message: string;
  url: string | null;
};

export function normalizePortugueseWhatsAppPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  const nationalNumber = digits.startsWith("351") ? digits.slice(3) : digits;
  if (!/^[29]\d{8}$/.test(nationalNumber)) return null;

  return `351${nationalNumber}`;
}

export function buildBookingConfirmationMessage(input: BookingConfirmationInput) {
  const customerFirstName = firstName(input.customerName);
  const childFirstName = firstName(input.birthdayChildName ?? "");
  const remainingBalance = roundMoney(
    Math.max(0, input.totalPrice - input.totalReceived),
  );
  const startTime = formatPortugueseTime(input.startTime);
  const endTime = input.endTime ? formatPortugueseTime(input.endTime) : null;
  const arrivalTime = subtractMinutes(input.startTime, 30);
  const timeLine = endTime ? `${startTime} às ${endTime}` : startTime;
  const childConfirmation = childFirstName
    ? `A reserva da festa de ${childFirstName} está confirmada 🎉`
    : "A reserva da festa está confirmada 🎉";
  const balanceLine =
    remainingBalance <= 0
      ? `O valor total é de ${formatEuro(input.totalPrice)} e já se encontra totalmente liquidado.`
      : `O valor total é de ${formatEuro(input.totalPrice)}, ficando ${formatEuro(remainingBalance)} por liquidar no dia da festa, em numerário.`;

  return [
    `Olá ${customerFirstName} 😊`,
    "",
    `Já recebemos o formulário e o pagamento dos ${formatEuro(input.depositAmount)} de sinal. ${childConfirmation}`,
    "",
    `📅 ${formatPortugueseDate(input.eventDate)}`,
    `🕓 ${timeLine}`,
    `🎂 ${input.packName}`,
    "",
    `Os pais e a criança podem chegar 30 minutos antes, às ${arrivalTime}, para fazerem com calma os preparativos que forem necessários.`,
    "",
    balanceLine,
    "",
    "Obrigada pela preferência 💛",
    "Espaço Girafinha",
  ].join("\n");
}

export function buildBookingFeedbackMessage(input: BookingFeedbackInput) {
  const customerFirstName = firstName(input.customerName);
  const childFirstName = firstName(input.birthdayChildName ?? "");
  const partyReference = childFirstName
    ? `da festa de ${childFirstName}`
    : "da festa";

  return [
    `Olá ${customerFirstName} 😊`,
    "",
    `Esperamos que tenham gostado ${partyReference} 💛 Foi um gosto receber-vos no Espaço Girafinha!`,
    "",
    "Se tiverem um minutinho, gostaríamos muito que nos deixassem a vossa opinião no Google. Ajuda-nos muito e também ajuda outras famílias a conhecerem o nosso espaço 😊",
    "",
    "⭐ Deixar avaliação no Google:",
    GOOGLE_REVIEW_URL,
    "",
    "Obrigada por terem escolhido o Espaço Girafinha para este dia tão especial! 🥰",
  ].join("\n");
}

export function buildBookingConfirmationWhatsAppLink(
  input: BookingConfirmationInput,
): BookingConfirmationLink {
  const phone = normalizePortugueseWhatsAppPhone(input.phone);
  const message = buildBookingConfirmationMessage(input);
  return {
    phone,
    message,
    url: phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : null,
    remainingBalance: roundMoney(
      Math.max(0, input.totalPrice - input.totalReceived),
    ),
  };
}

export function buildBookingFeedbackWhatsAppLink(
  input: BookingFeedbackInput,
): BookingFeedbackLink {
  const phone = normalizePortugueseWhatsAppPhone(input.phone);
  const message = buildBookingFeedbackMessage(input);
  return {
    phone,
    message,
    url: phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : null,
  };
}

export function hasBookingEnded(
  input: Pick<BookingFeedbackInput, "eventDate" | "endTime">,
  now = new Date(),
) {
  const endKey = `${input.eventDate}T${normalizeTimeKey(input.endTime ?? "23:59")}`;
  return endKey <= getPortugalDateTimeKey(now);
}

export function formatPortugueseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Lisbon",
  }).format(date);
}

export function subtractMinutes(value: string, minutes: number) {
  const parsed = parseTime(value);
  if (!parsed) return value.slice(0, 5);

  const totalMinutes =
    (parsed.hours * 60 + parsed.minutes - minutes + 24 * 60) % (24 * 60);
  return formatPortugueseTime(
    `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`,
  );
}

export function formatPortugueseTime(value: string) {
  const parsed = parseTime(value);
  if (!parsed) return value.slice(0, 5);

  return parsed.minutes === 0
    ? `${parsed.hours}h`
    : `${parsed.hours}h${String(parsed.minutes).padStart(2, "0")}`;
}

function normalizeTimeKey(value: string) {
  const parsed = parseTime(value);
  if (!parsed) return "23:59";
  return `${String(parsed.hours).padStart(2, "0")}:${String(parsed.minutes).padStart(2, "0")}`;
}

function getPortugalDateTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "";
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(roundMoney(value))
    .replace(/\u00a0/g, " ");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
