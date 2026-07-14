/* Insight mock do painel do Milho (paridade com rebanho/plantio/corte). Estático
 * — a banda só usa `texto` e o rótulo da 1ª ação. Tipo IaInsight mínimo local. */
export interface IaInsight {
  texto: string;
  acoes?: { label: string }[];
}

export function insightDoMilho(): IaInsight {
  return {
    texto:
      "A <b>safrinha</b> está com o custeio adiantado, mas <b>sem produção de grão lançada</b> ainda — assim que a colheita entrar, o custo por saca fecha sozinho. Os silos de silagem seguem com folga pro trato da seca.",
    acoes: [{ label: "Ver custo de produção" }],
  };
}
