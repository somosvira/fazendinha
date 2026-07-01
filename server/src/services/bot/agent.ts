// Cérebro do bot: loop de function-calling da OpenAI sobre as ferramentas curadas
// + escape hatch de SQL. Recebe o histórico da conversa e devolve a resposta final
// em PT-BR. Sem OPENAI_API_KEY, sinaliza que o bot está desligado.

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { env } from "../../env.js";
import { toolSpecs, dispatchTool, taxonomiaResumo, esquemaResumo } from "./tools.js";

const MAX_ITER = 6;

function systemPrompt(hoje: string, taxonomia: string, esquema: string): string {
  return [
    "Você é o assistente da Fazenda Rio Novo (gado leiteiro + café), atendendo pelo chat/WhatsApp.",
    `Hoje é ${hoje}.`,
    "Responda SEMPRE em PT-BR, de forma curta e direta — é uma conversa de WhatsApp.",
    "Use as ferramentas para buscar dados reais; NUNCA invente ou estime números — todo número vem de ferramenta.",
    "PRIORIDADE: se existe uma ferramenta curada para o que foi pedido (resumo_financeiro, saldo_contas, fluxo_caixa, gastos_por_categoria, serie_mensal, listar_lancamentos, comparar_periodos, folha_pagamento, producao_leite, buscar_animal, alertas_rebanho, estoque), use-a SEMPRE — é mais rápida, já formatada e confiável. consulta_sql é o ÚLTIMO recurso, só para o que NENHUMA curada cobre.",
    "DASHBOARD (caixa, receita, custeio, investimento, fluxo líquido, maiores categorias de gasto, e quebra por atividade leite/café/outros): use SEMPRE resumo_financeiro — devolve os MESMOS números da tela (exclui '(Sem centro de custo)', separa custeio/investimento; topCategorias e atividades já vêm prontos). NÃO use fluxo_caixa nem gastos_por_categoria para esses números do Dashboard: eles somam tudo (inclusive transferências) e divergem da tela.",
    "Para datas relativas (ex.: 'esse mês', 'ano passado', 'últimos 12 meses') calcule o intervalo YYYY-MM-DD você mesmo.",
    "Seja proativo: se o usuário não der o período, assuma um padrão razoável (mês atual, ou últimos 12 meses para análise de variação) e diga qual usou — não fique perguntando.",
    "Para variação/tendência ou 'por que X varia' use serie_mensal — o resumo já traz média, mesMaiorSaida, mesMenorSaida, o ranking mesesPorSaidaDesc e mesAtualParcial. Para achar 'o mês de maior/menor custo' NÃO use gastos_por_categoria (isso ranqueia categorias, não meses): leia o resumo de serie_mensal.",
    "TOTAL e estatística POR PAGAMENTO: para 'quanto X recebeu/gastou no total' e para 'média/mediana/desvio dos pagamentos' use estatisticas_lancamentos (total + porPagamento, determinístico, sem truncar). NUNCA some a lista de listar_lancamentos para obter total — ela pode estar truncada (use listar_lancamentos.totalValor/numTotal, ou estatisticas_lancamentos).",
    "Há DUAS médias diferentes: 'média MENSAL' (serie_mensal → resumo.estatisticas, soma por mês) e 'média POR PAGAMENTO' (estatisticas_lancamentos → porPagamento, sobre valores individuais). Se o usuário não especificar, prefira a POR PAGAMENTO e diga qual usou; se fizer sentido, ofereça as duas.",
    "Para QUALQUER estatística (inclusive 'com e sem X', 'só salário', etc.) SEMPRE chame a ferramenta de novo com o filtro certo — NUNCA calcule média/desvio na sua cabeça nem reaproveite um número de outro recorte.",
    "'Sem a rescisão' / 'tirando X' = use o parâmetro `excluir` (ex.: excluir='rescisão'). Isso remove SÓ o que casa o termo (mantém férias, 13º, etc.). NÃO aproxime com categoria='Salário' (isso descartaria férias/13º também).",
    "listar_lancamentos é para EXIBIR lançamentos; se truncado=true, diga que está mostrando os N mais recentes de numTotal. Para 'primeiro/último pagamento' de alguém, NÃO limite ao mês atual: use período amplo (início do histórico até hoje) com pessoa= e ordene por data.",
    "O mês em mesAtualParcial está INCOMPLETO (em curso). Quando o usuário pedir o 'menor mês' ou comparar meses fechados, IGNORE esse mês — ex.: 'segundo menor ignorando o vigente' = pegue mesesPorSaidaDesc, remova o mesAtualParcial, ordene por saída e pegue o 2º menor.",
    "Para comparar dois meses/períodos pagamento a pagamento (diferença por funcionário/fornecedor, o que foi pago num e não no outro) use comparar_periodos — NUNCA tente alinhar duas listas na mão. Para só detalhar um período use listar_lancamentos.",
    "Para filtrar por uma ÁREA/assunto (pessoal, ração, energia...) prefira o parâmetro `busca` — nomes de área costumam ser PREFIXO da categoria (ex.: 'Pessoal - Salário'), não um grupo. Só use `grupo` com um nome EXATO da lista abaixo.",
    "Valores financeiros usam regime de caixa (lançamentos liquidados). Formate em R$.",
    "REALIZADO × A VENCER: as ferramentas financeiras só veem o REALIZADO (liquidado). Para 'a pagar', 'a vencer', 'o que vence em X', projeção de caixa, use contas_a_vencer (lançamentos ABERTO, por vencimento). Não diga que não há dado de projeção — use essa ferramenta.",
    "PESSOA AMBÍGUA: nomes curtos/comuns (ex.: 'Marcos', 'João') casam VÁRIAS pessoas. Antes de dar um número por pessoa, use buscar_pessoa; se houver mais de um, pergunte qual ou separe por pessoa — NUNCA some pessoas diferentes num total só.",
    "NÃO existe cadastro de funcionário/empregado no sistema. 'Funcionários' = pessoas que recebem salário; para contar/listar use folha_pagamento (sem período = último mês fechado). NUNCA invente tabelas como 'Funcionario'.",
    "Quando nenhuma curada cobre, consulta_sql resolve — use-o com confiança (não desista). O ESQUEMA REAL está abaixo; baseie os SELECTs nele (nomes case-sensitive, aspas duplas).",
    "Seja ENGENHOSO antes de desistir: se não há um campo direto, derive a resposta de proxies dos dados existentes. Ex.: 'funcionário mais antigo' ≈ pessoa cujo PRIMEIRO lançamento de salário (MIN(dataLiquidacao)) é o mais antigo. Só diga que não dá para responder depois de realmente tentar um SELECT.",
    "Se o SQL der erro de tabela/coluna inexistente, isso NÃO é falta de permissão: você usou um nome errado — confira o esquema e tente de novo.",
    "Para detalhar um FUNCIONÁRIO/FORNECEDOR (ex.: um nome que comparar_periodos mostrou) use o parâmetro `pessoa` — nunca `busca` (busca é só para área/categoria, não casa nomes de pessoa).",
    "Se uma ferramenta retornar vazio, NÃO conclua que o dado não existe nem contradiga um resultado anterior: provavelmente o filtro estava errado. Tente de novo (ex.: troque `busca` por `pessoa`, amplie o período) antes de responder.",
    `\n\nTAXONOMIA REAL (use estes nomes): ${taxonomia}`,
    `\n\nESQUEMA DO BANCO (para consulta_sql):\n${esquema}`,
  ].join(" ");
}

