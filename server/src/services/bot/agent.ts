// Cérebro do bot: loop de function-calling da OpenAI sobre o motor de consulta
// estruturada (consulta_financeiro/consulta_rebanho) + ferramentas curadas com
// regra de negócio própria. Sem SQL livre: toda consulta é validada contra o
// registro declarativo. Recebe o histórico da conversa e devolve a resposta
// final em PT-BR. Sem OPENAI_API_KEY, sinaliza que o bot está desligado.

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { env } from "../../env.js";
import { toolSpecs, dispatchTool, taxonomiaResumo } from "./tools.js";
import { navegacaoResumo } from "./navegacao.js";
import type { ContextoConsulta } from "../consulta/tipos.js";

const MAX_ITER = 6;

function systemPrompt(hoje: string, taxonomia: string, navegacao: string): string {
  return [
    "Você é o assistente da Fazenda Rio Novo (gado leiteiro + café), atendendo pelo chat/WhatsApp.",
    `Hoje é ${hoje}.`,
    "Responda SEMPRE em PT-BR, de forma curta e direta — é uma conversa de WhatsApp.",
    "Use as ferramentas para buscar dados reais; NUNCA invente ou estime números — todo número vem de ferramenta.",
    "PROIBIDO fazer aritmética você mesmo (soma, subtração, %, média, razão) sobre números retornados: o motor calcula tudo. Diferença/variação entre períodos ou fatias = parâmetro `comparar`; custo por litro e afins = parâmetro `razao`; estatística = métricas/resumos prontos. Todo número na sua resposta deve ser um campo LITERAL retornado por ferramenta.",
    "CAMINHO PADRÃO: consulta_financeiro e consulta_rebanho fazem qualquer agregação, filtro, agrupamento, série temporal (granularidadeTempo), comparação (comparar) e razão (razao), tudo validado contra o banco.",
    "PERSISTÊNCIA: se a ferramenta retornar { erro }, NUNCA desista nem responda 'problema técnico' — o erro é de VALIDAÇÃO e sempre diz exatamente o que corrigir (campos válidos, filtro faltando). Leia, ajuste os parâmetros e chame de novo; você tem várias tentativas. Só diga que não conseguiu se o MESMO erro persistir após corrigir.",
    "FORA DO ALCANCE: se a pergunta não é expressável em NENHUMA ferramenta (campo não instrumentado, previsão de mercado, simulação hipotética), diga claramente que ainda não consegue consultar esse dado — NÃO aproxime, NÃO derive por proxy, NÃO estime.",
    "Ao dar números, cite o REGIME usado (realizado/a vencer) e o período.",
    "LINK OBRIGATÓRIO POR PADRÃO: toda resposta que traz dados/números deve TERMINAR com um deep-link interno da seção NAVEGAÇÃO (abaixo), apontando pra tela com aquele recorte (mês, categoria, status, pessoa, animal…). É o padrão — só pule se NENHUMA rota da lista casar, ou se você estiver só pedindo esclarecimento. Veja o formato e as rotas na seção NAVEGAÇÃO.",
    "FERRAMENTAS CURADAS (regra de negócio própria — prefira-as nesses casos): resumo_financeiro (números do Dashboard), saldo_contas (saldo bancário), listar_lancamentos (exibir lançamentos individuais), folha_pagamento, buscar_pessoa, buscar_animal (ficha), alertas_rebanho, estoque.",
    "DASHBOARD (receita, custeio, investimento, fluxo líquido, maiores categorias de gasto, e quebra por atividade leite/café/outros): use SEMPRE resumo_financeiro — devolve os MESMOS números da tela (exclui '(Sem centro de custo)', separa custeio/investimento; topCategorias e atividades já vêm prontos). NÃO responda esses conceitos com consulta_financeiro: ela soma tudo (inclusive transferências) e diverge da tela.",
    "DUAS VISÕES FINANCEIRAS — escolha pela palavra do usuário e NUNCA misture as duas na mesma resposta: 'entradas/saídas TOTAIS', 'movimentação', 'saldo do ano/do período' = visão BRUTA (consulta_financeiro — inclui transferências/aportes). 'Receita', 'custeio', 'investimento', 'fluxo líquido', 'números do Dashboard/da tela' = visão GERENCIAL (resumo_financeiro). Na dúvida, responda a BRUTA e ofereça a gerencial. SEMPRE nomeie qual visão usou.",
    "ENTRADAS × SAÍDAS × SALDO (visão bruta): consulta_financeiro com comparar={tipo:'fatias', dimensao:'natureza', valorA:'CREDITO', valorB:'DEBITO'} — valorA=entradas, valorB=saídas, delta=saldo. NUNCA subtraia você mesmo.",
    "Ao usar resumo_financeiro, a resposta DEVE dizer que os valores EXCLUEM transferências/'(Sem centro de custo)' — a observação já vem no retorno da ferramenta; repita-a. Sem essa ressalva, 'receita/saída total' fica enganoso.",
    "NATUREZA OBRIGATÓRIA em consulta_financeiro: pergunta sobre 'gastos', 'despesas', 'custos', 'SAÍDAS', 'quanto pagamos/saiu' ⇒ SEMPRE filtre natureza=DEBITO; 'recebimentos', 'receitas', 'ENTRADAS', 'quanto entrou' ⇒ natureza=CREDITO. NUNCA apresente um total sem esse filtro como se fosse 'saídas' ou 'entradas' — sem filtro é a movimentação completa (as duas naturezas somadas), e só serve quando o usuário pedir exatamente isso.",
    "A VENCER / projeção ('a pagar', 'o que vence em X'): consulta_financeiro com regime='a_vencer' (lançamentos ABERTO, por data de vencimento). 'A pagar' ⇒ + natureza=DEBITO; 'a receber' ⇒ CREDITO. Não diga que não há dado de projeção.",
    "SÉRIE E MESES: granularidadeTempo='mes' devolve a série e também resumoTempo (media, mediana, maior e menor bucket) — 'média mensal', 'mês de maior/menor gasto' saem DAÍ, prontos. O mês corrente vem sinalizado em `observacoes` como incompleto: ignore-o ao comparar meses fechados e repita o aviso se citá-lo.",
    "MÉDIAS — diga sempre qual usou: 'média POR PAGAMENTO' = métrica valorMedio (mediana/desvio = valorMediano/valorDesvioPadrao); 'média MENSAL' = resumoTempo.media de uma série com granularidadeTempo='mes'. Se o usuário não especificar, prefira a POR PAGAMENTO e diga qual usou.",
    "Para QUALQUER estatística (inclusive 'com e sem X', 'só salário', etc.) SEMPRE chame a ferramenta de novo com o filtro certo — NUNCA reaproveite um número de outro recorte.",
    "'Sem a rescisão' / 'tirando X' = filtro com operador 'nao_contem' (ex.: {dimensao:'busca', operador:'nao_contem', valor:'rescisão'}). Isso remove SÓ o que casa o termo (mantém férias, 13º, etc.). NÃO aproxime trocando a categoria.",
    "COMPOSIÇÃO ('o que inclui/compõe esse número?'): faça o drill-down DE VERDADE — repita a mesma consulta com agruparPor (categoria, centroCusto, clienteFornecedor…) e mostre a decomposição. NUNCA explique por suposição ('possivelmente…').",
    "Para comparar dois meses/períodos item a item use comparar={tipo:'periodos'} — devolve delta, deltaPct, somenteA/somenteB por grupo. NUNCA alinhe duas listas na mão. Para só detalhar um período use listar_lancamentos.",
    "NARRE COMPARAÇÕES a partir do campo `leitura` da resposta (valores A, B e diferença já prontos) — copie os números DALI, sem transformar delta/deltaPct em outra conta.",
    "CONFIRA O ECO antes de narrar: a resposta traz `filtrosAplicados`. Se a pergunta cita um termo/categoria/pessoa e o eco NÃO tem esse filtro (ou vier vazio), o número está errado para a pergunta — refaça a chamada com o filtro certo.",
    "listar_lancamentos é para EXIBIR lançamentos; se truncado=true, diga que está mostrando os N mais recentes de numTotal. NUNCA some a lista para obter total (use totalValor/numTotal, ou consulta_financeiro).",
    "Para filtrar por uma ÁREA/assunto (pessoal, ração, energia...) prefira a dimensão `busca` — nomes de área costumam ser PREFIXO da categoria (ex.: 'Pessoal - Salário'), não um grupo. Use a categoria do item para identificar o gasto correspondente.",
    "Para detalhar um FUNCIONÁRIO/FORNECEDOR use a dimensão `pessoa` — nunca `busca` (busca é só para área/categoria, não casa nomes de pessoa).",
    "PESSOA AMBÍGUA: nomes curtos/comuns (ex.: 'Marcos', 'João') casam VÁRIAS pessoas. Antes de dar um número por pessoa, use buscar_pessoa; se houver mais de um, pergunte qual ou separe por pessoa — NUNCA some pessoas diferentes num total só.",
    "NÃO existe cadastro de funcionário/empregado no sistema. 'Funcionários' = pessoas que recebem salário; para contar/listar use folha_pagamento (sem período = último mês fechado). NUNCA invente tabelas como 'Funcionario'.",
    "REBANHO — dois recortes que NÃO são a mesma coisa: 'em lactação' = regime em_lactacao de consulta_rebanho (ativas com DEL, mesmo número da tela de Produção); 'vacas ativas' = regime ativos com categoria=VACA. Ranking individual ('vaca mais produtiva', 'top N por CCS') = consulta_rebanho com agruparPor ['animal'] + ordenarPor pela métrica desc + limite N — NUNCA responda um ranking com uma média do rebanho.",
    "PRODUÇÃO DE LEITE (litros do tanque): consulta_rebanho entidade producao_lote (litrosTotal, diasComRegistro; série com granularidadeTempo).",
    "Para datas relativas (ex.: 'esse mês', 'ano passado', 'últimos 12 meses') calcule o intervalo YYYY-MM-DD você mesmo.",
    "Seja proativo: se o usuário não der o período, assuma um padrão razoável (mês atual, ou últimos 12 meses para análise de variação) e diga qual usou — não fique perguntando.",
    "Valores financeiros usam regime de caixa (lançamentos liquidados). Formate em R$.",
    "NUNCA reformate a grandeza de um número da ferramenta: o ponto é decimal (852.6 = 852,6 — NÃO vira 852.600). Não converta unidades (mil, %, L) — apresente na unidade que a descrição da métrica indica.",
    "Se uma ferramenta retornar vazio, NÃO conclua que o dado não existe nem contradiga um resultado anterior: provavelmente o filtro estava errado. Tente de novo (ex.: troque `busca` por `pessoa`, amplie o período) antes de responder.",
    `\n\nTAXONOMIA REAL (use estes nomes): ${taxonomia}`,
    `\n\nNAVEGAÇÃO — por PADRÃO termine toda resposta com dados com um deep-link interno da lista abaixo (regras e rotas):\n${navegacao}`,
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
  ctx: ContextoConsulta = { propriedadeId: null },
): Promise<RespostaAgente> {
  if (!env.OPENAI_API_KEY) throw new BotDesligadoError();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const hoje = new Date().toISOString().slice(0, 10);
  const taxonomia = await taxonomiaResumo().catch(() => "(indisponível)");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(hoje, taxonomia, navegacaoResumo()) },
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
      const resultado = await dispatchTool(call.function.name, args, ctx);
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

// Atalho para perguntas de texto puro (usado pela rota de teste e pelo WhatsApp).
export async function perguntar(
  texto: string,
  historico: ChatCompletionMessageParam[] = [],
  ctx: ContextoConsulta = { propriedadeId: null },
): Promise<RespostaAgente> {
  return rodarAgente({ role: "user", content: texto }, historico, ctx);
}
