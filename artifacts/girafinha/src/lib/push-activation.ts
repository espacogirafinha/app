export type PushActivationStage =
  | "permission"
  | "service_worker"
  | "push_config"
  | "subscription"
  | "save";

export class PushActivationError extends Error {
  constructor(
    public readonly stage: PushActivationStage,
    message: string,
  ) {
    super(message);
    this.name = "PushActivationError";
  }
}

export const PUSH_ACTIVATION_TIMEOUT_MS = 8_000;

export function supportsPushEnvironment() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIosInstallRequired() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return isIos && !standalone;
}

export async function getPushRegistration(
  timeoutMs = PUSH_ACTIVATION_TIMEOUT_MS,
): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new PushActivationError(
      "service_worker",
      "Este dispositivo não disponibiliza o service worker necessário.",
    );
  }

  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration =
      (await withTimeout(
        navigator.serviceWorker.getRegistration("/"),
        timeoutMs,
        "service_worker",
      )) ?? undefined;

    if (!registration) {
      registration = await withTimeout(
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }),
        timeoutMs,
        "service_worker",
      );
    }

    if (!registration.active) {
      registration = await withTimeout(
        navigator.serviceWorker.ready,
        timeoutMs,
        "service_worker",
      );
    }
  } catch (error) {
    if (error instanceof PushActivationError) throw error;
    throw new PushActivationError(
      "service_worker",
      "Não foi possível preparar o service worker.",
    );
  }

  if (!registration.pushManager) {
    throw new PushActivationError(
      "service_worker",
      "O serviço de notificações push não está disponível neste dispositivo.",
    );
  }

  return registration;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage: PushActivationStage,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new PushActivationError(
                stage,
                "A operação demorou demasiado tempo a responder.",
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function pushActivationMessage(error: unknown) {
  if (!(error instanceof PushActivationError)) {
    return {
      title: "Não foi possível ativar as notificações.",
      detail: "Fecha e volta a abrir a app e tenta novamente.",
    };
  }

  switch (error.stage) {
    case "service_worker":
      return {
        title: "Não foi possível preparar as notificações.",
        detail: "Fecha e volta a abrir a app e tenta novamente.",
      };
    case "push_config":
      return {
        title: "As notificações estão temporariamente indisponíveis.",
        detail: "Tenta novamente daqui a pouco.",
      };
    case "subscription":
      return {
        title: "Não foi possível criar a subscrição de notificações.",
        detail: "Confirma que a app está instalada no ecrã principal e tenta novamente.",
      };
    case "save":
      return {
        title: "A subscrição não ficou guardada.",
        detail: "Tenta novamente. A app pode reutilizar a subscrição já criada.",
      };
    case "permission":
      return {
        title: "Não foi possível pedir autorização para notificações.",
        detail: "Fecha e volta a abrir a app e tenta novamente.",
      };
  }
}
