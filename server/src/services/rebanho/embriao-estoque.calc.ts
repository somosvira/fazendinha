export type EstadoEmbriao = "DISPONIVEL" | "TRANSFERIDO" | "DESCARTADO";

export function planejarTransferenciaEmbriao(input: { estadoAtual: EstadoEmbriao }): {
  transferir: boolean;
  novoEstado: EstadoEmbriao;
  erro: "EMBRIAO_INDISPONIVEL" | null;
} {
  if (input.estadoAtual !== "DISPONIVEL") {
    return { transferir: false, novoEstado: input.estadoAtual, erro: "EMBRIAO_INDISPONIVEL" };
  }
  return { transferir: true, novoEstado: "TRANSFERIDO", erro: null };
}

export function planejarDevolucaoEmbriao(input: { estadoAtual: EstadoEmbriao }): {
  devolver: boolean;
  novoEstado: EstadoEmbriao;
} {
  if (input.estadoAtual !== "TRANSFERIDO") return { devolver: false, novoEstado: input.estadoAtual };
  return { devolver: true, novoEstado: "DISPONIVEL" };
}
