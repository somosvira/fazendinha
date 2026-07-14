/* Insight mock do painel do Milho (paridade com rebanho/plantio/corte). Estático
 * — a banda só usa `texto` e o rótulo da 1ª ação. Tipo IaInsight mínimo local. */
export interface IaInsight {
  texto: string;
  acoes?: { label: string }[];
}

// Banda de insight de IA ocultada até haver IA real — o texto era fabricado (mock).
// Reversível: restaurar o objeto retornado religa a banda.
export function insightDoMilho(): IaInsight | undefined {
  return undefined;
}
