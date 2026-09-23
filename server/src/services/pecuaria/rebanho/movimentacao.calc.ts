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
