import type {
  MessageTemplate,
  MessageTemplateModule,
  MessageTemplateTriggerType,
} from "@workspace/api-client-react";

export type WhatsAppVariables = Record<string, string | number | null | undefined>;

export function findActiveMessageTemplate(
  templates: MessageTemplate[] | undefined,
  module: MessageTemplateModule,
  triggerType: MessageTemplateTriggerType = "confirmation",
) {
  return [...(templates ?? [])]
    .filter((template) => template.isActive && template.module === module && template.triggerType === triggerType)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))[0];
}

export function renderMessageTemplate(body: string, variables: WhatsAppVariables) {
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined || value === "") return match;
    return String(value);
  });
}

export function buildTemplatedWhatsAppUrl(
  phone: string,
  fallbackMessage: string,
  templates: MessageTemplate[] | undefined,
  module: MessageTemplateModule,
  variables: WhatsAppVariables,
  triggerType: MessageTemplateTriggerType = "confirmation",
) {
  const normalizedPhone = normalizePortuguesePhone(phone);
  const template = findActiveMessageTemplate(templates, module, triggerType);
  const message = template ? renderMessageTemplate(template.body, variables) : fallbackMessage;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function normalizePortuguesePhone(phone: string) {
  const cleanPhone = phone.replace(/\D/g, "");
  return cleanPhone.startsWith("351") ? cleanPhone : `351${cleanPhone}`;
}

export function formatAmount(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value ?? 0);
}
