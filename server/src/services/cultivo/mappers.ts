// Mappers Prisma→DTO do módulo Cultivo (milho). Espelha plantio/mappers.ts:
// iso() de datas, Number() de Decimal na borda do DTO — nunca number cru em cálculo.

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  return typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
}

// Prisma Decimal | number | null → number | null (DTOs usam null, não undefined).
function num(v: any): number | null {
  return v == null ? null : Number(v);
}

export function toSafraCultivoDTO(s: any) {
  return {
    id: s.id,
    cultura: s.cultura,
    nome: s.nome,
    ano: s.ano,
    dataInicio: iso(s.dataInicio)!,
    dataFim: iso(s.dataFim),
    areaHaTotal: num(s.areaHaTotal),
    fechada: !!s.fechada,
    observacao: s.observacao ?? null,
    resumo: s.resumo !== undefined ? toResumoSafraCultivoDTO(s.resumo) : undefined,
  };
}

export function toAreaCultivoDTO(a: any) {
  return {
    id: a.id,
    safraCultivoId: a.safraCultivoId,
    codigo: a.codigo,
    nome: a.nome ?? null,
    areaHa: num(a.areaHa)!,
  };
}

export function toLancamentoCustoDTO(l: any) {
  return {
    id: l.id,
    safraCultivoId: l.safraCultivoId,
    areaCultivoId: l.areaCultivoId ?? null,
    areaCodigo: l.area?.codigo ?? null,
    tipo: l.tipo,
    classe: l.classe,
    data: iso(l.data)!,
    descricao: l.descricao,
    valor: num(l.valor)!,
    qtd: num(l.qtd),
    unidade: l.unidade ?? null,
    horasMaquina: num(l.horasMaquina),
    numMaquinas: l.numMaquinas ?? null,
    numCaminhoes: l.numCaminhoes ?? null,
    operacaoFinanceiraId: l.operacaoFinanceiraId ?? null,
    observacao: l.observacao ?? null,
  };
}

export function toProducaoCultivoDTO(p: any) {
  return {
    id: p.id,
    safraCultivoId: p.safraCultivoId,
    areaCultivoId: p.areaCultivoId ?? null,
    areaCodigo: p.area?.codigo ?? null,
    data: iso(p.data)!,
    tipo: p.tipo,
    quantidade: num(p.quantidade)!,
    unidade: p.unidade,
    destino: p.destino ?? null,
    siloId: p.siloId ?? null,
    siloNome: p.silo?.nome ?? null,
    observacao: p.observacao ?? null,
  };
}

export function toSiloDTO(s: any) {
  return {
    id: s.id,
    nome: s.nome,
    tipo: s.tipo,
    capacidade: num(s.capacidade),
    unidade: s.unidade,
    saldoAtual: num(s.saldoAtual)!,
    ativo: !!s.ativo,
  };
}

export function toMovimentoSiloDTO(m: any) {
  return {
    id: m.id,
    siloId: m.siloId,
    data: iso(m.data)!,
    tipo: m.tipo,
    quantidade: num(m.quantidade)!,
    origem: m.origem,
    producaoCultivoId: m.producaoCultivoId ?? null,
    observacao: m.observacao ?? null,
  };
}

// Read-model ResumoSafraCultivo. `nota` não é persistida no banco (deriva de
// producaoGraoSc/producaoSilagemTon + custoSaca/custoTonelada nulos) —
// recomputada aqui pra manter a UI consistente com calcularResumoSafra sem
// duplicar no schema. O gatilho é o mesmo em ambos os ramos de
// calcularResumoSafra que zeram os dois custos por unidade numa safra mista
// (nível-safra sem áreas, ou com áreas mas saída mista/custeio compartilhado)
// — por isso a mensagem aqui é genérica, sem assumir qual dos dois ocorreu.
export function toResumoSafraCultivoDTO(r: any) {
  if (!r) return null;
  const temGrao = Number(r.producaoGraoSc) > 0;
  const temSilagem = Number(r.producaoSilagemTon) > 0;
  const notaSafraMista = r.custoSaca == null && r.custoTonelada == null && temGrao && temSilagem;
  return {
    safraCultivoId: r.safraCultivoId,
    custeioTotal: num(r.custeioTotal)!,
    investimentoTotal: num(r.investimentoTotal)!,
    areaHa: num(r.areaHa)!,
    producaoGraoSc: num(r.producaoGraoSc)!,
    producaoSilagemTon: num(r.producaoSilagemTon)!,
    custoHa: num(r.custoHa),
    custoSaca: num(r.custoSaca),
    custoTonelada: num(r.custoTonelada),
    horasMaquinaTotal: num(r.horasMaquinaTotal)!,
    nota: notaSafraMista
      ? "Safra mista (grão + silagem) — custo por unidade requer áreas com saída única e sem custeio compartilhado."
      : null,
    atualizadoEm: r.atualizadoEm ? new Date(r.atualizadoEm).toISOString() : null,
  };
}
