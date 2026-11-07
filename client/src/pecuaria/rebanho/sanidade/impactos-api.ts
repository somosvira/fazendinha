import { reqSanidade } from "./api";

export type EntradaImpacto = {
  animalId: string;
  propriedadeId: number;
  data: string;
} & (
  | { origem: "OCORRENCIA"; doencaId: string }
  | { origem: "PROCEDIMENTO"; tipoAplicacaoId: string }
);
export type ConfirmacaoImpacto = { revisao: string; motivo: string };
export type PreviaImpactos = {
  versao: 1;
  entrada: EntradaImpacto;
  revisao: string;
  exigeConfirmacao: boolean;
  itens: Array<{
    participacaoId: string;
    protocolo: { nome: string; versao: number; finalidade: string };
    efeito: "AVISAR" | "BLOQUEAR" | "RETIRAR";
    regras: Array<{ id: string; motivo: string }>;
    tarefas: Array<{
      id: string;
      nomeSnapshot: string | null;
      etapa: { nome: string };
      previstaPara: string | null;
    }>;
    automacoes: Array<{ id: string; estado: string; programadaPara: string }>;
    dispositivos: Array<{ id: string; data: string }>;
  }>;
  dispositivos: Array<{ id: string; data: string }>;
};

export const preverImpactos = (entrada: EntradaImpacto) =>
  reqSanidade<PreviaImpactos>(
    "/impactos-protocolares/previa",
    { method: "POST", body: JSON.stringify(entrada) },
    entrada.propriedadeId,
  );
