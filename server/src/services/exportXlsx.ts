import ExcelJS from "exceljs";
import type { Relatorio } from "./relatorio.js";
import type { RelatorioMensal, RelatorioDiario } from "./relatoriosExtra.js";

const MONEY = '_-R$ * #,##0.00_-;[Red]-R$ * #,##0.00_-;_-R$ * "-"??_-';
const COR_TITULO = "FF1F4E2C";
const COR_HEADER = "FFD9E8DC";
const COR_CENTRO = "FFBFD8C4";
const COR_TOTAL = "FFF0F0F0";

const natLabel = (n: string) => (n === "CREDITO" ? "Crédito" : "Débito");

function tituloRow(ws: ExcelJS.Worksheet, texto: string, span: number) {
  const r = ws.addRow([texto]);
  ws.mergeCells(r.number, 1, r.number, span);
  r.getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_TITULO } };
  r.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  r.height = 24;
}

// ---------------------------------------------------------------------------
// ABA: Resultado Operacional / Projeção (centro de custo × mês)
// ---------------------------------------------------------------------------
export function construirAbaResultado(wb: ExcelJS.Workbook, rel: Relatorio, nomeAba: string) {
  const ws = wb.addWorksheet(nomeAba);
  const labelCols = 4;
  const monthCols = rel.meses.length;
  const totalCol = labelCols + monthCols + 1;

  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 26;
  for (let i = 0; i < monthCols; i++) ws.getColumn(labelCols + 1 + i).width = 14;
  ws.getColumn(totalCol).width = 16;

  tituloRow(ws, rel.titulo, totalCol);
  ws.addRow([
    `Situação: ${rel.tipo === "REALIZADO" ? "Liquidado (realizado)" : "Aberto (projeção)"}  |  Estorno: Não  |  Fonte: Rio Novo  |  Regime: Caixa`,
  ]);
  ws.addRow([]);

  const head = ["Centro de Custo", "C/D", "Grupo Categoria", "Categoria", ...rel.meses.map((m) => m.label), "Total"];
  const headerRow = ws.addRow(head);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_HEADER } };
    cell.alignment = { horizontal: "center" };
    cell.border = { bottom: { style: "thin" } };
  });
  ws.views = [{ state: "frozen", xSplit: labelCols, ySplit: headerRow.number }];

  const monthValues = (vals: Record<string, number>) => rel.meses.map((m) => vals[m.key] ?? null);

  function styleMoney(row: ExcelJS.Row, bold = false, fill?: string) {
    for (let c = labelCols + 1; c <= totalCol; c++) {
      const cell = row.getCell(c);
      cell.numFmt = MONEY;
      if (bold) cell.font = { bold: true };
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
    if (fill) {
      for (let c = 1; c <= labelCols; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        if (bold) row.getCell(c).font = { bold: true };
      }
    }
  }

  for (const centro of rel.centros) {
    const cRow = ws.addRow([centro.centro]);
    cRow.getCell(1).font = { bold: true };
    styleMoney(cRow, true, COR_CENTRO);
    for (const nat of centro.naturezas) {
      for (const grupo of nat.grupos) {
        for (const cat of grupo.categorias) {
          const r = ws.addRow(["", natLabel(nat.natureza), grupo.grupo, cat.categoria, ...monthValues(cat.valores), cat.total]);
          styleMoney(r);
        }
        const gRow = ws.addRow(["", "", `${grupo.grupo} Total`, "", ...monthValues(grupo.subtotais), grupo.total]);
        gRow.getCell(3).font = { italic: true, bold: true };
        styleMoney(gRow, true);
      }
      const nRow = ws.addRow(["", `${natLabel(nat.natureza)} Total`, "", "", ...monthValues(nat.totais), nat.total]);
      nRow.getCell(2).font = { bold: true };
      styleMoney(nRow, true, COR_TOTAL);
    }
    const tRow = ws.addRow([`${centro.centro} Total`, "", "", "", ...monthValues(centro.totais), centro.total]);
    tRow.getCell(1).font = { bold: true };
    styleMoney(tRow, true, COR_CENTRO);
  }

  ws.addRow([]);
  const tg = ws.addRow(["Total Geral", "", "", "", ...monthValues(rel.totalGeral), rel.totalGeralAcumulado]);
  tg.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_TITULO } };
  });
  styleMoney(tg, true);
  for (let c = labelCols + 1; c <= totalCol; c++) tg.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" } };
  return ws;
}

