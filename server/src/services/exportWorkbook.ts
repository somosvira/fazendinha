import ExcelJS from "exceljs";
import { gerarResultadoOperacional } from "./relatorio.js";
import { gerarRelatorioMensal, gerarRealizadoDiario, listarMesesRealizados } from "./relatoriosExtra.js";
import { construirAbaResultado, construirAbaMensal, construirAbaDiario } from "./exportXlsx.js";

// Monta o arquivo completo, como o "Relatório Rio Novo" original:
// Resultado Operacional + Projeção DRE + uma aba por mês + Realizado Diário.
export async function exportarWorkbookCompleto(): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Rio Novo";

  const realizado = await gerarResultadoOperacional("REALIZADO");
  construirAbaResultado(wb, realizado, "Resultado Operacional");

  const projecao = await gerarResultadoOperacional("PROJECAO");
  construirAbaResultado(wb, projecao, "Projeção DRE");

  const meses = await listarMesesRealizados();
  for (const mes of meses) {
    const rel = await gerarRelatorioMensal(mes, "REALIZADO");
    const [ano, m] = mes.split("-");
    construirAbaMensal(wb, rel, `${m}.${ano}`); // ex.: "01.2025"
  }

  if (meses.length) {
    const ultimo = meses[meses.length - 1];
    const diario = await gerarRealizadoDiario(ultimo);
    construirAbaDiario(wb, diario, "Realizado_Diário");
  }

  return wb.xlsx.writeBuffer();
}
