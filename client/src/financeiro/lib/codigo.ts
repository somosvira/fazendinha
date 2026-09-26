import { codigoOperacao } from "../../estoque/navegacao";

/** O número da operação é atribuído pelo servidor; até sincronizar ela não tem código. */
export const codigoOperacaoFinanceira = (numero: number | null | undefined) => numero == null ? "OP pendente" : codigoOperacao(numero);
