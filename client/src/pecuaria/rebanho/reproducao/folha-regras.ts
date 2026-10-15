/** A folha só interpreta dados preservados na emissão; não consulta contexto atual. */
export const LEGENDA_FOLHA = "DEL: dias em lactação; D0 é o dia de início da lactação. Partos: fatos realizados, incluindo aborto e natimorto; não é previsão do próximo parto. RP: retenção de placenta do último parto conhecido (Sim / Não / Não informado), independente de acompanhamento sanitário atual. —: informação não preservada ou desconhecida; zero é um valor conhecido. Motivo de inclusão aparece por escrito em cada linha.";

export function registro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}
export function textoPreservado(valor: unknown): string {
  if (valor == null || valor === "") return "—";
  if (Array.isArray(valor)) return valor.map(textoPreservado).join(", ");
  if (typeof valor === "object") return Object.entries(registro(valor)).map(([k, v]) => `${k}: ${textoPreservado(v)}`).join("; ");
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}
const CAMPOS: Record<string, string> = { DEL: "DEL", DIAS_POS_PARTO: "Dias pós-parto", DIAS_TENTATIVA: "Dias desde tentativa", DIAS_CONFIRMACAO: "Dias desde confirmação", IDADE_GESTACIONAL: "Idade gestacional", DIAS_ATE_RETORNO: "Dias até retorno", PARTOS: "Partos realizados", TENTATIVAS_CICLO: "Tentativas no ciclo", CATEGORIA: "Categoria", LOTE: "Lote", RP: "RP do último parto", SITUACAO: "Situação reprodutiva", PAPEL_REPRODUTIVO: "Papel reprodutivo", SITUACAO_PRODUTIVA: "Situação produtiva", DESCARTE: "Descarte", RETORNO_INFORMADO: "Retorno informado", BRINCO: "Brinco", NOME: "Nome" };
function condicao(valor: unknown): string {
  const c = registro(valor), campo = CAMPOS[String(c.campo)] ?? textoPreservado(c.campo);
  if (c.tipo === "DESCONHECIDO") return `${campo}: desconhecido`;
  if (c.tipo === "VALORES") return `${campo}: ${textoPreservado(c.valores)} (OU entre valores)`;
  if (c.tipo === "FAIXA") return `${campo}: ${c.min == null ? "sem mínimo" : `${c.incluirMin === false ? ">" : "≥"} ${c.min}`} e ${c.max == null ? "sem máximo" : `${c.incluirMax === false ? "<" : "≤"} ${c.max}`}`;
  return textoPreservado(c);
}
export function criteriosFolha(contexto: unknown): string[] {
  const ctx = registro(contexto), c = registro(ctx.selecaoCriterios ?? ctx.criterios);
  if (!Object.keys(c).length) return Object.keys(ctx).length ? [`Contexto preservado: ${textoPreservado(ctx)}`] : ["Critérios, exclusões e ordenação não preservados nesta emissão."];
  const linhas: string[] = [];
  if (Array.isArray(c.todas)) linhas.push("Lógica: condições obrigatórias E (ao menos um bloco alternativo, quando houver). Cada bloco exige todas as suas condições.");
  if (Array.isArray(c.todas)) linhas.push(`Condições obrigatórias (E): ${c.todas.length ? c.todas.map(condicao).join(" E ") : "nenhuma"}`);
  if (Array.isArray(c.qualquer)) linhas.push(`Blocos alternativos (OU; E dentro de cada bloco): ${c.qualquer.length ? c.qualquer.map(b => `(${(Array.isArray(registro(b).todas) ? registro(b).todas as unknown[] : []).map(condicao).join(" E ")})`).join(" OU ") : "nenhum"}`);
  if (c.politicaDesconhecidos != null) linhas.push(`Dados desconhecidos: ${c.politicaDesconhecidos === "INCLUIR" ? "incluir" : "excluir"}`);
  if (Array.isArray(c.ordenacao)) linhas.push(`Ordenação: ${c.ordenacao.map(o => { const ordem = registro(o); return `${CAMPOS[String(ordem.campo)] ?? textoPreservado(ordem.campo)} ${ordem.direcao === "DESC" ? "decrescente" : "crescente"}`; }).join("; ")} · A folha conserva a ordem persistida dos participantes.`);
  linhas.push(`Exclusões: ${ctx.excluidos == null ? "não preservadas" : Array.isArray(ctx.excluidos) && !ctx.excluidos.length ? "nenhuma" : textoPreservado(ctx.excluidos)}`);
  const extras = Object.fromEntries(Object.entries(c).filter(([k]) => !["todas", "qualquer", "politicaDesconhecidos", "ordenacao"].includes(k)));
  if (Object.keys(extras).length) linhas.push(`Definição da seleção: ${textoPreservado(extras)}`);
  if (ctx.grupoPlanner) linhas.push(`Grupo/versão da seleção: ${textoPreservado(ctx.grupoPlanner)}`);
  // Os critérios anteriores ao planner tinham outro formato; conservar todos os campos.
  if (!Array.isArray(c.todas)) linhas.push(`Filtros preservados: ${textoPreservado(c)}`);
  if (ctx.apresentacao) linhas.push(`Apresentação: ${textoPreservado(ctx.apresentacao)}`);
  return linhas;
}
export function rpFolha(snapshot: unknown): string {
  const s = registro(snapshot);
  // null comprovado significa ausência de parto; campo ausente em snapshot antigo é desconhecido.
  if (s.ultimoParto === null) return "Sem parto registrado";
  return s.retencaoPlacenta === true ? "Sim" : s.retencaoPlacenta === false ? "Não" : "Não informado";
}
