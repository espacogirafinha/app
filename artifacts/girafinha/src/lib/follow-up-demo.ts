import type { FollowUpPage } from "./follow-up-api";

// Fictional records for a safe, explicit Preview-only inspection (?demo=1).
// They never originate from a database and must never be offered as real customers.
export const DEMO_FOLLOW_UP: FollowUpPage = {
  preparationCount: 2,
  contactCount: 2,
  campaign: {
    offer_type: "gift",
    offer_description: "Pequeno mimo na festa",
    offer_value: null,
    offer_scope: "both",
  },
  preparations: [
    {
      id: "demo-party-one", customerName: "Ana (demonstração)",
      birthdayChildName: "Matilde", phone: "000 000 000",
      eventDate: "2026-11-15", daysRemaining: 26, packName: "Premium",
      theme: "Princesas", invitationsDone: false, materialsDone: false,
    },
    {
      id: "demo-party-two", customerName: "Rita (demonstração)",
      birthdayChildName: "Tomás", phone: "000 000 000",
      eventDate: "2026-11-06", daysRemaining: 17, packName: "Completo",
      theme: "Dinossauros", invitationsDone: true, materialsDone: false,
    },
  ],
  reactivations: [
    {
      id: "demo-reactivation-one",
      source: {
        id: "demo-source-one", customerName: "Inês (demonstração)",
        birthdayChildName: "Leonor", phone: "912 000 000",
        eventDate: "2026-01-20",
      },
      theme: "Unicórnios", packName: "Premium",
      estimate: "2027-01-20", firstDue: "2026-10-20", secondDue: "2026-12-09",
      firstContactedAt: null, secondContactedAt: null,
      stage: "first", needsReview: false, reviewCandidates: [],
      converted: false, conversion: null, noInterest: false,
      offer: { type: "none", value: null, description: "", scope: "both", proposedAt: null, usedAt: null },
    },
    {
      id: "demo-reactivation-two",
      source: {
        id: "demo-source-two", customerName: "Joana (demonstração)",
        birthdayChildName: "Duarte", phone: "912 000 000",
        eventDate: "2025-12-01",
      },
      theme: "Super-heróis", packName: "Essencial",
      estimate: "2026-12-01", firstDue: "2026-09-01", secondDue: "2026-10-20",
      firstContactedAt: "2026-09-01T12:00:00Z", secondContactedAt: null,
      stage: "second", needsReview: false, reviewCandidates: [],
      converted: false, conversion: null, noInterest: false,
      offer: { type: "gift", value: null, description: "Pequeno mimo na festa", scope: "both", proposedAt: null, usedAt: null },
    },
  ],
};
