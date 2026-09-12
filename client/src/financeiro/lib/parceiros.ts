import type { DadosParceiro, PapelParceiro, TipoParceiro } from "../novo-api";

export const PAPEIS_PARCEIRO: Record<PapelParceiro, string> = {
  CLIENTE: "Cliente", FORNECEDOR: "Fornecedor", PRESTADOR_SERVICO: "Prestador de serviço",
  FUNCIONARIO: "Funcionário/colaborador", PROPRIETARIO: "Sócio/proprietário", OUTRO: "Outro",
};
export const FORMAS_PAGAMENTO: Record<string, string> = {
  PIX: "Pix", TRANSFERENCIA_BANCARIA: "Transferência bancária", BOLETO: "Boleto", DINHEIRO: "Dinheiro",
  CARTAO: "Cartão", CHEQUE: "Cheque", DEBITO_AUTOMATICO: "Débito automático", OUTRO: "Outro",
};

export function papeisDoParceiro(parceiro: DadosParceiro & { tipo: TipoParceiro }): PapelParceiro[] {
  return parceiro.papeis?.length ? parceiro.papeis : parceiro.tipo === "AMBOS" ? ["CLIENTE", "FORNECEDOR"] : [parceiro.tipo];
}

export function parceiroCompativel(parceiro: DadosParceiro & { tipo: TipoParceiro; ativo: boolean }, operacao: string) {
  if (!parceiro.ativo) return false;
  const papeis = papeisDoParceiro(parceiro);
  if (operacao === "VENDA") return papeis.includes("CLIENTE");
  if (operacao === "SERVICO") return papeis.includes("PRESTADOR_SERVICO") || papeis.includes("FORNECEDOR");
  if (["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "DEVOLUCAO"].includes(operacao)) return papeis.includes("FORNECEDOR");
  return true;
}

export function parcelasSugeridas(total: number, data: string, prazos: number[]) {
  const centavos = Math.round(total * 100);
  if (!prazos.length || !Number.isFinite(centavos) || centavos < prazos.length || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return [];
  const base = new Date(`${data}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return [];
  return prazos.map((dias, i) => {
    const vencimento = new Date(base);
    vencimento.setUTCDate(vencimento.getUTCDate() + dias);
    const valor = Math.floor(centavos / prazos.length) + (i < centavos % prazos.length ? 1 : 0);
    return { valor: (valor / 100).toFixed(2), vencimento: vencimento.toISOString().slice(0, 10) };
  });
}
