// Planejamento de fechar/abrir LocalizacaoAnimal e DestinoAnimal (sem I/O).

export class MovimentacaoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovimentacaoError";
  }
}

export interface LocalizacaoAtual {
  propriedadeId: number;
  loteId: string | null;
  desde: Date | string;
}

export interface LocalizacaoDestino {
  propriedadeId: number;
  loteId: string | null;
}

export type PlanoMovimentacao =
  | { tipo: "SEM_MUDANCA" }
  | {
    tipo: "MOVER";
    fechar: { ate: Date | string } | null;
    abrir: { propriedadeId: number; loteId: string | null; desde: Date | string };
  };

function paraTempo(valor: Date | string): number {
  return (typeof valor === "string" ? new Date(valor) : valor).getTime();
}

export function planejarMovimentacao(input: {
  atual: LocalizacaoAtual | null;
  destino: LocalizacaoDestino;
  data: Date | string;
}): PlanoMovimentacao {
  const { atual, destino, data } = input;

  if (atual && paraTempo(data) < paraTempo(atual.desde)) {
    throw new MovimentacaoError("Data da movimentação não pode ser anterior ao início da localização atual");
  }

  const semMudanca = atual != null && atual.propriedadeId === destino.propriedadeId && atual.loteId === destino.loteId;
  if (semMudanca) return { tipo: "SEM_MUDANCA" };

  return {
    tipo: "MOVER",
    fechar: atual ? { ate: data } : null,
    abrir: { propriedadeId: destino.propriedadeId, loteId: destino.loteId, desde: data },
  };
}

export interface DestinoAtual {
  aptidao: "LEITE" | "CORTE";
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA";
  desde: Date | string;
}

export interface DestinoNovo {
  aptidao: "LEITE" | "CORTE";
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA";
}

export type PlanoDestino =
  | { tipo: "SEM_MUDANCA" }
  | {
    tipo: "MOVER";
    fechar: { ate: Date | string } | null;
    abrir: { aptidao: "LEITE" | "CORTE"; papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA"; desde: Date | string };
  };

// ---------- desfazer (localização ou destino, mesma forma) ----------

export interface LinhaHistorico {
  id: string;
  desde: Date | string;
  ate: Date | string | null;
}

export interface PlanoDesfazer {
  remover: { id: string };
  reabrir: { id: string };
}

/**
 * Remove a linha aberta mais recente e reabre a linha imediatamente anterior (por `desde`).
 * Exige ao menos duas linhas e uma delas aberta — quem chama garante o resto (animal ativo,
 * a linha removida não referenciada por uma saída).
 */
export function planejarDesfazer(linhas: LinhaHistorico[]): PlanoDesfazer {
  if (linhas.length < 2) {
    throw new MovimentacaoError("É preciso ter ao menos duas linhas de histórico para desfazer");
  }

  const ordenadas = [...linhas].sort((a, b) => paraTempo(b.desde) - paraTempo(a.desde));
  const aberta = ordenadas.find((l) => l.ate == null);
  if (!aberta) throw new MovimentacaoError("Não há linha aberta para desfazer");

  const indice = ordenadas.indexOf(aberta);
  const anterior = ordenadas[indice + 1];
  if (!anterior) throw new MovimentacaoError("Não há linha anterior para reabrir");

  return { remover: { id: aberta.id }, reabrir: { id: anterior.id } };
}

export function planejarDestino(input: {
  atual: DestinoAtual | null;
  novo: DestinoNovo;
  data: Date | string;
}): PlanoDestino {
  const { atual, novo, data } = input;

  if (atual && paraTempo(data) < paraTempo(atual.desde)) {
    throw new MovimentacaoError("Data da mudança de destino não pode ser anterior ao início do destino atual");
  }

  const semMudanca = atual != null && atual.aptidao === novo.aptidao && atual.papelReprodutivo === novo.papelReprodutivo;
  if (semMudanca) return { tipo: "SEM_MUDANCA" };

  return {
    tipo: "MOVER",
    fechar: atual ? { ate: data } : null,
    abrir: { aptidao: novo.aptidao, papelReprodutivo: novo.papelReprodutivo, desde: data },
  };
}
