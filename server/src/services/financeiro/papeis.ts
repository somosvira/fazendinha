import type { PapelParceiro, TipoParceiro } from "@prisma/client";

export function papeisLegados(tipo: TipoParceiro): PapelParceiro[] {
  return tipo === "AMBOS" ? ["CLIENTE", "FORNECEDOR"] : [tipo];
}

export function tipoLegado(papeis: PapelParceiro[]): TipoParceiro {
  if (papeis.includes("CLIENTE") && papeis.includes("FORNECEDOR")) return "AMBOS";
  return papeis.find((p) => p !== "PRESTADOR_SERVICO") ?? "FORNECEDOR";
}

export function papeisDoParceiro(parceiro: { tipo: TipoParceiro; papeis?: { papel: PapelParceiro }[] }): PapelParceiro[] {
  return parceiro.papeis?.length ? parceiro.papeis.map((p) => p.papel) : papeisLegados(parceiro.tipo);
}

export function papelCompativel(papeis: PapelParceiro[], tipoOperacao: string): boolean {
  if (tipoOperacao === "VENDA") return papeis.includes("CLIENTE");
  if (tipoOperacao === "SERVICO") return papeis.includes("PRESTADOR_SERVICO") || papeis.includes("FORNECEDOR");
  if (["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "DEVOLUCAO"].includes(tipoOperacao)) return papeis.includes("FORNECEDOR");
  return true;
}
