import type { GrupoCriteriosAptidao } from "./elegibilidade.schemas.js";
export type ClasseReprodutivaAptidao = "VACA" | "NOVILHA" | "NAO_DETERMINADA";
export type EvidenciaPesoAptidao = { id: string; data: Date; pesoKg: number; precisao: string };
export type EvidenciaEccAptidao = { id: string; data: Date; valor: number; escalaMin: number; escalaMax: number };
export type NecessidadeAptidao = {
  politicaId?: string | null; politicaVersao?: number | null;
  necessidadeId: string; estado: "MANUAL" | "AVALIACAO_DEVIDA" | "PENDENCIA_DADOS" | "CRITERIOS_NAO_ATINGIDOS";
  devidaDesde: string | null; pendencias: string[]; criteriosNaoAtingidos: string[]; evidenciaIds: string[];
};
/** Disparo de avaliação. Não cria agenda, exame, decisão nem liberação. */
export function avaliarCriteriosAptidao(input: {
  animalId: string; chaveCiclo: string; referencia: Date; dataNascimento: Date | null;
  classeReprodutiva: ClasseReprodutivaAptidao; parto: Date | null; vacas: GrupoCriteriosAptidao; novilhas: GrupoCriteriosAptidao;
  diasAvaliacaoPosParto: number | null; pesagens: readonly EvidenciaPesoAptidao[]; escores: readonly EvidenciaEccAptidao[];
}): NecessidadeAptidao {
  const necessidadeId = `APTIDAO:${input.animalId}:${input.chaveCiclo}`;
  if (input.classeReprodutiva === "NAO_DETERMINADA") {
    const selecionados = [input.vacas, input.novilhas].some(g => [g.idadeMinimaMeses, g.percentualPesoAdulto, g.pesoMinimoKg, g.eccMinimo].some(v => v !== null)) || input.diasAvaliacaoPosParto !== null;
    return { necessidadeId, estado: selecionados ? "PENDENCIA_DADOS" : "MANUAL", devidaDesde: null,
      pendencias: selecionados ? ["CLASSE_REPRODUTIVA_NAO_COMPROVADA"] : [], criteriosNaoAtingidos: [], evidenciaIds: [] };
  }
  const g = input.classeReprodutiva === "VACA" ? input.vacas : input.novilhas;
  const pendencias: string[] = [], criteriosNaoAtingidos: string[] = [], evidenciaIds: string[] = [];
  let disparadores = 0;
  let devidaDesde: Date | null = null;
  const devida = (d: Date) => { if (!devidaDesde || d > devidaDesde) devidaDesde = d; };
  const vigente = (data: Date, validade: number | null) => data <= input.referencia && validade !== null && input.referencia.getTime() - data.getTime() <= validade * 86400000;
  if (input.classeReprodutiva === "VACA" && input.diasAvaliacaoPosParto !== null) {
    disparadores++;
    if (!input.parto) pendencias.push("DATA_PARTO_NAO_COMPROVADA");
    else {
      const d = new Date(input.parto.getTime() + input.diasAvaliacaoPosParto * 86400000);
      devida(d);
      if (d > input.referencia) criteriosNaoAtingidos.push("DIAS_POS_PARTO");
    }
  }
  if (g.idadeMinimaMeses !== null) {
    disparadores++;
    if (!input.dataNascimento || input.dataNascimento > input.referencia) pendencias.push("NASCIMENTO_NAO_COMPROVADO");
    else {
      // Somar meses com o último dia válido conserva aniversários em meses curtos.
      const d = new Date(input.dataNascimento);
      const dia = d.getUTCDate();
      d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + g.idadeMinimaMeses);
      d.setUTCDate(Math.min(dia, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
      devida(d);
      if (d > input.referencia) criteriosNaoAtingidos.push("IDADE_MINIMA");
    }
  }
  if (g.pesoMinimoKg !== null || g.percentualPesoAdulto !== null) {
    disparadores++;
    const peso = [...input.pesagens].filter(p => vigente(p.data, g.validadePesoDias) && g.precisaoPesoAceita.some(v => v === p.precisao))
      .sort((a, b) => b.data.getTime() - a.data.getTime() || b.id.localeCompare(a.id))[0];
    if (!peso) pendencias.push("PESO_AUSENTE_OU_VENCIDO");
    else {
      evidenciaIds.push(peso.id); devida(peso.data);
      if (g.pesoMinimoKg !== null && peso.pesoKg < g.pesoMinimoKg) criteriosNaoAtingidos.push("PESO_MINIMO");
      if (g.percentualPesoAdulto !== null && (!g.pesoAdultoReferenciaKg || peso.pesoKg < g.pesoAdultoReferenciaKg * g.percentualPesoAdulto / 100)) criteriosNaoAtingidos.push("PERCENTUAL_PESO_ADULTO");
    }
  }
  if (g.eccMinimo !== null) {
    disparadores++;
    const ecc = [...input.escores].filter(e => vigente(e.data, g.validadeEccDias) && g.escalaEcc && e.escalaMin === g.escalaEcc.minimo && e.escalaMax === g.escalaEcc.maximo)
      .sort((a, b) => b.data.getTime() - a.data.getTime() || b.id.localeCompare(a.id))[0];
    if (!ecc) pendencias.push("ECC_AUSENTE_VENCIDO_OU_ESCALA_INCOMPATIVEL");
    else { evidenciaIds.push(ecc.id); devida(ecc.data); if (ecc.valor < g.eccMinimo) criteriosNaoAtingidos.push("ECC_MINIMO"); }
  }
  const estado = !disparadores ? "MANUAL" : pendencias.length ? "PENDENCIA_DADOS" : criteriosNaoAtingidos.length ? "CRITERIOS_NAO_ATINGIDOS" : "AVALIACAO_DEVIDA";
  return { necessidadeId, estado, devidaDesde: devidaDesde ? (devidaDesde as Date).toISOString().slice(0, 10) : null, pendencias, criteriosNaoAtingidos, evidenciaIds };
}
