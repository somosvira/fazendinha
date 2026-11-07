import { reqSanidade } from "../sanidade/api";

export type DestinoRevisaoBloqueio = "RETOMAR" | "RETIRAR";
export type BloqueioParticipacao = {
  bloqueadaEm?: string | null;
  motivoBloqueio?: string | null;
};
export type RevisaoBloqueioInput = {
  chave: string;
  propriedadeId: number;
  bloqueadaEm: string;
  destino: DestinoRevisaoBloqueio;
  motivo: string;
};
export type ReciboRevisaoBloqueio = {
  id: string;
  bloqueadaEm: string | null;
  canceladaEm: string | null;
};

export function revisarBloqueioParticipacao(
  id: string,
  input: RevisaoBloqueioInput,
) {
  return reqSanidade<ReciboRevisaoBloqueio>(
    `/participacoes/${encodeURIComponent(id)}/revisao-impacto`,
    { method: "POST", body: JSON.stringify(input) },
    input.propriedadeId,
  );
}
