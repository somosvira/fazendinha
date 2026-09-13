import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { getStorage } from "../../lib/storage.js";
import { FinanceiroError } from "./regras.js";
import type { ConfiguracaoRelatorioFinanceiro } from "./relatorios.schemas.js";

const json = (v: unknown) => v as Prisma.InputJsonValue;
/** PDF textual deliberadamente simples, mas válido e independente de browser.
 * O snapshot JSON é a fonte auditável; o PDF é a cópia humana armazenada. */
function pdf(linhas: string[]) {
  const texto = linhas.map((linha) => linha.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[()\\]/g, "").slice(0, 120));
  const comandos = texto.map((linha) => `(${linha}) Tj`).join("\nT*\n");
  const corpo = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL", comandos, "ET"].join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(corpo)} >>\nstream\n${corpo}\nendstream`,
  ];
  let resultado = "%PDF-1.4\n";
  const offsets = [0];
  objetos.forEach((objeto, i) => { offsets.push(Buffer.byteLength(resultado)); resultado += `${i + 1} 0 obj\n${objeto}\nendobj\n`; });
  const xref = Buffer.byteLength(resultado);
  resultado += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(resultado);
}

export async function listarRelatorios(propriedadeId: number) {
  return prisma.relatorioFinanceiro.findMany({ where: { propriedadeId }, orderBy: { geradoEm: "desc" }, include: { autor: { select: { nome: true } } } })
    .then((rows) => rows.map((r) => ({ ...r, autor: r.autor?.nome ?? r.autorNome })));
}
export const obterRascunho = (propriedadeId: number, usuarioId: number) => prisma.rascunhoRelatorioFinanceiro.findUnique({ where: { propriedadeId_criadoPorId: { propriedadeId, criadoPorId: usuarioId } } });
export async function salvarRascunho(propriedadeId: number, usuarioId: number, configuracao: ConfiguracaoRelatorioFinanceiro, versao?: number) {
  const atual = await obterRascunho(propriedadeId, usuarioId);
  if (atual && versao !== atual.versao) throw new FinanceiroError("CONFLITO", "O rascunho foi alterado em outra sessão. Recarregue a página antes de continuar.");
  return atual ? prisma.rascunhoRelatorioFinanceiro.update({ where: { id: atual.id }, data: { configuracao: json(configuracao), versao: { increment: 1 } } }) : prisma.rascunhoRelatorioFinanceiro.create({ data: { propriedadeId, criadoPorId: usuarioId, configuracao: json(configuracao) } });
}
export const descartarRascunho = (propriedadeId: number, usuarioId: number) => prisma.rascunhoRelatorioFinanceiro.deleteMany({ where: { propriedadeId, criadoPorId: usuarioId } });
export async function gerarRelatorio(propriedadeId: number, usuario: { id: number | null; nome: string }, configuracao: ConfiguracaoRelatorioFinanceiro) {
  const criado = await prisma.relatorioFinanceiro.create({ data: { nome: configuracao.nome, parametros: json(configuracao), propriedadeId, autorId: usuario.id, autorNome: usuario.nome } });
  try {
    const operacoes = await prisma.operacao.findMany({ where: { propriedadeId, data: { gte: new Date(`${configuracao.dataInicio}T00:00:00Z`), lte: new Date(`${configuracao.dataFim}T23:59:59Z`) }, ...(configuracao.tipos.length ? { tipo: { in: configuracao.tipos } } : {}), ...(configuracao.status.length ? { status: { in: configuracao.status } } : {}), ...(configuracao.centroCustoIds.length ? { centroCustoId: { in: configuracao.centroCustoIds } } : {}) }, include: { centroCusto: true }, orderBy: { data: "asc" } });
    const snapshot = { configuracao, operacoes: operacoes.map((o) => ({ data: o.data.toISOString().slice(0, 10), tipo: o.tipo, status: o.status, valor: o.valorTotal.toString(), descricao: o.descricao, centroCusto: o.centroCusto?.nome ?? null })) };
    const storageKey = `relatorios-financeiros/${propriedadeId}/${criado.id}.pdf`;
    await (await getStorage()).putObject({ key: storageKey, body: pdf([configuracao.nome, `${configuracao.dataInicio} a ${configuracao.dataFim}`, ...snapshot.operacoes.map((o) => `${o.data} ${o.tipo} R$ ${o.valor}`)]), contentType: "application/pdf" });
    await prisma.relatorioFinanceiro.update({ where: { id: criado.id }, data: { status: "CONCLUIDO", storageKey, snapshot: json(snapshot), concluidoEm: new Date() } });
    if (usuario.id) await descartarRascunho(propriedadeId, usuario.id);
    return { id: criado.id };
  } catch (e) { await prisma.relatorioFinanceiro.update({ where: { id: criado.id }, data: { status: "FALHOU", erro: e instanceof Error ? e.message : "Falha na geração" } }); throw e; }
}
export async function baixarRelatorio(id: number, propriedadeId: number) { const r = await prisma.relatorioFinanceiro.findFirst({ where: { id, propriedadeId, status: "CONCLUIDO" } }); if (!r?.storageKey) throw new FinanceiroError("NAO_ENCONTRADO", "Relatório não encontrado"); return { nome: `${r.nome}.pdf`, buffer: await (await getStorage()).getObjectBuffer({ key: r.storageKey }) }; }