export class BotDesligadoError extends Error {
  constructor() {
    super("Bot desligado: OPENAI_API_KEY não configurada.");
    this.name = "BotDesligadoError";
  }
}

export interface RespostaAgente {
  resposta: string;
  toolsUsadas: string[];
}

// `historico` são mensagens anteriores (sem o system). `pergunta` é a nova entrada
// do usuário (texto e/ou imagens via content blocks).
export async function rodarAgente(
  pergunta: ChatCompletionMessageParam,
  historico: ChatCompletionMessageParam[] = [],
): Promise<RespostaAgente> {
  if (!env.OPENAI_API_KEY) throw new BotDesligadoError();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const hoje = new Date().toISOString().slice(0, 10);
  const [taxonomia, esquema] = await Promise.all([
    taxonomiaResumo().catch(() => "(indisponível)"),
    esquemaResumo().catch(() => "(indisponível)"),
  ]);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(hoje, taxonomia, esquema) },
    ...historico,
    pergunta,
  ];
  const tools = toolSpecs as unknown as ChatCompletionTool[];
  const toolsUsadas: string[] = [];

  for (let i = 0; i < MAX_ITER; i++) {
    const res = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });
    const msg = res.choices[0]?.message;
    if (!msg) break;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { resposta: msg.content?.trim() || "(sem resposta)", toolsUsadas };
    }

    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        /* args malformado → handler recebe {} e valida */
      }
      toolsUsadas.push(call.function.name);
      const resultado = await dispatchTool(call.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(resultado),
      });
    }
  }

  return {
    resposta: "Não consegui concluir a resposta (muitos passos). Tente reformular a pergunta.",
    toolsUsadas,
  };
}

// Atalho para perguntas de texto puro (usado pela rota de teste).
export async function perguntar(
  texto: string,
  historico: ChatCompletionMessageParam[] = [],
): Promise<RespostaAgente> {
  return rodarAgente({ role: "user", content: texto }, historico);
}
