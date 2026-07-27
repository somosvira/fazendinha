export interface PlanoBaixaDose { consumir: boolean; novoSaldo: number; aviso: string | null }

// Baixa opcional-com-aviso: sem lote não consome; com lote e saldo ≥ 1 tira uma dose;
// com lote e saldo 0 registra o vínculo mesmo assim e avisa — o saldo nunca fica negativo.
export function planejarBaixaDose(input: {
  estoqueSemenId: number | null | undefined;
  dosesDisponiveis: number;
}): PlanoBaixaDose {
  if (input.estoqueSemenId == null) return { consumir: false, novoSaldo: input.dosesDisponiveis, aviso: null };
  if (input.dosesDisponiveis <= 0) {
    return { consumir: false, novoSaldo: 0, aviso: "estoque zerado: dose registrada sem baixa" };
  }
  return { consumir: true, novoSaldo: input.dosesDisponiveis - 1, aviso: null };
}

// Inverso da baixa (estorno/exclusão da IA): só devolve quando a dose foi de fato consumida.
export function planejarDevolucaoDose(input: {
  doseBaixada: boolean;
  dosesDisponiveis: number;
}): { devolver: boolean; novoSaldo: number } {
  if (!input.doseBaixada) return { devolver: false, novoSaldo: input.dosesDisponiveis };
  return { devolver: true, novoSaldo: input.dosesDisponiveis + 1 };
}
