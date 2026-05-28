import { Router } from "express";
import { gerarResultadoOperacional, type Tipo } from "../services/relatorio.js";
import { gerarRelatorioMensal, gerarRealizadoDiario, listarMesesRealizados } from "../services/relatoriosExtra.js";
import { gerarDashboard } from "../services/dashboard.js";
import { exportarResultadoOperacional, construirAbaMensal, construirAbaDiario } from "../services/exportXlsx.js";
import { exportarWorkbookCompleto } from "../services/exportWorkbook.js";
import ExcelJS from "exceljs";

export const relatoriosRouter = Router();

function parseTipo(q: unknown): Tipo {
  return q === "PROJECAO" ? "PROJECAO" : "REALIZADO";
}

function sendXlsx(res: any, buffer: ExcelJS.Buffer, nome: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(nome)}"`);
  res.send(Buffer.from(buffer));
}

// --- Resultado Operacional / Projeção -------------------------------------
relatoriosRouter.get("/resultado-operacional", async (req, res) => {
  res.json(await gerarResultadoOperacional(parseTipo(req.query.tipo)));
});
relatoriosRouter.get("/resultado-operacional.xlsx", async (req, res) => {
  const tipo = parseTipo(req.query.tipo);
  const buffer = await exportarResultadoOperacional(await gerarResultadoOperacional(tipo));
  sendXlsx(res, buffer, `Rio Novo - ${tipo === "REALIZADO" ? "Resultado Operacional" : "Projecao"}.xlsx`);
});

// --- Painel por atividade --------------------------------------------------
relatoriosRouter.get("/dashboard", async (req, res) => {
  res.json(await gerarDashboard(parseTipo(req.query.tipo)));
});

// --- Meses disponíveis -----------------------------------------------------
relatoriosRouter.get("/meses", async (_req, res) => {
  res.json(await listarMesesRealizados());
});

// --- Mensal ----------------------------------------------------------------
relatoriosRouter.get("/mensal/:mes", async (req, res) => {
  res.json(await gerarRelatorioMensal(req.params.mes, parseTipo(req.query.tipo)));
});
relatoriosRouter.get("/mensal/:mes/xlsx", async (req, res) => {
  const rel = await gerarRelatorioMensal(req.params.mes, parseTipo(req.query.tipo));
  const wb = new ExcelJS.Workbook();
  construirAbaMensal(wb, rel, rel.mesKey.replace("-", "."));
  sendXlsx(res, await wb.xlsx.writeBuffer(), `Rio Novo - ${rel.label.replace("/", "-")}.xlsx`);
});

// --- Realizado Diário ------------------------------------------------------
relatoriosRouter.get("/diario/:mes", async (req, res) => {
  res.json(await gerarRealizadoDiario(req.params.mes));
});
relatoriosRouter.get("/diario/:mes/xlsx", async (req, res) => {
  const rel = await gerarRealizadoDiario(req.params.mes);
  const wb = new ExcelJS.Workbook();
  construirAbaDiario(wb, rel, "Realizado_Diário");
  sendXlsx(res, await wb.xlsx.writeBuffer(), `Rio Novo - Diario ${rel.label.replace("/", "-")}.xlsx`);
});

// --- Workbook completo (todas as abas) ------------------------------------
relatoriosRouter.get("/completo.xlsx", async (_req, res) => {
  sendXlsx(res, await exportarWorkbookCompleto(), `Relatório Rio Novo.xlsx`);
});
