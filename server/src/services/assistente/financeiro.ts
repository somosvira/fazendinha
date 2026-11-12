import { z } from "zod";
import { Prisma } from "@prisma/client";
import { obterDashboard } from "../financeiro/dashboard.js";
import { resumoSaldos } from "../financeiro/contas.js";
import { listarCompromissos } from "../financeiro/operacoes.js";
import { dinheiro } from "../financeiro/regras.js";
import { temArea, temPermissao } from "../auth/papeis.js";
import { RESPOSTA_ACESSO_NEGADO } from "./ajuda.js";
import { AssistenteError, type ContextoAssistente, type DadosResposta, type FerramentaAssistente } from "./tipos.js";

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
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "novembro" quando o período é um mês civil inteiro; senão o intervalo. */
function nomePeriodo(inicio: string, fim: string) {
  const ultimo = new Date(Date.UTC(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return inicio.endsWith("-01") && fim === ultimo ? MESES[Number(inicio.slice(5, 7)) - 1] : `${dataBR(inicio).slice(0, 5)} a ${dataBR(fim).slice(0, 5)}`;
}
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const moeda = (valor: Prisma.Decimal) => `R$ ${valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(/\.(\d{2})$/, ",$1")}`;
// Até o mascaramento dos agregados ser granular, não excluir fatias silenciosamente:
// isso faria a resposta divergir da tela ou permitiria inferir valores restritos.
export function podeConsultarFinanceiro(ctx: ContextoAssistente, visao: string) {
  const u = ctx.usuario;
  const aba = visao === "saldo" ? "caixinha" : ["pagar", "receber"].includes(visao) ? "gastos" : "dashboard";
  return temArea(u, "financeiro") && (u.dono || u.abas.includes(aba))
    && (["verValores", "verSalarios"] as const).every(flag => temPermissao(u, flag));
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
      const contas = saldos.contas.slice(0, 20);
      const dados: DadosResposta = {
        titulo: "Saldo atual", contexto: `${ctx.nomeEscopo} · ${dataBR(hojeLocal(ctx.agora))} · contas ativas`,
        numeros: [{ rotulo: "Saldo geral", valor: moeda(saldos.saldoGeral), detalhe: plural(saldos.contas.filter(c => c.incluirNoSaldoGeral).length, "conta incluída", "contas incluídas"), destaque: true }],
        tabela: { colunas: [{ titulo: "Conta" }, { titulo: "Saldo", valor: true }], linhas: contas.map(c => ({ celulas: [c.incluirNoSaldoGeral ? c.nome : `${c.nome} (fora do saldo geral)`, moeda(c.saldoAtual)] })), ...(saldos.contas.length > 20 ? { nota: "Exibindo as primeiras 20 contas; o saldo geral considera todas." } : {}) },
      };
      return { modo: "dados", dados, resposta: [`Saldo atual em ${dataBR(hojeLocal(ctx.agora))}: ${moeda(saldos.saldoGeral)}.`, "Disponibilidade das contas ativas incluídas no saldo geral.", ...saldos.contas.slice(0, 20).map(c => `${c.nome}: ${moeda(c.saldoAtual)}${c.incluirNoSaldoGeral ? "" : " (fora da disponibilidade geral)"}`), ...(saldos.contas.length > 20 ? ["Exibindo as primeiras 20 contas; o saldo geral considera todas as contas elegíveis."] : [])].join("\n"), fontes: [{ titulo: "Contas e extratos · saldo atual", url: "/financeiro/contas" }] };
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
      const dados = dadosCompromissos(input.visao, compromissos, total, p, ctx);
      return { modo: "dados", dados, resposta: [cabecalho, `A ${input.visao}: ${moeda(total)} em ${compromissos.length} compromisso(s) pendente(s).`, "Regime: pendências por vencimento, descontadas as liquidações válidas. Não é dinheiro já movimentado.", ...(compromissos.length ? compromissos.slice(0, 10).map(c => `#${c.seq} · ${dataBR(c.dataVencimento.toISOString().slice(0, 10))} · ${c.parceiro?.nome ?? "Sem parceiro"} · ${moeda(c.saldoPendente)}`) : ["Nenhum compromisso pendente encontrado nesse período."]), ...(compromissos.length > 10 ? ["Exibindo os primeiros 10 compromissos; o total considera todos os pendentes no período."] : [])].join("\n"), fontes: [{ titulo: "Compromissos · conferir vencimentos", url: `/financeiro/compromissos?${parametros}&situacao=${input.visao === "pagar" ? "pagar" : "receber"}`, periodo }] };
    }
    const d = await obterDashboard(ctx.propriedadeId, p.dataInicio, p.dataFim);
    const texto = input.visao === "despesas_categoria"
      ? [cabecalho, "Despesas por categoria · dinheiro realizado:", ...(d.despesasPorCategoria.length ? d.despesasPorCategoria.slice(0, 15).map(c => `${c.categoria}: ${moeda(c.valor)}`) : ["Nenhuma despesa por categoria encontrada nesse período."]), ...(d.despesasPorCategoria.length > 15 ? ["Exibindo as 15 maiores categorias. Confira todas na visão geral."] : [])]
      : [cabecalho, "Regime: dinheiro realizado (data de caixa).", `Entradas: ${moeda(d.realizado.entradas)}`, `Saídas: ${moeda(d.realizado.saidas)}`, `Resultado realizado: ${moeda(d.realizado.resultado)}`, "Pendências por vencimento no mesmo período:", `A pagar: ${moeda(d.compromissos.aPagar)}`, `A receber: ${moeda(d.compromissos.aReceber)}`];
    texto.push("Transferências entre contas próprias ficam fora do realizado. Estornos abatem o movimento original na data do estorno. O resultado do período não é o saldo atual.");
    let dados: DadosResposta;
    if (input.visao === "despesas_categoria") {
      const total = d.despesasPorCategoria.reduce((s, c) => s.plus(c.valor), dinheiro(0));
      dados = {
        titulo: `Despesas de ${nomePeriodo(p.inicio, p.fim)} por categoria`, contexto: `${ctx.nomeEscopo} · ${dataBR(p.inicio)} a ${dataBR(p.fim)} · dinheiro realizado`,
        numeros: [{ rotulo: "Total de despesas", valor: moeda(total), detalhe: plural(d.despesasPorCategoria.length, "categoria", "categorias"), destaque: true }],
        ...(d.despesasPorCategoria[0] ? { leitura: `${d.despesasPorCategoria[0].categoria} é a maior despesa do período.` } : {}),
        tabela: { colunas: [{ titulo: "Categoria" }, { titulo: "Valor", valor: true }], linhas: d.despesasPorCategoria.slice(0, 15).map(c => ({ celulas: [c.categoria, moeda(c.valor)] })), ...(d.despesasPorCategoria.length > 15 ? { nota: "Exibindo as 15 maiores categorias." } : {}) },
      };
    } else {
      // O resumo destaca o que pesa no período: pendências a pagar ou o resultado realizado.
      const pagar = (await listarCompromissos(ctx.propriedadeId, { inicio: p.dataInicio, fim: p.dataFim })).filter(c => c.tipo === "PAGAR" && ["PENDENTE", "PARCIAL"].includes(c.status));
      const base = dadosCompromissos("pagar", pagar, d.compromissos.aPagar, p, ctx);
      const temPagar = d.compromissos.aPagar.gt(0);
      const semMovimento = d.realizado.entradas.isZero() && d.realizado.saidas.isZero();
      dados = {
        titulo: `Financeiro de ${nomePeriodo(p.inicio, p.fim)}`, contexto: `${ctx.nomeEscopo} · ${dataBR(p.inicio)} a ${dataBR(p.fim)} · regime de caixa`,
        numeros: [
          { ...base.numeros[0], rotulo: "A pagar no período", destaque: temPagar },
          { rotulo: "Resultado realizado", valor: moeda(d.realizado.resultado), detalhe: semMovimento ? "sem entradas ou saídas" : `entradas ${moeda(d.realizado.entradas)} · saídas ${moeda(d.realizado.saidas)}`, destaque: !temPagar },
          { rotulo: "A receber", valor: moeda(d.compromissos.aReceber), detalhe: d.compromissos.aReceber.isZero() ? "nenhum previsto" : "pendências por vencimento" },
        ],
        leitura: semMovimento ? (temPagar ? "Ainda não há movimento de caixa no período. O que pesa são os compromissos a pagar." : "Ainda não há movimento de caixa no período.") : `O resultado realizado é ${moeda(d.realizado.resultado)}; o saldo atual é outra consulta.`,
        ...(base.tabela ? { tabela: base.tabela } : {}),
      };
    }
    return { modo: "dados", dados, resposta: texto.join("\n"), fontes: [{ titulo: "Visão geral financeira · mesmo período", url: `/financeiro?${parametros}`, periodo }] };
  },
};

