import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { obterDashboard } from "../financeiro/dashboard.js";
import { resumoSaldos } from "../financeiro/contas.js";
import { listarCompromissos } from "../financeiro/operacoes.js";
import { analisarCategorias } from "../financeiro/analise-categorias.js";
import { SEM_VINCULO } from "../../lib/ids.js";
import { ConsultaAssistenteError, hojeBrasil, type ConsultaFinanceira } from "./consulta.schema.js";

type Valor = { rotulo: string; valor: string };
export type FonteConsulta = { titulo: string; url: string };
export interface ResultadoFinanceiro {
  valores: Valor[];
  detalhes: Valor[];
  observacoes: string[];
  fontes: FonteConsulta[];
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const dataBR = (s: string) => s.split("-").reverse().join("/");
export const moeda = (s: string) => {
  const [inteiro, centavos] = new Prisma.Decimal(s).toFixed(2).split(".");
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${centavos}`;
};
const valor = (rotulo: string, n: Prisma.Decimal): Valor => ({ rotulo, valor: n.toFixed(2) });

export function compararValores(atual: Valor[], anterior: Valor[]): string[] {
  return atual.flatMap(a => {
    const b = anterior.find(b => b.rotulo === a.rotulo);
    if (!b) return [];
    const delta = new Prisma.Decimal(a.valor).minus(b.valor);
    const percentual = new Prisma.Decimal(b.valor).gt(0) ? ` (${delta.div(b.valor).mul(100).toFixed(2).replace(".", ",")}%)` : " (sem percentual: a base anterior é zero ou negativa)";
    return [`${a.rotulo}: ${moeda(a.valor)} agora; ${moeda(b.valor)} no período comparado. Diferença: ${moeda(delta.toFixed(2))}${percentual}.`];
  });
}

async function conferirVolume(c: ConsultaFinanceira, propriedadeId: number | null) {
  const escopo = propriedadeId === null ? {} : { propriedadeId };
  const data = c.inicio && c.fim ? { gte: new Date(`${c.inicio}T00:00:00Z`), lte: new Date(`${c.fim}T23:59:59.999Z`) } : undefined;
  const pendentes = c.assunto === "pagar" || c.assunto === "receber";
  const whereTransacao = { ...escopo, ...(data ? { data } : {}) };
  const contarCompromissos = () => prisma.compromissoFinanceiro.count({ where: { operacao: escopo, ...(data ? { dataVencimento: data } : {}) } });
  const contarHistoricoContas = () => prisma.movimentoConta.count({ where: { conta: { ...escopo, ativo: true } } });
  let volumes: Promise<number>[];
  if (pendentes) volumes = [contarCompromissos()];
  else if (c.assunto === "saldos") volumes = [contarHistoricoContas()];
  else {
    volumes = [prisma.movimentoConta.count({ where: { transacao: whereTransacao } })];
    // O dashboard também lê compromissos, transações sem movimento e todo o
    // histórico das contas ativas, mesmo numa pergunta sobre um único mês.
    if (!c.categoria) volumes.push(contarCompromissos(), contarHistoricoContas(), prisma.transacaoFinanceira.count({ where: whereTransacao }));
  }
  if ((await Promise.all(volumes)).some(quantidade => quantidade > 20_000)) {
    throw new ConsultaAssistenteError("Há muitos registros para esta demonstração. Reduza o período ou selecione um sítio; para saldos, confira a tela de contas.");
  }
}

export async function executarConsultaFinanceira(c: ConsultaFinanceira, propriedadeId: number | null): Promise<ResultadoFinanceiro> {
  const observacoes: string[] = [];
  const periodo = c.inicio && c.fim ? { inicio: new Date(`${c.inicio}T00:00:00Z`), fim: new Date(`${c.fim}T23:59:59.999Z`) } : undefined;
  const qs = c.inicio && c.fim ? `?${new URLSearchParams({ inicio: c.inicio, fim: c.fim })}` : "";
  const fontes: FonteConsulta[] = [{ titulo: "Abrir o Financeiro neste período", url: `/financeiro${qs}` }];
  await conferirVolume(c, propriedadeId);

  if (c.assunto === "saldos") {
    const saldos = await resumoSaldos(propriedadeId);
    return { valores: [valor("Saldo disponível nas contas", saldos.saldoGeral)], detalhes: saldos.contas.map(conta => valor(`${conta.nome}${conta.incluirNoSaldoGeral ? "" : " (fora do saldo geral)"}`, conta.saldoAtual)),
      observacoes: ["Saldo atual das contas ativas. O total considera apenas contas incluídas no saldo geral; não é o lucro do período."], fontes: [{ titulo: "Ver contas e saldos", url: "/financeiro/contas" }] };
  }
  if (c.assunto === "pagar" || c.assunto === "receber") {
    const tipo = c.assunto === "pagar" ? "PAGAR" : "RECEBER";
    const itens = (await listarCompromissos(propriedadeId, periodo)).filter(i => i.tipo === tipo && ["PENDENTE", "PARCIAL"].includes(i.status));
    const total = itens.reduce((s, i) => s.plus(i.saldoPendente), new Prisma.Decimal(0));
    return { valores: [valor(c.assunto === "pagar" ? "Falta pagar" : "Falta receber", total)],
      detalhes: itens.slice(0, 10).map(i => valor(`${dataBR(i.dataVencimento.toISOString().slice(0, 10))} · ${i.parceiro?.nome ?? "Sem parceiro"}`, i.saldoPendente)),
      observacoes: ["Saldo ainda pendente hoje, já descontados os pagamentos ou recebimentos válidos. O período filtra o vencimento.", ...(itens.length > 10 ? ["Mostrando os primeiros dez compromissos; o total inclui todos os encontrados."] : [])],
      fontes: [{ titulo: "Ver compromissos", url: `/financeiro/compromissos?situacao=${tipo === "PAGAR" ? "pagar" : "receber"}${qs ? `&${qs.slice(1)}` : "&inicio=&fim="}` }] };
  }
  if (!periodo) throw new ConsultaAssistenteError("Informe um período para consultar.");
  if (c.categoria) {
    const termo = normalizar(c.categoria);
    const categorias = termo === "sem categoria"
      ? [{ id: SEM_VINCULO, nome: "Sem categoria" }]
      : await prisma.categoria.findMany({ select: { id: true, nome: true } });
    const exatas = categorias.filter(i => normalizar(i.nome) === termo);
    const candidatas = exatas.length ? exatas : categorias.filter(i => normalizar(i.nome).includes(termo));
    if (candidatas.length !== 1) throw new ConsultaAssistenteError(candidatas.length
      ? `Encontrei mais de uma categoria: ${candidatas.slice(0, 8).map(i => i.nome).join("; ")}. Digite o nome da categoria desejada junto da pergunta.`
      : `Não encontrei uma categoria com o nome “${c.categoria}”. Pergunte quais são as maiores saídas por categoria para conferir os nomes.`);
    const cat = candidatas[0];
    const analise = await analisarCategorias({ inicio: c.inicio!, fim: c.fim!, base: "pagamentos", categoriaId: cat.id }, propriedadeId);
    return { valores: [{ rotulo: `Saídas de caixa · ${cat.nome}`, valor: analise.total }], detalhes: [],
      observacoes: ["Considera a parcela de cada pagamento atribuída à categoria, inclusive estornos no período. Não representa compras ainda não pagas."],
      fontes: [...fontes, ...analise.linhas.filter(i => i.operacaoId).slice(0, 3).map(i => ({ titulo: i.descricao ?? "Ver operação consultada", url: `/financeiro/operacoes/${i.operacaoId}` }))] };
  }
  const dashboard = await obterDashboard(propriedadeId, periodo.inicio, periodo.fim);
  const valores: Valor[] = [];
  if (["resumo", "entradas"].includes(c.assunto)) valores.push(valor("Entradas de caixa", dashboard.realizado.entradas));
  if (["resumo", "saidas", "categorias"].includes(c.assunto)) valores.push(valor("Saídas de caixa", dashboard.realizado.saidas));
  if (c.assunto === "resumo") valores.push(valor("Resultado de caixa", dashboard.realizado.resultado));
  observacoes.push("Valores registrados no sistema, líquidos dos estornos do período. Transferências entre contas próprias são excluídas; aportes e retiradas estão incluídos.");
  if (c.assunto === "resumo") observacoes.push("O resultado mostra quanto entrou menos quanto saiu. Ele não é lucro apurado: compras a prazo, estoque e investimentos têm efeitos diferentes.");
  if (dashboard.base.vinculosAusentes.length) observacoes.push("Existem registros financeiros sem vínculos completos. Confira o Financeiro antes de tratar este resultado como fechamento.");
  if (!dashboard.base.movimentos.total) observacoes.push("Não há movimentos de caixa registrados neste recorte. Isso não comprova ausência de atividade fora do sistema.");
  const categorias = dashboard.despesasPorCategoria;
  if (categorias.length > 10 && c.assunto !== "entradas") observacoes.push("Mostrando as dez maiores categorias; o total inclui todas.");
  return { valores, detalhes: c.assunto === "entradas" ? [] : categorias.slice(0, 10).map(i => valor(i.categoria, i.valor)), observacoes, fontes };
}

export async function responderConsulta(c: ConsultaFinanceira, propriedadeId: number | null) {
  if (c.assunto === "fora_escopo") return { resposta: "Nesta primeira versão posso consultar entradas, saídas, categorias de gasto, saldo das contas e valores a pagar ou receber. Ainda não consulto produtos, custo por animal, lucro contábil ou alterações nos registros. Qual dessas informações financeiras você quer ver?", fontes: [], contexto: null };
  const atual = await executarConsultaFinanceira(c, propriedadeId);
  const sitio = propriedadeId === null ? "Todos os sítios" : (await prisma.propriedade.findUnique({ where: { id: propriedadeId }, select: { nome: true } }))?.nome;
  if (!sitio) throw new ConsultaAssistenteError("O sítio selecionado não foi encontrado.");
  const periodo = c.inicio && c.fim ? `${dataBR(c.inicio)} a ${dataBR(c.fim)}` : c.assunto === "saldos" ? "Saldo atual" : "Todos os vencimentos";
  const partes = [atual.valores.map(i => `${i.rotulo}: ${moeda(i.valor)}`).join("\n"), `${sitio} · ${periodo}`];
  if (atual.detalhes.length) partes.push(atual.detalhes.map(i => `${i.rotulo}: ${moeda(i.valor)}`).join("\n"));
  if (c.compararInicio && c.compararFim) {
    const anterior = await executarConsultaFinanceira({ ...c, inicio: c.compararInicio, fim: c.compararFim, compararInicio: null, compararFim: null }, propriedadeId);
    partes.push(`Comparação com ${dataBR(c.compararInicio)} a ${dataBR(c.compararFim)}:\n${compararValores(atual.valores, anterior.valores).join("\n")}`);
    atual.observacoes.push(...anterior.observacoes);
    atual.fontes.push(...anterior.fontes.map(f => ({ ...f, titulo: `${f.titulo} (comparação)` })));
  }
  if (c.fim && c.fim >= hojeBrasil()) atual.observacoes.push("O mês atual ainda está em andamento. Compare os períodos considerando essa diferença.");
  partes.push([...new Set(atual.observacoes)].join("\n"));
  return { resposta: partes.join("\n\n"), fontes: atual.fontes, contexto: { propriedadeId, consulta: c } };
}
