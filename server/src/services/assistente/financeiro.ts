import { z } from "zod";
import { Prisma } from "@prisma/client";
import { obterDashboard } from "../financeiro/dashboard.js";
import { resumoSaldos } from "../financeiro/contas.js";
import { listarCompromissos } from "../financeiro/operacoes.js";
import { dinheiro } from "../financeiro/regras.js";
import { temArea, temPermissao } from "../auth/papeis.js";
import { RESPOSTA_ACESSO_NEGADO } from "./ajuda.js";
import { AssistenteError, type ContextoAssistente, type FerramentaAssistente } from "./tipos.js";

export const consultaFinanceiraSchema = z.object({
  visao: z.enum(["resumo", "saldo", "pagar", "receber", "despesas_categoria"]),
  inicio: z.string().date().nullable(), fim: z.string().date().nullable(),
}).strict();
export function hojeLocal(agora: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora);
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}
export function resolverPeriodo(inicio: string | null, fim: string | null, agora: Date) {
  if (!!inicio !== !!fim) throw new AssistenteError("VALIDACAO", "Informe início e fim do período.");
  const hoje = hojeLocal(agora);
  const de = inicio ?? `${hoje.slice(0, 7)}-01`;
  const ate = fim ?? new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).toISOString().slice(0, 10);
  if (de > ate || Date.parse(ate) - Date.parse(de) > 365 * 86_400_000) throw new AssistenteError("VALIDACAO", "Escolha um período de até 366 dias, com início igual ou anterior ao fim.");
  return { inicio: de, fim: ate, dataInicio: new Date(`${de}T00:00:00Z`), dataFim: new Date(`${ate}T23:59:59.999Z`) };
}
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const moeda = (valor: Prisma.Decimal) => `R$ ${valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(/\.(\d{2})$/, ",$1")}`;
// Até o mascaramento dos agregados ser granular, não excluir fatias silenciosamente:
// isso faria a resposta divergir da tela ou permitiria inferir valores restritos.
export function podeConsultarFinanceiro(ctx: ContextoAssistente, visao: string) {
  const u = ctx.usuario;
  const aba = visao === "saldo" ? "caixinha" : ["pagar", "receber"].includes(visao) ? "gastos" : "dashboard";
  return temArea(u, "financeiro") && (u.dono || u.abas.includes(aba))
    && (["verValores", "verInvestimento", "verSalarios"] as const).every(flag => temPermissao(u, flag));
}
export const ferramentaFinanceiro: FerramentaAssistente = {
  dominio: "financeiro", permitida: ctx => ["resumo", "saldo", "pagar", "receber"].some(v => podeConsultarFinanceiro(ctx, v)),
  spec: { type: "function", name: "consultar_financeiro", strict: true,
    description: "Consulta resumo realizado, saldo ATUAL, pendências a pagar/a receber por VENCIMENTO ou despesas por categoria. Período de até 366 dias. Sem filtros de parceiro/produto/categoria/salário, sem comparação e sem saldo histórico; nesses casos use consulta_indisponivel. Datas null = mês atual. Saldo exige ambas null.",
    parameters: { type: "object", properties: { visao: { type: "string", enum: ["resumo", "saldo", "pagar", "receber", "despesas_categoria"] }, inicio: { type: ["string", "null"], description: "YYYY-MM-DD inclusivo; null para mês atual." }, fim: { type: ["string", "null"], description: "YYYY-MM-DD inclusivo; null para mês atual." } }, required: ["visao", "inicio", "fim"], additionalProperties: false },
  },
  executar: async (args, ctx) => {
    const input = consultaFinanceiraSchema.parse(args);
    if (!podeConsultarFinanceiro(ctx, input.visao)) return RESPOSTA_ACESSO_NEGADO;
    if (input.visao === "saldo") {
      if (input.inicio || input.fim) throw new AssistenteError("VALIDACAO", "A consulta de saldo é atual. Saldo histórico ainda não está disponível no assistente.");
      const saldos = await resumoSaldos(ctx.propriedadeId);
      return { modo: "dados", resposta: [`Saldo atual em ${dataBR(hojeLocal(ctx.agora))}: ${moeda(saldos.saldoGeral)}.`, "Disponibilidade das contas ativas incluídas no saldo geral.", ...saldos.contas.slice(0, 20).map(c => `${c.nome}: ${moeda(c.saldoAtual)}${c.incluirNoSaldoGeral ? "" : " (fora da disponibilidade geral)"}`), ...(saldos.contas.length > 20 ? ["Exibindo as primeiras 20 contas; o saldo geral considera todas as contas elegíveis."] : [])].join("\n"), fontes: [{ titulo: "Contas e extratos · saldo atual", url: "/financeiro/contas" }] };
    }
    const p = resolverPeriodo(input.inicio, input.fim, ctx.agora);
    const periodo = { inicio: p.inicio, fim: p.fim };
    const cabecalho = `Período: ${dataBR(p.inicio)} a ${dataBR(p.fim)}.`;
    const parametros = new URLSearchParams(periodo).toString();
    if (input.visao === "pagar" || input.visao === "receber") {
      const tipo = input.visao === "pagar" ? "PAGAR" : "RECEBER";
      const compromissos = (await listarCompromissos(ctx.propriedadeId, { inicio: p.dataInicio, fim: p.dataFim }))
        .filter(c => c.tipo === tipo && ["PENDENTE", "PARCIAL"].includes(c.status));
      const total = dinheiro(compromissos.reduce((s, c) => s.plus(c.saldoPendente), dinheiro(0)));
      return { modo: "dados", resposta: [cabecalho, `A ${input.visao}: ${moeda(total)} em ${compromissos.length} compromisso(s) pendente(s).`, "Regime: pendências por vencimento, descontadas as liquidações válidas. Não é dinheiro já movimentado.", ...(compromissos.length ? compromissos.slice(0, 10).map(c => `#${c.seq} · ${dataBR(c.dataVencimento.toISOString().slice(0, 10))} · ${c.parceiro?.nome ?? "Sem parceiro"} · ${moeda(c.saldoPendente)}`) : ["Nenhum compromisso pendente encontrado nesse período."]), ...(compromissos.length > 10 ? ["Exibindo os primeiros 10 compromissos; o total considera todos os pendentes no período."] : [])].join("\n"), fontes: [{ titulo: "Compromissos · conferir vencimentos", url: `/financeiro/compromissos?${parametros}&situacao=${input.visao === "pagar" ? "pagar" : "receber"}`, periodo }] };
    }
    const d = await obterDashboard(ctx.propriedadeId, p.dataInicio, p.dataFim);
    const texto = input.visao === "despesas_categoria"
      ? [cabecalho, "Despesas por categoria · dinheiro realizado:", ...(d.despesasPorCategoria.length ? d.despesasPorCategoria.slice(0, 15).map(c => `${c.categoria}: ${moeda(c.valor)}`) : ["Nenhuma despesa por categoria encontrada nesse período."]), ...(d.despesasPorCategoria.length > 15 ? ["Exibindo as 15 maiores categorias. Confira todas na visão geral."] : [])]
      : [cabecalho, "Regime: dinheiro realizado (data de caixa).", `Entradas: ${moeda(d.realizado.entradas)}`, `Saídas: ${moeda(d.realizado.saidas)}`, `Resultado realizado: ${moeda(d.realizado.resultado)}`, "Pendências por vencimento no mesmo período:", `A pagar: ${moeda(d.compromissos.aPagar)}`, `A receber: ${moeda(d.compromissos.aReceber)}`];
    texto.push("Transferências entre contas próprias ficam fora do realizado. Estornos abatem o movimento original na data do estorno. O resultado do período não é o saldo atual.");
    return { modo: "dados", resposta: texto.join("\n"), fontes: [{ titulo: "Visão geral financeira · mesmo período", url: `/financeiro?${parametros}`, periodo }] };
  },
};