type Compromisso = Awaited<ReturnType<typeof listarCompromissos>>[number];
/** Pendências por vencimento: total em destaque, vencidos marcados e os próximos na tabela. */
function dadosCompromissos(visao: "pagar" | "receber", compromissos: Compromisso[], total: Prisma.Decimal, p: ReturnType<typeof resolverPeriodo>, ctx: ContextoAssistente): DadosResposta {
  const hoje = hojeLocal(ctx.agora);
  const ordenados = [...compromissos].sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());
  const vencidos = ordenados.filter(c => c.dataVencimento.toISOString().slice(0, 10) < hoje).length;
  const rotulo = visao === "pagar" ? "A pagar" : "A receber";
  return {
    titulo: `${rotulo} em ${nomePeriodo(p.inicio, p.fim)}`, contexto: `${ctx.nomeEscopo} · ${dataBR(p.inicio)} a ${dataBR(p.fim)} · por vencimento`,
    numeros: [{ rotulo, valor: moeda(total), detalhe: `${plural(compromissos.length, "compromisso", "compromissos")}${vencidos ? ` · ${plural(vencidos, "vencido", "vencidos")}` : ""}`, destaque: true }],
    ...(ordenados.length ? {
      tabela: {
        colunas: [{ titulo: "Vencimento" }, { titulo: "Compromisso" }, { titulo: "Valor", valor: true }],
        linhas: ordenados.slice(0, 10).map(c => {
          const venc = c.dataVencimento.toISOString().slice(0, 10);
          return { celulas: [`${dataBR(venc).slice(0, 5)}${venc < hoje ? " · vencido" : ""}`, c.parceiro?.nome ?? c.operacao?.descricao ?? `Compromisso #${c.seq}`, moeda(c.saldoPendente)], ...(venc < hoje ? { atraso: true } : {}) };
        }),
        ...(ordenados.length > 10 ? { nota: "Exibindo os 10 primeiros vencimentos; o total considera todos." } : {}),
      },
    } : { leitura: `Nenhum compromisso ${visao === "pagar" ? "a pagar" : "a receber"} pendente no período.` }),
  };
}
