import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Loader2, Smartphone } from "lucide-react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import {
  getPushRegistration,
  isIosInstallRequired,
  PushActivationError,
  pushActivationMessage,
  supportsPushEnvironment,
  withTimeout,
} from "@/lib/push-activation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  googleFormImportId: string | null;
  venueEventId: string | null;
  destination: string;
  createdAt: string;
  readAt: string | null;
};

type NotificationPage = {
  items: NotificationItem[];
  unreadCount: number;
};

type PushState =
  | "checking"
  | "unsupported"
  | "ios-install-required"
  | "disabled"
  | "blocked"
  | "active";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão terminada.");
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error("Não foi possível atualizar as notificações.");
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function NotificationCenter() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationPage>("/api/notifications"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });

  useEffect(() => {
    void detectPushState().then(setPushState);
  }, []);

  const items = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  async function openNotification(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) {
      await apiRequest<void>(`/api/notifications/${encodeURIComponent(item.id)}/read`, {
        method: "POST",
      });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    setLocation(item.destination);
  }

  async function markAllRead() {
    await apiRequest<void>("/api/notifications/read-all", { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function enablePush() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);

    try {
      if (isIosInstallRequired()) {
        setPushState("ios-install-required");
        return;
      }
      if (!supportsPushEnvironment()) {
        setPushState("unsupported");
        return;
      }

      let permission = Notification.permission;
      if (permission === "denied") {
        setPushState("blocked");
        return;
      }
      if (permission !== "granted") {
        try {
          permission = await Notification.requestPermission();
        } catch {
          throw new PushActivationError(
            "permission",
            "Notification.requestPermission falhou.",
          );
        }
      }
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "disabled");
        if (permission === "denied") {
          setPushError(
            "A permissão está bloqueada. Ativa as notificações nas definições do iPhone para esta app.",
          );
        }
        return;
      }
      logPushStage("permission_granted");

      const registration = await getPushRegistration();
      logPushStage("service_worker_ready");

      let config: { configured: boolean; publicKey: string };
      try {
        config = await withTimeout(
          apiRequest<{ configured: boolean; publicKey: string }>(
            "/api/push-config",
          ),
          8_000,
          "push_config",
        );
      } catch (error) {
        if (error instanceof PushActivationError) throw error;
        throw new PushActivationError(
          "push_config",
          "Não foi possível obter a configuração push.",
        );
      }
      if (!config.configured || !config.publicKey) {
        throw new PushActivationError(
          "push_config",
          "Configuração push indisponível.",
        );
      }

      let subscription: PushSubscription | null;
      try {
        subscription = await withTimeout(
          registration.pushManager.getSubscription(),
          8_000,
          "subscription",
        );
        if (!subscription) {
          subscription = await withTimeout(
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(config.publicKey),
            }),
            8_000,
            "subscription",
          );
          logPushStage("subscription_created");
        }
      } catch (error) {
        if (error instanceof PushActivationError) throw error;
        throw new PushActivationError(
          "subscription",
          "Não foi possível criar a subscrição push.",
        );
      }

      try {
        await withTimeout(
          apiRequest("/api/push-subscriptions", {
            method: "POST",
            body: JSON.stringify(subscription.toJSON()),
          }),
          8_000,
          "save",
        );
      } catch (error) {
        if (error instanceof PushActivationError) throw error;
        throw new PushActivationError(
          "save",
          "Não foi possível guardar a subscrição push.",
        );
      }

      logPushStage("subscription_saved");
      setPushState("active");
      setPushError(null);
    } catch (error) {
      const feedback = pushActivationMessage(error);
      const stage =
        error instanceof PushActivationError ? error.stage : "unknown";
      logPushFailure(stage);
      setPushState(Notification.permission === "denied" ? "blocked" : "disabled");
      setPushError(`${feedback.title} ${feedback.detail}`);
      toast({
        variant: "destructive",
        title: feedback.title,
        description: feedback.detail,
      });
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      if (!supportsPushEnvironment()) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiRequest<void>("/api/push-subscriptions", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setPushState(Notification.permission === "denied" ? "blocked" : "disabled");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={unreadCount ? `Notificações: ${unreadCount} por ler` : "Notificações"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-5 text-destructive-foreground">
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount ? `${unreadCount} por ler` : "Tudo em dia"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              Marcar todas
            </Button>
          )}
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {query.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Ainda não há notificações.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item)}
                className={`block w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                  item.readAt ? "bg-background" : "bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!item.readAt && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.message}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("pt-PT", {
                        timeZone: "Europe/Lisbon",
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <PushControls
          state={pushState}
          busy={pushBusy}
          error={pushError}
          onEnable={() => void enablePush()}
          onDisable={() => void disablePush()}
        />
      </PopoverContent>
    </Popover>
  );
}

function PushControls({
  state,
  busy,
  error,
  onEnable,
  onDisable,
}: {
  state: PushState;
  busy: boolean;
  error: string | null;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const text = useMemo(() => {
    if (state === "active") return "Notificações ativas neste dispositivo";
    if (state === "blocked") return "Permissão bloqueada no browser";
    if (state === "unsupported") return "Dispositivo/browser não compatível";
    if (state === "ios-install-required")
      return "No iPhone, adiciona primeiro esta app ao ecrã principal e abre-a a partir daí.";
    if (state === "checking") return "A verificar notificações deste dispositivo…";
    return "Notificações push desativadas";
  }, [state]);

  return (
    <div className="space-y-2 border-t bg-muted/20 px-4 py-3">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        {state === "active" ? (
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span>{text}</span>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {state === "active" ? (
        <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={onDisable}>
          {busy ? "A atualizar…" : "Desativar neste dispositivo"}
        </Button>
      ) : state === "disabled" ? (
        <Button size="sm" className="w-full" disabled={busy} onClick={onEnable}>
          {busy ? "A ativar…" : error ? "Tentar novamente" : "Ativar notificações neste dispositivo"}
        </Button>
      ) : null}
    </div>
  );
}

async function detectPushState(): Promise<PushState> {
  if (isIosInstallRequired()) return "ios-install-required";
  if (!supportsPushEnvironment()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "disabled";
  try {
    const registration = await withTimeout(
      navigator.serviceWorker.getRegistration("/"),
      2_000,
      "service_worker",
    );
    if (!registration?.pushManager) return "disabled";
    return (await withTimeout(
      registration.pushManager.getSubscription(),
      2_000,
      "subscription",
    ))
      ? "active"
      : "disabled";
  } catch {
    return "disabled";
  }
}

function logPushStage(stage: string) {
  console.info(`[push] ${stage}`);
}

function logPushFailure(stage: string) {
  console.warn(`[push] activation_failed:${stage}`);
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
