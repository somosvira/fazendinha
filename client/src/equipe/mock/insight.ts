/* Insight mock do painel da Equipe (paridade com os outros módulos). Estático —
 * a banda só usa `texto` e o rótulo da 1ª ação. Tipo IaInsight mínimo local. */
export interface IaInsight {
  texto: string;
  acoes?: { label: string }[];
}

export function insightDaEquipe(): IaInsight {
  return {
    texto:
      "A folha do mês fechou com <b>horas extras concentradas em poucos setores</b> — vale revisar a escala antes que o extra vire recorrente. A maioria do quadro já está com <b>ponto lançado</b>, mas confira os que ainda estão sem apuração.",
    acoes: [{ label: "Abrir folha do mês" }],
  };
}
