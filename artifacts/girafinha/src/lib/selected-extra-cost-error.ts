export type SelectedExtraCostErrorMessage = {
  title: string;
  description: string;
};

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const direct = (error as { status?: unknown }).status;
  if (typeof direct === "number") return direct;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : null;
}

export function selectedExtraCostErrorMessage(error: unknown): SelectedExtraCostErrorMessage {
  const status = errorStatus(error);

  if (status === 400) {
    return {
      title: "Custo inválido",
      description: "Confirma o valor introduzido e tenta novamente.",
    };
  }

  if (status === 401) {
    return {
      title: "Sessão expirada",
      description: "Volta a iniciar sessão e tenta guardar novamente.",
    };
  }

  if (status === 404) {
    return {
      title: "Extra não encontrado",
      description: "Atualiza os Relatórios e tenta novamente.",
    };
  }

  if (status === 405) {
    return {
      title: "Atualização indisponível",
      description: "Esta ação não está disponível neste momento.",
    };
  }

  if (status !== null && status >= 500) {
    return {
      title: "Erro do servidor",
      description: "O servidor não conseguiu guardar o custo. Tenta novamente.",
    };
  }

  return {
    title: "Não foi possível atualizar o custo",
    description: "Tenta novamente. Se o problema continuar, atualiza a página.",
  };
}
