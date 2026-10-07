import { Prisma } from "@prisma/client";
import { RebanhoError, hojeFazendaDate } from "./rebanho/regras.js";

export async function conferirAnimalNoFato(tx: Prisma.TransactionClient, animalId: string, propriedadeId: number, data: Date, campo = "data") {
  const animal = await tx.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  if (!Number.isFinite(data.getTime()) || data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "Informe uma data válida até hoje", campo);
  if (data < animal.dataNascimento || data < animal.dataEntrada) throw new RebanhoError("VALIDACAO", "O fato não pode anteceder o nascimento ou a entrada", campo);
  const baixa = await tx.baixaAnimal.findFirst({ where: { animalId, estornadaEm: null } });
  if (baixa && data > baixa.data) throw new RebanhoError("VALIDACAO", "O fato não pode ocorrer após a baixa do animal", campo);
  const local = await tx.localizacaoAnimal.findFirst({ where: { animalId, propriedadeId, desde: { lte: data },
    OR: [{ ate: null }, { ate: { gt: data } }, ...(baixa && data.getTime() === baixa.data.getTime() && baixa.localizacaoFechadaId ? [{ id: baixa.localizacaoFechadaId }] : [])] } });
  if (!local) throw new RebanhoError("VALIDACAO", "O animal não estava neste sítio na data informada", campo);
  return animal;
}

export async function conferirFatosNaBaixa(tx: Prisma.TransactionClient, animalId: string, data: Date) {
  const fatos = await Promise.all([
    tx.aplicacaoProduto.count({ where: { animalId, status: "VALIDO", data: { gt: data } } }),
    tx.exameAnimal.count({ where: { animalId, status: "VALIDO", data: { gt: data } } }),
    tx.manejoAnimal.count({ where: { animalId, status: "VALIDO", data: { gt: data } } }),
    tx.ocorrenciaSanitaria.count({ where: { animalId, status: "VALIDO", OR: [{ inicio: { gt: data } }, { fim: { gt: data } }] } }),
  ]);
  if (fatos.some(Boolean)) throw new RebanhoError("CONFLITO", "A baixa antecede fatos sanitários ou de manejo; revise-os antes", "data");
}

/** Confere o histórico proposto antes do commit; lançamentos com sítio desconhecido continuam legíveis. */
export async function conferirHistoricoDosFatos(tx: Prisma.TransactionClient, animalIds: string[]) {
  const where = { animalId: { in: animalIds }, status: "VALIDO" as const };
  const [animais, locais, baixas, aplicacoes, exames, manejos, ocorrencias] = await Promise.all([
    tx.animal.findMany({ where: { id: { in: animalIds } }, select: { id: true, sexo: true, dataNascimento: true, dataEntrada: true } }),
    tx.localizacaoAnimal.findMany({ where: { animalId: { in: animalIds } } }),
    tx.baixaAnimal.findMany({ where: { animalId: { in: animalIds }, estornadaEm: null }, select: { animalId: true, data: true, localizacaoFechadaId: true } }),
    tx.aplicacaoProduto.findMany({ where, select: { animalId: true, propriedadeId: true, data: true, origem: true } }),
    tx.exameAnimal.findMany({ where, select: { animalId: true, propriedadeId: true, data: true, origem: true } }),
    tx.manejoAnimal.findMany({ where, select: { animalId: true, propriedadeId: true, data: true, origem: true, tipo: true } }),
    tx.ocorrenciaSanitaria.findMany({ where, select: { animalId: true, propriedadeId: true, inicio: true, origem: true } }),
  ]);
  const porId = new Map(animais.map((a) => [a.id, a]));
  if (manejos.some((m) => m.tipo === "CASTRACAO" && porId.get(m.animalId)?.sexo !== "M")) throw new RebanhoError("CONFLITO", "Animal com castração válida não pode mudar para fêmea", "sexo");
  const fatos = [...aplicacoes, ...exames, ...manejos, ...ocorrencias.map((o) => ({ ...o, data: o.inicio }))];
  for (const fato of fatos) {
    const animal = porId.get(fato.animalId)!;
    if (fato.data < animal.dataNascimento || (fato.origem !== "IDEAGRI" && fato.data < animal.dataEntrada)) {
      throw new RebanhoError("CONFLITO", "A alteração deixa fatos sanitários ou de manejo anteriores ao nascimento/entrada; revise-os antes");
    }
    const baixa = baixas.find((b) => b.animalId === fato.animalId);
    if (fato.propriedadeId != null && !locais.some((l) => l.animalId === fato.animalId && l.propriedadeId === fato.propriedadeId && l.desde <= fato.data && (!l.ate || l.ate > fato.data || (baixa?.localizacaoFechadaId === l.id && baixa.data.getTime() === fato.data.getTime())))) {
      throw new RebanhoError("CONFLITO", "A alteração muda o sítio de fatos sanitários ou de manejo; revise-os antes");
    }
  }
}
