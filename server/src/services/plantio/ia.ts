/* IA conversacional do Plantio — versão demo (regras keyword-matching).
 * Quando o backend conectar a um LLM, esta função vira o adaptador que
 * monta o contexto da lavoura e chama Claude/OpenAI. */

interface Resposta { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }

export function responderIA(pergunta: string): Resposta {
  const p = pergunta.toLowerCase();
  if (p.includes("ferrugem")) {
    return {
      resposta: "Hoje há <b>4 talhões com ferrugem ≥ 5%</b> — todos de Catuaí. A tendência nos últimos 30 dias é de subida.",
      lista: [
        "Cafundó alto · setor 2 (CAF-02) — 11%, subindo",
        "Cafundó alto · setor 3 (CAF-03) — 13%, subindo",
        "Mata da Capela alto (CAP-01) — 14%, subindo",
        "Mata da Capela meio (CAP-02) — 16%, subindo",
      ],
      rodape: "Os Acauã/Arara/Icatu seguem abaixo de 3% pela resistência genética.",
      modo: "demo",
    };
  }
  if (p.includes("colheita") || p.includes("colher")) {
    return {
      resposta: "Você tem <b>6 talhões prontos pra entrar</b> agora (cereja ≥ 60%) e 3 em derriça ativa.",
      lista: [
        "CAF-01 — 71% cereja · iniciar 02/jun",
        "CAF-02 — 68% cereja · iniciar 04/jun",
        "SEC-01 (Acauã) — 76% cereja · pronto",
        "CAP-01 (Bourbon) — 64% cereja",
      ],
      rodape: "Sugestão: mecanizada no Tijuco primeiro, libera o pano pra Mata da Capela.",
      modo: "demo",
    };
  }
  if (p.includes("custo")) {
    return {
      resposta: "O custo médio acumulado nos últimos 12 meses está em ~<b>R$ 780/saca</b>, abaixo do Cepea (~R$ 1.880/saca).",
      rodape: "Maior peso: mão de obra (33%) e fertilizantes (25%).",
      modo: "demo",
    };
  }
  if (p.includes("adub")) {
    return {
      resposta: "Hoje há <b>5 talhões com análise foliar vencida</b> (>120 dias). 3 mostram K abaixo do ideal no histórico.",
      modo: "demo",
    };
  }
  return {
    resposta: "Posso responder sobre <b>fenologia, fitossanidade, nutrição, colheita e custo da lavoura</b>. Tente uma das sugestões acima.",
    modo: "demo",
  };
}
