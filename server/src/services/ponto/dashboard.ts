/* Loader do dashboard da Equipe & Ponto — compõe três leituras escopadas por
 * propriedade (quadro ativo, custo de MO por setor, folha do mês) e delega à
 * agregação pura. O `mes` vem do cliente (âncora do módulo, "2026-05");
 * mesCorrente() é só o fallback server-side quando ausente. */
import { listarFuncionarios } from "./funcionarios.js";
import { custoMOPorSetor } from "./custoMOSetor.js";
import { apurarFolha } from "./folha.service.js";
import { agregarDashboardPonto, type DashboardPontoDTO } from "./dashboard.agg.js";

/** "YYYY-MM" do mês corrente (UTC). Fallback quando o cliente não manda ?mes=. */
export function mesCorrente(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function buildPontoDashboard(
  mes: string,
  propriedadeId?: number | null,
): Promise<DashboardPontoDTO> {
  const [ativos, custoSetores, folha] = await Promise.all([
    listarFuncionarios({ ativo: true }, propriedadeId),
    custoMOPorSetor(propriedadeId),
    apurarFolha(mes, propriedadeId),
  ]);
  return agregarDashboardPonto({
    mes,
    funcionariosAtivos: ativos.length,
    custoSetores,
    folha,
  });
}
