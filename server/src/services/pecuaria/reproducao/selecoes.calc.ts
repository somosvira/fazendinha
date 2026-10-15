import type { CondicaoSelecao, CriteriosSelecao } from "./selecoes.schemas.js";

export type AnimalSelecao = { animalId: string; [campo: string]: unknown };
const rotulos: Record<CondicaoSelecao["campo"], string> = {
  DEL: "DEL", DIAS_POS_PARTO: "Dias após parto", DIAS_TENTATIVA: "Dias desde tentativa",
  DIAS_CONFIRMACAO: "Dias desde confirmação", IDADE_GESTACIONAL: "Idade gestacional",
  DIAS_ATE_RETORNO: "Dias até retorno agendado", RETORNO_INFORMADO: "Retorno informado", PARTOS: "Partos realizados", TENTATIVAS_CICLO: "Tentativas no ciclo", CATEGORIA: "Categoria",
  LOTE: "Lote", SITUACAO: "Situação reprodutiva", PAPEL_REPRODUTIVO: "Papel reprodutivo",
  SITUACAO_PRODUTIVA: "Situação produtiva", RP: "Retenção de placenta", DESCARTE: "Descarte reprodutivo",
};
function valorCampo(a: AnimalSelecao, campo: CondicaoSelecao["campo"]): unknown {
  const campos = { DEL: "del", DIAS_POS_PARTO: "diasPosParto", DIAS_TENTATIVA: "diasTentativa",
    DIAS_CONFIRMACAO: "diasDesdeConfirmacao", IDADE_GESTACIONAL: "idadeGestacionalDias",
    DIAS_ATE_RETORNO: "diasAteRetorno", PARTOS: "partos", TENTATIVAS_CICLO: "tentativasCiclo", SITUACAO: "situacao",
    PAPEL_REPRODUTIVO: "papelReprodutivo", SITUACAO_PRODUTIVA: "situacaoProdutiva" };
  if (campo === "CATEGORIA" || campo === "LOTE") {
    const valor = a[campo === "CATEGORIA" ? "categoria" : "lote"];
    return valor && typeof valor === "object" && "id" in valor ? valor.id : null;
  }
  if (campo === "PAPEL_REPRODUTIVO" && a.papelReprodutivoEstado === "CONFLITO") return "CONFLITO";
  if (campo === "RETORNO_INFORMADO") return a.retornoInformado == null ? null : a.retornoInformado ? "SIM" : "NAO";
  if (campo === "RP") return a.retencaoPlacenta == null ? null : a.retencaoPlacenta ? "SIM" : "NAO";
  if (campo === "DESCARTE") return Array.isArray(a.restricoes)
    ? a.restricoes.some(r => r && typeof r === "object" && "tipo" in r && r.tipo === "DESCARTE") ? "SIM" : "NAO"
    : null;
  return a[campos[campo]];
}
const desconhecido = (v: unknown) => v == null || v === "NAO_INFORMADA" || v === "DESCONHECIDA";
function testar(a: AnimalSelecao, c: CondicaoSelecao, incluirDesconhecidos: boolean) {
  const v = valorCampo(a, c.campo);
  if (c.tipo === "DESCONHECIDO") return desconhecido(v);
  if (c.tipo === "VALORES" && c.valores.includes(String(v))) return true;
  if (desconhecido(v)) return incluirDesconhecidos;
  if (c.tipo === "VALORES") return c.valores.includes(String(v));
  if (typeof v !== "number" || !Number.isFinite(v)) return incluirDesconhecidos;
  return (c.min == null || (c.incluirMin ? v >= c.min : v > c.min))
    && (c.max == null || (c.incluirMax ? v <= c.max : v < c.max));
}
export function descreverCondicaoSelecao(c: CondicaoSelecao): string {
  if (c.tipo === "DESCONHECIDO") return `${rotulos[c.campo]} não informado`;
  if (c.tipo === "VALORES") return `${rotulos[c.campo]}: ${c.valores.join(" ou ")}`;
  return `${rotulos[c.campo]}: ${c.min == null ? "sem mínimo" : `${c.incluirMin ? "≥" : ">"} ${c.min}`} e ${c.max == null ? "sem máximo" : `${c.incluirMax ? "≤" : "<"} ${c.max}`}`;
}
export function avaliarSelecaoAnimal(a: AnimalSelecao, c: CriteriosSelecao): { incluido: boolean; motivos: string[] } {
  const permitir = c.politicaDesconhecidos === "INCLUIR";
  if (!c.todas.every(cond => testar(a, cond, permitir))) return { incluido: false, motivos: [] };
  const blocos = c.qualquer.filter(b => b.todas.every(cond => testar(a, cond, permitir)));
  if (c.qualquer.length && !blocos.length) return { incluido: false, motivos: [] };
  const condicoes = [...c.todas, ...blocos.flatMap(b => b.todas)];
  const motivos = condicoes.map(cond => {
    const valor = valorCampo(a, cond.campo);
    const pelaPolitica = permitir && cond.tipo !== "DESCONHECIDO" && desconhecido(valor)
      && !(cond.tipo === "VALORES" && cond.valores.includes(String(valor)));
    return `${descreverCondicaoSelecao(cond)}${pelaPolitica ? " (incluído pela política de desconhecidos)" : ""}`;
  });
  return { incluido: true, motivos: [...new Set(motivos.length ? motivos : ["Todos os animais no escopo selecionado"])] };
}
export function ordenarAnimaisSelecao<T extends AnimalSelecao>(animais: T[], criterios: CriteriosSelecao): T[] {
  const comparador = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  return [...animais].sort((a, b) => {
    for (const ordem of criterios.ordenacao) {
      const va = ordem.campo === "BRINCO" ? a.brinco : ordem.campo === "NOME" ? a.nome : valorCampo(a, ordem.campo);
      const vb = ordem.campo === "BRINCO" ? b.brinco : ordem.campo === "NOME" ? b.nome : valorCampo(b, ordem.campo);
      if (desconhecido(va) || desconhecido(vb)) {
        if (desconhecido(va) !== desconhecido(vb)) return desconhecido(va) ? 1 : -1;
        continue;
      }
      const diferenca = typeof va === "number" && typeof vb === "number" ? va - vb : comparador.compare(String(va), String(vb));
      if (diferenca) return ordem.direcao === "ASC" ? diferenca : -diferenca;
    }
    return comparador.compare(a.animalId, b.animalId);
  });
}
