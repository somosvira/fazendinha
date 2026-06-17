import type { AnimalDTO, ResumoDTO } from "./types.js";

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

export function toResumoDTO(r: any | null | undefined): ResumoDTO | null {
  if (!r) return null;
  return {
    statusReprodutivo: r.statusReprodutivo,
    del: r.del ?? null,
    ordemLactacao: r.ordemLactacao ?? null,
    producaoMediaDia: r.producaoMediaDia != null ? Number(r.producaoMediaDia) : null,
    producao305: r.producao305 ?? null,
    ccs: r.ccs ?? null,
    ccsTendencia: r.ccsTendencia ?? null,
    ultimoDgData: iso(r.ultimoDgData),
    ultimoDgResultado: r.ultimoDgResultado ?? null,
    iepProjetado: r.iepProjetado ?? null,
    diasGestacao: r.diasGestacao ?? null,
    previsaoSecagem: iso(r.previsaoSecagem),
  };
}

export function toAnimalDTO(a: any): AnimalDTO {
  return {
    id: String(a.id),
    numero: a.numero,
    nome: a.nome ?? "",
    sexo: a.sexo,
    categoria: a.categoria,
    raca: a.raca?.nome ?? null,
    grauSangue: a.grauSangue ?? null,
    dataNascimento: iso(a.dataNascimento),
    dataEntrada: iso(a.dataEntrada)!,
    brincoEletronico: a.brincoEletronico ?? null,
    sisbov: a.sisbov ?? null,
    maeId: a.maeId != null ? String(a.maeId) : null,
    maeNome: a.mae?.nome ?? null,
    maeNumero: a.mae?.numero ?? null,
    paiNome: a.paiNome ?? null,
    grupoId: a.grupoId ?? null,
    grupoNome: a.grupo?.nome ?? null,
    dietaNome: a.grupo?.dieta?.nome ?? null,
    setor: a.setor ?? null,
    ativo: a.status === "ATIVO",
    dataBaixa: iso(a.dataBaixa),
    motivoBaixa: a.motivoBaixa ?? null,
    resumo: toResumoDTO(a.resumo),
  };
}