// ---------------------------------------------------------------------------
// ABA: Mensal (categoria × centro de custo, um mês)
// ---------------------------------------------------------------------------
export function construirAbaMensal(wb: ExcelJS.Workbook, rel: RelatorioMensal, nomeAba: string) {
  const ws = wb.addWorksheet(nomeAba);
  const labelCols = 3; // C/D | Grupo | Categoria
  const colCount = rel.centros.length;
  const totalCol = labelCols + colCount + 1;

  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 26;
  for (let i = 0; i < colCount; i++) ws.getColumn(labelCols + 1 + i).width = 22;
  ws.getColumn(totalCol).width = 16;

  tituloRow(ws, `${rel.titulo} — ${rel.label}`, totalCol);
  ws.addRow([`Situação: ${rel.tipo === "REALIZADO" ? "Liquidado" : "Aberto"}  |  Fonte: Rio Novo  |  Regime: Caixa`]);
  ws.addRow([]);

  const head = ["C/D", "Grupo Categoria", "Categoria", ...rel.centros, "Total"];
  const headerRow = ws.addRow(head);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_HEADER } };
    cell.alignment = { horizontal: "center" };
    cell.border = { bottom: { style: "thin" } };
  });

  const centroValues = (vals: Record<string, number>) => rel.centros.map((c) => vals[c] ?? null);
  function styleMoney(row: ExcelJS.Row, bold = false, fill?: string) {
    for (let c = labelCols + 1; c <= totalCol; c++) {
      const cell = row.getCell(c);
      cell.numFmt = MONEY;
      if (bold) cell.font = { bold: true };
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
    if (fill) for (let c = 1; c <= labelCols; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }

  for (const nat of rel.naturezas) {
    for (const grupo of nat.grupos) {
      for (const cat of grupo.categorias) {
        const r = ws.addRow([natLabel(nat.natureza), grupo.grupo, cat.categoria, ...centroValues(cat.porCentro), cat.total]);
        styleMoney(r);
      }
      const gRow = ws.addRow(["", `${grupo.grupo} Total`, "", ...centroValues(grupo.subtotais), grupo.total]);
      gRow.getCell(2).font = { italic: true, bold: true };
      styleMoney(gRow, true);
    }
    const nRow = ws.addRow([`${natLabel(nat.natureza)} Total`, "", "", ...centroValues(nat.totais), nat.total]);
    nRow.getCell(1).font = { bold: true };
    styleMoney(nRow, true, COR_TOTAL);
  }

  ws.addRow([]);
  const tg = ws.addRow(["Total Geral", "", "", ...centroValues(rel.totalGeral), rel.totalGeralAcumulado]);
  tg.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_TITULO } };
  });
  styleMoney(tg, true);
  for (let c = labelCols + 1; c <= totalCol; c++) tg.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" } };
  return ws;
}

// ---------------------------------------------------------------------------
// ABA: Realizado Diário
// ---------------------------------------------------------------------------
export function construirAbaDiario(wb: ExcelJS.Workbook, rel: RelatorioDiario, nomeAba: string) {
  const ws = wb.addWorksheet(nomeAba);
  const totalCol = 7;
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 26;
  ws.getColumn(5).width = 34;
  ws.getColumn(6).width = 22;
  ws.getColumn(7).width = 16;

  tituloRow(ws, `${rel.titulo} — ${rel.label}`, totalCol);
  ws.addRow(["Situação: Liquidado  |  Fonte: Rio Novo  |  Regime: Caixa"]);
  ws.addRow([]);

  const headerRow = ws.addRow(["Data", "C/D", "Grupo", "Categoria", "Cliente/Fornecedor", "Centro de Custo", "Valor"]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_HEADER } };
    cell.alignment = { horizontal: "center" };
    cell.border = { bottom: { style: "thin" } };
  });

  for (const dia of rel.dias) {
    for (const l of dia.linhas) {
      const r = ws.addRow([dia.label, l.natureza === "CREDITO" ? "C" : "D", l.grupo, l.categoria, l.fornecedor ?? "—", l.centro, l.valor]);
      r.getCell(totalCol).numFmt = MONEY;
    }
    const dRow = ws.addRow([`${dia.label} — Total do dia`, "", "", "", "", "", dia.total]);
    dRow.getCell(1).font = { italic: true, bold: true };
    dRow.getCell(totalCol).numFmt = MONEY;
    dRow.getCell(totalCol).font = { bold: true };
    ws.mergeCells(dRow.number, 1, dRow.number, 6);
  }

  ws.addRow([]);
  const tg = ws.addRow(["Total Geral", "", "", "", "", "", rel.total]);
  tg.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_TITULO } };
  });
  tg.getCell(totalCol).numFmt = MONEY;
  ws.mergeCells(tg.number, 1, tg.number, 6);
  return ws;
}

// Helpers de export de arquivo único
export async function exportarResultadoOperacional(rel: Relatorio): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Rio Novo";
  construirAbaResultado(wb, rel, rel.tipo === "REALIZADO" ? "Resultado Operacional" : "Projeção DRE");
  return wb.xlsx.writeBuffer();
}
