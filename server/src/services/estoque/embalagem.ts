import { Prisma, type UnidadeMedida } from "@prisma/client";
import { FinanceiroError } from "../financeiro/regras.js";

/** Só aceita apresentações simples e completas. Concentração e volume de diluente não são conteúdo. */
export function interpretarEmbalagem(apresentacao: string | null) {
  const simples = /^(Frasco(?:-ampola)?|Ampola|Bisnaga|Sachê|Sache|Balde|Pote|Saco|Galão|Galao)\s+(\d+(?:[.,]\d+)?)\s*(ml|l|litros?|g|kg|doses?)$/i.exec(apresentacao?.trim() ?? "");
  if (!simples) return null;
  const valor = new Prisma.Decimal(simples[2].replace(",", "."));
  if (!valor.gt(0)) return null;
  const texto = simples[3].toLowerCase();
  const unidade: UnidadeMedida = texto === "ml" || texto === "l" || texto.startsWith("litro") ? "ML" : texto === "g" || texto === "kg" ? "G" : "DOSE";
  const fator = texto === "l" || texto.startsWith("litro") || texto === "kg" ? 1000 : 1;
  const conteudo = valor.mul(fator);
  if (conteudo.decimalPlaces() > 3 || conteudo.gt("999999999.999")) return null;
  return { unidade, conteudo, rotulo: simples[1] };
}

export function quantidadeDaEmbalagem(quantidade: Prisma.Decimal, conteudo: Prisma.Decimal.Value) {
  if (!quantidade.isInteger()) throw new FinanceiroError("VALIDACAO", "Informe uma quantidade inteira de embalagens");
  const total = quantidade.mul(conteudo);
  if (!total.gt(0) || total.decimalPlaces() > 3 || total.gt("999999999.999"))
    throw new FinanceiroError("VALIDACAO", "Conteúdo das embalagens excede a precisão do estoque");
  return total;
}
