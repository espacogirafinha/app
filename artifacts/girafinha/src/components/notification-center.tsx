import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Loader2, Smartphone } from "lucide-react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
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
    setPushBusy(true);
    try {
      if (isIosInstallRequired()) {
        setPushState("ios-install-required");
        return;
      }
      if (!supportsPush()) {
        setPushState("unsupported");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "disabled");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const config = await apiRequest<{ configured: boolean; publicKey: string }>(
        "/api/notifications/push-config",
      );
      if (!config.configured || !config.publicKey) {
        setPushState("unsupported");
        return;
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
      }
      await apiRequest("/api/notifications/push-subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      setPushState("active");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      if (!supportsPush()) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiRequest<void>("/api/notifications/push-subscriptions", {
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
  onEnable,
  onDisable,
}: {
  state: PushState;
  busy: boolean;
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
      {state === "active" ? (
        <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={onDisable}>
          {busy ? "A atualizar…" : "Desativar neste dispositivo"}
        </Button>
      ) : state === "disabled" ? (
        <Button size="sm" className="w-full" disabled={busy} onClick={onEnable}>
          {busy ? "A ativar…" : "Ativar notificações neste dispositivo"}
        </Button>
      ) : null}
    </div>
  );
}

async function detectPushState(): Promise<PushState> {
  if (isIosInstallRequired()) return "ios-install-required";
  if (!supportsPush()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "disabled";
  try {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.pushManager.getSubscription()) ? "active" : "disabled";
  } catch {
    return "unsupported";
  }
}

function supportsPush() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIosInstallRequired() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return isIos && !standalone;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
