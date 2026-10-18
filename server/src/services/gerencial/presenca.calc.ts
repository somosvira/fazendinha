import { contarPartos, type PartoParaContagem } from "../pecuaria/rebanho/partos.calc.js";

export const DIA_MS = 86400000;
export const textoDia = (data: Date) => data.toISOString().slice(0, 10);
export type AnimalPopulacao = {
  id: string;
  sexo: string;
  dataEntrada: Date;
  partosAntesDaEntrada: number;
  partos: PartoParaContagem[];
  categoriasManuais: { desde: Date; ate: Date | null }[];
};
export type Permanencia = {
  id: string; animalId: string; propriedadeId: number; loteId: string | null;
  desde: Date; ate: Date | null;
};
export type IntervaloPresenca = {
  desde: Date; ate: Date; vaca: boolean | null; localizacaoId: string;
};

/** Projeção em memória dos registros existentes; não cria ou congela fatos. */
export function intervalosPresenca(animal: AnimalPopulacao, locais: Permanencia[], inicio: Date, fim: Date): IntervaloPresenca[] {
  const resultado: IntervaloPresenca[] = [];
  for (let tempo = inicio.getTime(); tempo <= fim.getTime(); tempo += DIA_MS) {
    const data = new Date(tempo);
    const presentes = locais.filter(local => local.animalId === animal.id
      && local.desde <= data && (!local.ate || local.ate > data));
    if (presentes.length !== 1) continue;
    const local = presentes[0];
    const excecaoManual = animal.categoriasManuais.some(c => c.desde <= data && (!c.ate || c.ate > data));
    const vaca = data < animal.dataEntrada || excecaoManual ? null
      : animal.sexo === "F" && contarPartos(animal.partosAntesDaEntrada, animal.partos, data) > 0;
    const ultimo = resultado.at(-1);
    if (ultimo && ultimo.ate.getTime() === tempo && ultimo.vaca === vaca && ultimo.localizacaoId === local.id) {
      ultimo.ate = new Date(tempo + DIA_MS);
    } else resultado.push({ desde: data, ate: new Date(tempo + DIA_MS), vaca, localizacaoId: local.id });
  }
  return resultado;
}
