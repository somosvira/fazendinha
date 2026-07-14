// Gera as ferramentas de consulta estruturada (uma por domínio instrumentado)
// a partir do registro declarativo — spec OpenAI com enums explícitos + handler
// que delega ao motor. Domínio novo no registro ⇒ tool nova de graça.

import type { Tool } from "./tools.js";
import { DOMINIOS } from "../consulta/registro/index.js";
import { gerarParametrosTool, descreverDominio } from "../consulta/validacao.js";
import { executarConsulta } from "../consulta/motor.js";

const PREAMBULO =
  "Consulta ESTRUTURADA e validada sobre os dados reais: escolha entidade + métricas, filtre, agrupe (agruparPor), " +
  "faça série temporal (granularidadeTempo) e COMPARE períodos ou fatias (comparar) — o motor executa e calcula TUDO " +
  "(totais, deltas, deltaPct, razões). NUNCA calcule você: transcreva os números retornados. Se vier { erro }, a " +
  "mensagem lista os nomes válidos — corrija e re-tente. ";

export function gerarToolConsulta(nomeDominio: string): Tool {
  const dom = DOMINIOS[nomeDominio];
  if (!dom) throw new Error(`Domínio '${nomeDominio}' não instrumentado.`);
  return {
    spec: {
      type: "function",
      function: {
        name: `consulta_${dom.nome}`,
        description: `${PREAMBULO}${dom.descricao} ${descreverDominio(dom)}`,
        parameters: gerarParametrosTool(dom),
      },
    },
    handler: (args, ctx) => executarConsulta(dom.nome, args, ctx),
  };
}

export const toolsConsulta: Tool[] = Object.keys(DOMINIOS).map(gerarToolConsulta);
