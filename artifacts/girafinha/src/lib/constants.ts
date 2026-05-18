export const SERVICE_CATALOG = [
  {
    name: "Aluguer do Espaço",
    category: "Festas no espaço",
    price: 160,
    depositRate: 0.2,
    description: "Utilização exclusiva do espaço, brinquedos, insuflável e lotação até 50 pessoas.",
  },
  {
    name: "Pack Simples",
    category: "Festas no espaço",
    price: 220,
    depositRate: 0.2,
    description: "Espaço exclusivo, monitor/animador e lanche para até 20 crianças.",
  },
  {
    name: "Pack com Decoração",
    category: "Festas no espaço",
    price: 350,
    depositRate: 0.2,
    description: "Pack Simples com decoração personalizada ao tema escolhido.",
  },
  {
    name: "Pack Completo",
    category: "Festas no espaço",
    price: 500,
    depositRate: 0.2,
    description: "Decoração personalizada, lanche para 20 crianças e catering para até 30 adultos.",
  },
  {
    name: "Decoração Externa",
    category: "Serviços externos",
    price: 0,
    depositRate: 0.2,
    description: "Decoração personalizada em casas, quintas, restaurantes ou outros espaços.",
  },
  {
    name: "Catering / Brunch",
    category: "Serviços externos",
    price: 0,
    depositRate: 0.2,
    description: "Catering, brunch, doces, salgados e complementos para eventos no espaço ou fora.",
  },
  {
    name: "Animação",
    category: "Serviços externos",
    price: 0,
    depositRate: 0.2,
    description: "Modelagem de balões, pinturas faciais e animação infantil.",
  },
  {
    name: "Aluguer de Insuflável",
    category: "Serviços externos",
    price: 0,
    depositRate: 0.2,
    description: "Aluguer e gestão de insufláveis para festas e eventos.",
  },
  {
    name: "Workshop Balões Nível 1",
    category: "Workshops",
    price: 70,
    depositAmount: 35,
    description: "Workshop presencial de 3/4h com materiais, coffee break, manual e certificado.",
  },
  {
    name: "Workshop Balões + Kit Inicial",
    category: "Workshops",
    price: 100,
    depositAmount: 50,
    description: "Workshop de balões com kit inicial, manual digital e certificado.",
  },
] as const;

export const SERVICE_OPTIONS = SERVICE_CATALOG.map((service) => service.name);

export const SERVICE_NAMES = [
  "Aluguer do Espaço",
  "Pack Simples",
  "Pack com Decoração",
  "Pack Completo",
  "Decoração Externa",
  "Catering / Brunch",
  "Animação",
  "Aluguer de Insuflável",
  "Workshop Balões Nível 1",
  "Workshop Balões + Kit Inicial",
  "Só Espaço",
  "Espaço + Lanche",
  "Espaço + Decoração",
] as const;

export const PACK_OPTIONS = SERVICE_NAMES;

export const PACK_PRICES = {
  "Aluguer do Espaço": 160,
  "Pack Simples": 220,
  "Pack com Decoração": 350,
  "Pack Completo": 500,
  "Decoração Externa": 0,
  "Catering / Brunch": 0,
  "Animação": 0,
  "Aluguer de Insuflável": 0,
  "Workshop Balões Nível 1": 70,
  "Workshop Balões + Kit Inicial": 100,
  "Só Espaço": 160,
  "Espaço + Lanche": 220,
  "Espaço + Decoração": 350,
} as const;

export const SERVICE_TYPE_OPTIONS = [
  "Festas no espaço",
  "Serviços externos",
  "Workshops",
] as const;

export type ServiceType = (typeof SERVICE_TYPE_OPTIONS)[number];

export const EXTRA_CATEGORIES = [
  "Doces",
  "Salgados",
  "Bolo",
  "Complementos",
  "Animação / Serviços",
  "Workshops",
] as const;

export type ExtraCategory = (typeof EXTRA_CATEGORIES)[number];

