import { ApiError, customFetch } from "@workspace/api-client-react";

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

/**
 * Uses the same AuthProvider-configured session transport as generated API hooks.
 * No per-feature Supabase session reads, bearer handling, or demo auth bypasses.
 */
export async function followUpApi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  try {
    const result = await customFetch<T>("/api/follow-up" + path, {
      ...init, requireAuth: true, responseType: "json",
    });
    // API PATCH endpoints return HTTP 204 without a response body.
    return (result === null ? undefined : result) as T;
  } catch (error) {
    // Browser diagnostic: HTTP status and technical cause, never auth headers/tokens.
    console.error("[follow-up] Request failed", {
      method, operation: path.split("/")[1] || "list",
      status: error instanceof ApiError ? error.status : undefined,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unexpected request error",
    });
    throw error;
  }
}

export function followUpSaveError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "Sessão expirada ou acesso não autorizado. Inicia sessão novamente.";
    return `${fallback} (HTTP ${error.status}).`;
  }
  if (error instanceof Error && error.message === "Precisas de iniciar sessão.") {
    return error.message;
  }
  return `${fallback}. Verifica a ligação e tenta novamente.`;
}
