import { temArea, temPermissao } from "../../auth/papeis.js";

type UsuarioCustos = { dono: boolean; areas: string[]; flags: string[] } | null;

/** Somente custos dos fatos pecuários já autorizados por animal/sítio na consulta. */
export function podeConsultarCustosPecuaria(usuario: UsuarioCustos): boolean {
  return !!usuario && temArea(usuario, "pecuaria");
}

/** Mantém a autorização financeira para editar valores e abrir dados financeiros. */
export function podeVerValoresFinanceiros(usuario: UsuarioCustos): boolean {
  return !!usuario && temArea(usuario, "financeiro") && temPermissao(usuario, "verValores");
}

// Campos atribuídos a um fato; totais de compras/Serviços e documentos não entram.
export const CAMPOS_CUSTO_OPERACIONAL = new Set([
  "valorProdutoAtribuido", "valorServicoAtribuido", "valorMaterialDocumentado",
  "custoProduto", "rateioServico",
]);
