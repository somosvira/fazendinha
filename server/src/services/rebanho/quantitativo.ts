import { prisma } from "../../db.js";
import { agruparQuantitativo, type Quantitativo } from "./quantitativo.calc.js";

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
const hojeUTC = () => new Date().toISOString().slice(0, 10);

// Rebanho quantitativo: efetivo ativo por categoria × faixa etária. Deriva de Animal.
export async function obterQuantitativo(propriedadeId: number | null): Promise<Quantitativo> {
  const escopoAnimal = propriedadeId == null ? {} : { propriedadeId };
  const animais = await prisma.animal.findMany({
    where: { status: "ATIVO", ...escopoAnimal },
    select: { categoria: true, dataNascimento: true },
  });
  return agruparQuantitativo(animais.map((a) => ({ categoria: a.categoria, dataNascimento: iso(a.dataNascimento) })), hojeUTC());
}
