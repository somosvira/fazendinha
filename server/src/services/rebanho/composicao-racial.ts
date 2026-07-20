import { prisma } from "../../db.js";
import { agruparPorGrau, type ComposicaoRacial } from "./composicao-racial.calc.js";

// Composição do rebanho por grau de cruzamento (grau de sangue). Lê os animais ATIVOS no
// escopo e agrupa pela fração de sangue. Espelha GRAUCRUZAMENTO do IDEagri.
export async function obterComposicaoRacial(propriedadeId: number | null): Promise<ComposicaoRacial> {
  const escopoAnimal = propriedadeId == null ? {} : { propriedadeId };
  const animais = await prisma.animal.findMany({
    where: { status: "ATIVO", ...escopoAnimal },
    select: { grauSangue: true },
  });
  return agruparPorGrau(animais);
}