export type ExtraCatalogItem = {
  name: string;
  category: ExtraCategory;
  price: number;
  defaultQuantity?: number;
  quantityLabel?: string;
  appliesTo: ServiceType[];
};

export const EXTRA_CATALOG: ExtraCatalogItem[] = [
  { name: "Brigadeiros - 50 unidades", category: "Doces", price: 25, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Brigadeiros - 100 unidades", category: "Doces", price: 45, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Baba de camelo / mousse / gelatina", category: "Doces", price: 1, defaultQuantity: 1, quantityLabel: "uni", appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Salame de chocolate artesanal", category: "Doces", price: 10, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Sortido de mini macarons - 35 unidades", category: "Doces", price: 30, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Mini pastéis de nata - 25 unidades", category: "Doces", price: 15, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Mini pastéis de nata - 50 unidades", category: "Doces", price: 25, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Sortido miniaturas", category: "Doces", price: 30, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Mini salgados caseiros - 50 unidades", category: "Salgados", price: 35, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Mini salgados caseiros - 100 unidades", category: "Salgados", price: 55, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Rolo folhado misto XL", category: "Salgados", price: 15, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Tiras de pota com maionese de alho", category: "Salgados", price: 15, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Mini hamburger / mini cachorros", category: "Salgados", price: 2, defaultQuantity: 10, quantityLabel: "uni", appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Bolo 2kg", category: "Bolo", price: 50, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Bolo 3kg", category: "Bolo", price: 70, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Bolo 4kg", category: "Bolo", price: 85, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Tábua de queijos, frutas e enchidos", category: "Complementos", price: 40, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Tábua de fruta laminada", category: "Complementos", price: 35, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Hora extra", category: "Animação / Serviços", price: 75, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Workshops"] },
  { name: "Pinturas faciais", category: "Animação / Serviços", price: 0, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Modelagem de balões", category: "Animação / Serviços", price: 0, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Mesa temática extra", category: "Animação / Serviços", price: 0, defaultQuantity: 1, appliesTo: ["Festas no espaço", "Serviços externos"] },
  { name: "Coffee break", category: "Workshops", price: 0, defaultQuantity: 1, appliesTo: ["Workshops"] },
  { name: "Kit inicial", category: "Workshops", price: 30, defaultQuantity: 1, appliesTo: ["Workshops"] },
];

export const EXTRA_OPTIONS: Array<{ name: string; price: number; appliesTo: ServiceType[] }> = EXTRA_CATALOG.map(
  ({ name, price, appliesTo }) => ({ name, price, appliesTo }),
);

export const NOTE_TEMPLATES = [
  "Confirmar alergias/intolerâncias",
  "Confirmar tema e cores",
  "Confirmar contacto de emergência",
  "Confirmar horário de montagem/desmontagem",
  "Cliente recorrente",
  "Prever comissão de parceiro",
] as const;

export const RESERVATION_SOURCE_OPTIONS = [
  "Instagram",
  "WhatsApp",
  "Site",
  "Parceiro",
  "Cliente recorrente",
  "Passa-palavra",
] as const;

export function getServiceCatalogItem(name: string) {
  return SERVICE_CATALOG.find((service) => service.name === name);
}

export function getServiceType(name: string): ServiceType {
  const service = getServiceCatalogItem(name);
  if (service) return service.category;
  if (name.startsWith("Workshop")) return "Workshops";
  if (["Decoração Externa", "Catering / Brunch", "Animação", "Aluguer de Insuflável"].includes(name)) {
    return "Serviços externos";
  }
  return "Festas no espaço";
}

export function getSuggestedDeposit(name: string, totalPrice: number) {
  const service = getServiceCatalogItem(name);
  if (service && "depositAmount" in service) return service.depositAmount;
  const depositRate = service && "depositRate" in service ? service.depositRate : 0.2;
  return Math.round(totalPrice * depositRate * 100) / 100;
}

export const MAX_EVENTS_PER_DAY = 2;
