interface Resposta { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }

export function responderIA(pergunta: string): Resposta {
  const p = pergunta.toLowerCase();
  if (p.includes("prontos") || p.includes("vender") || p.includes("abate")) {
    return {
      resposta: "Há <b>2 lotes prontos para venda</b>: TER-02 (14 bois, 502 kg) e DES-01 (6 vacas descarte, 458 kg).",
      lista: [
        "TER-02 — 14 cabeças · 17,4 @ · ≈ R$ 81.600 (spot)",
        "DES-01 — 6 vacas · 15,3 @ · vaca gorda · ≈ R$ 27.600",
        "TER-01 (F1 Angus×Nelore) — chega em ~45 dias",
      ],
      rodape: "B3 contango sugere atrasar TER-02 para setembro.",
      modo: "demo",
    };
  }
  if (p.includes("gmd")) {
    return {
      resposta: "GMD médio dos lotes ativos hoje é <b>0,55 kg/dia</b>. RDM-01 (recria) está em 0,38 — abaixo da meta Embrapa (0,45).",
      modo: "demo",
    };
  }
  if (p.includes("vacin")) {
    return {
      resposta: "Próxima ação obrigatória: <b>aftosa etapa 2 em novembro/2026</b>. Antes disso, janela B19 das bezerras fechando em julho.",
      modo: "demo",
    };
  }
  return {
    resposta: "Posso responder sobre <b>pesagem, sanidade, pasto, comercial, custo</b>.",
    modo: "demo",
  };
}
