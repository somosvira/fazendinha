import { RebanhoError } from "../rebanho/regras.js";

type Conduta = "AGUARDAR" | "IATF" | "DESCARTE";
export function resolverDecisaoIatf(input: { resultado: string; conduta?: Conduta | null; decisaoIatf?: "INDICAR" | "NAO_INDICAR" | null }) {
  if (input.decisaoIatf != null && input.resultado !== "NEGATIVO")
    throw new RebanhoError("VALIDACAO", "Decisão de nova IATF exige DG negativo", "decisaoIatf");
  if (input.decisaoIatf === "NAO_INDICAR" && input.conduta === "IATF")
    throw new RebanhoError("VALIDACAO", "A conduta contradiz a decisão de não indicar IATF", "decisaoIatf");
  if (input.decisaoIatf === "INDICAR" && input.conduta && input.conduta !== "IATF")
    throw new RebanhoError("VALIDACAO", "Revise a conduta antes de indicar IATF", "conduta");
  return { conduta: input.decisaoIatf === "INDICAR" ? "IATF" as const : input.conduta, decisaoIatf: input.decisaoIatf ?? null };
}

/** A unidade ausente só pode assumir uma unidade física de material genético. */
export function quantidadePadraoTentativa(tipo: "IA" | "TE" | "COBERTURA", quantidade: number | null | undefined, unidade: string | undefined) {
  if (tipo === "COBERTURA" || quantidade != null) return quantidade ?? null;
  if (unidade !== "DOSE" && unidade !== "UN")
    throw new RebanhoError("VALIDACAO", "Material exige quantidade explícita na unidade cadastrada; revise o produto", "quantidade");
  return 1;
}

/** Validação de novas escritas; a leitura histórica não passa por esta regra. */
export function validarConsumoExcepcionalTentativa(tipo: "IA" | "TE" | "COBERTURA", quantidade: number | null, unidade: string | undefined, motivo?: string) {
  if (tipo === "COBERTURA" || quantidade == null || quantidade === 1) return;
  if (tipo === "TE" && (unidade === "DOSE" || unidade === "UN"))
    throw new RebanhoError("VALIDACAO", "Registre um embrião por transferência. Perdas devem ser registradas separadamente no estoque; transferência de múltiplos embriões exige rastreabilidade individual", "quantidade");
  if (!motivo || motivo.trim().length < 5)
    throw new RebanhoError("VALIDACAO", "Informe o motivo do consumo excepcional. Perda de material deve ser registrada separadamente no estoque", "motivoQuantidadeExcepcional");
}
