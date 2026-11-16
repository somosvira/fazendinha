export type DecisaoOperacionalDemanda = {
  id: string;
  tipo: string;
  data: Date | null;
  destino: string | null;
  motivo: string;
};
export function dataOperacionalDemanda(d: {
  previstaPara: Date | null;
  decisaoOperacional?: DecisaoOperacionalDemanda | null;
}) {
  return d.decisaoOperacional?.data ?? d.previstaPara;
}
export function demandaDispensada(d: {
  decisaoOperacional?: DecisaoOperacionalDemanda | null;
}) {
  return d.decisaoOperacional?.tipo === "DISPENSAR";
}
/** DTO operacional conserva a data da regra em campo próprio, sem alterar o fato persistido. */
export function projetarAgendaDemanda<
  T extends {
    previstaPara: Date | null;
    estado: string;
    decisaoOperacional?: DecisaoOperacionalDemanda | null;
  },
>(d: T) {
  return {
    ...d,
    previstaPelaRegra: d.previstaPara,
    previstaPara: dataOperacionalDemanda(d),
    ...(d.estado === "PENDENTE" && demandaDispensada(d)
      ? { estado: "ENCERRADA", motivoEncerramento: "DISPENSA_ADMINISTRATIVA" }
      : {}),
  };
}
