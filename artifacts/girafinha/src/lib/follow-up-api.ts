import { supabase } from "@/lib/supabase";

export type Preparation = {
  id: string;
  customerName: string;
  birthdayChildName: string | null;
  phone: string;
  eventDate: string;
  theme: string | null;
  packName: string;
  daysRemaining: number;
  invitationsDone: boolean;
  materialsDone: boolean;
};
export type Conversion = { kind: "venue_event" | "external_event"; id: string };
export type Reactivation = {
  id: string;
  source: { id: string; customerName: string; birthdayChildName: string | null; phone: string; eventDate: string };
  theme: string | null;
  packName: string;
  estimate: string;
  firstDue: string;
  secondDue: string;
  firstContactedAt: string | null;
  secondContactedAt: string | null;
  stage: "first" | "second" | null;
  needsReview: boolean;
  reviewCandidates: Conversion[];
  converted: boolean;
  conversion: Conversion | null;
  noInterest: boolean;
  offer: {
    type: "none" | "fixed" | "percent" | "gift" | "custom";
    value: number | null;
    description: string;
    scope: "venue_only" | "external_only" | "both";
    proposedAt: string | null;
    usedAt: string | null;
  };
};
export type FollowUpPage = {
  campaign: { offer_type: Reactivation["offer"]["type"]; offer_description: string; offer_value: string | number | null; offer_scope: Reactivation["offer"]["scope"] };
  preparations: Preparation[];
  reactivations: Reactivation[];
  preparationCount: number;
  contactCount: number;
};

export async function followUpApi<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await supabase.auth.getSession();
  // Isolated Vite/Playwright test harness only. Never enabled in a production build.
  const isolatedHarness = import.meta.env.DEV &&
    window.location.pathname.endsWith("/follow-up-test.html");
  const accessToken = isolatedHarness ? "playwright-isolated-test" : session.data.session?.access_token;
  if (!accessToken) throw new Error("Precisas de iniciar sessão.");
  const response = await fetch("/api/follow-up" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + accessToken,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error("Não foi possível atualizar o acompanhamento.");
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
