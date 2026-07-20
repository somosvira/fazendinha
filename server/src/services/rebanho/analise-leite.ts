import { prisma } from "../../db.js";
import { agregarAnaliseLeite, type AnaliseLeite, type LeituraLeite } from "./analise-leite.calc.js";

const iso = (x: Date) => new Date(x).toISOString().slice(0, 10);

export interface PiorAnimalDTO {
  animalId: number;
  numero: string;
  nome: string | null;
  ccs: number;
  data: string;
  faixa: "EXCELENTE" | "ATENCAO" | "ALARME";
}

// A análise pronta para a tela, com os piores animais já enriquecidos com número/nome.
export interface AnaliseLeiteDTO extends Omit<AnaliseLeite, "pioresAnimais"> {
  pioresAnimais: PiorAnimalDTO[];
}

const LIMITE_PIORES = 10; // a tela mostra os N piores CCS (mais que isso vira tabela longa)

// Análise de leite do rebanho (qualidade): tendência de CCS, distribuição por faixa e piores
// animais. Fonte = eventos EXAME com CCS/gordura/proteína. Escopo por propriedade via o animal.
export async function obterAnaliseLeite(propriedadeId: number | null): Promise<AnaliseLeiteDTO> {
  const rows = await prisma.eventoSanitario.findMany({
    where: {
      tipo: "EXAME",
      OR: [{ ccs: { not: null } }, { gordura: { not: null } }, { proteina: { not: null } }],
      ...(propriedadeId != null ? { animal: { propriedadeId } } : {}),
    },
    select: {
      animalId: true, data: true, ccs: true, gordura: true, proteina: true,
      animal: { select: { numero: true, nome: true } },
    },
    orderBy: { data: "asc" },
  });

  const nomes = new Map<number, { numero: string; nome: string | null }>();
  const leituras: LeituraLeite[] = rows.map((r) => {
    nomes.set(r.animalId, { numero: r.animal.numero, nome: r.animal.nome });
    return {
      animalId: r.animalId,
      data: iso(r.data),
      ccs: r.ccs,
      gordura: r.gordura == null ? null : Number(r.gordura),
      proteina: r.proteina == null ? null : Number(r.proteina),
    };
  });

  const analise = agregarAnaliseLeite(leituras);
  const pioresAnimais: PiorAnimalDTO[] = analise.pioresAnimais.slice(0, LIMITE_PIORES).map((p) => ({
    animalId: p.animalId,
    numero: nomes.get(p.animalId)?.numero ?? String(p.animalId),
    nome: nomes.get(p.animalId)?.nome ?? null,
    ccs: p.ccs,
    data: p.data,
    faixa: p.faixa,
  }));

  return { ...analise, pioresAnimais };
}
