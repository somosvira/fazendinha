import type { PrismaClient } from "@prisma/client";

// Delegates realmente usados pelo import de FIV/pool — Pick restrito p/ mock trivial,
// no mesmo espírito de import-genetica.ts.
export type DbFiv = Pick<
  PrismaClient,
  | "embriaoClassificacao"
  | "animal"
  | "reprodutor"
  | "coleta"
  | "oocitoColeta"
  | "fertilizacaoColeta"
  | "embriaoColeta"
  | "grupoPoolDoadora"
  | "itemGrupoPoolDoadora"
  | "eventoReprodutivo"
>;

export interface DadosFivLegado {
  embriaoClassificacoes?: { ideagriId: number; sigla: string; nome: string; ordem: number }[];
  coletas?: { ideagriId: number; doadoraNumero: string; data: string; tecnico: string | null; metodo: string; laboratorio: string | null; status: string }[];
  oocitosColeta?: { coletaIdeagriId: number; qualidade: string; viavel: boolean; quantidade: number }[];
  fertilizacoes?: { ideagriId: number; coletaIdeagriId: number; reprodutorIdeagriId: number; tipoSemenSigla: string | null; data: string | null; tecnica: string | null }[];
  embrioesColeta?: { ideagriId: number; fertilizacaoIdeagriId: number; classificacaoSigla: string; codigoInterno: string | null; estagio: string | null; viavel: boolean }[];
  gruposPool?: { ideagriId: number; nome: string }[];
  itensGrupoPool?: { grupoIdeagriId: number; doadoraNumero: string }[];
}

export interface ResultadoImportFiv {
  classificacoes: number;
  coletas: number;
  oocitos: number;
  fertilizacoes: number;
  embrioes: number;
  grupos: number;
  itens: number;
  embrioesReconciliados: number;
}

const VAZIO: ResultadoImportFiv = { classificacoes: 0, coletas: 0, oocitos: 0, fertilizacoes: 0, embrioes: 0, grupos: 0, itens: 0, embrioesReconciliados: 0 };
const dataUtc = (data: string) => new Date(`${data}T00:00:00Z`);

export async function importarFivLegado(db: DbFiv, dados: DadosFivLegado): Promise<ResultadoImportFiv> {
  const temAlgo = [dados.embriaoClassificacoes, dados.coletas, dados.oocitosColeta, dados.fertilizacoes, dados.embrioesColeta, dados.gruposPool, dados.itensGrupoPool].some((a) => a && a.length);
  if (!temAlgo) return { ...VAZIO };
  const res = { ...VAZIO };

  const classificacaoIdPorSigla = new Map<string, number>();
  for (const c of dados.embriaoClassificacoes ?? []) {
    const row = await db.embriaoClassificacao.upsert({ where: { ideagriId: c.ideagriId }, update: { sigla: c.sigla, nome: c.nome, ordem: c.ordem }, create: { ideagriId: c.ideagriId, sigla: c.sigla, nome: c.nome, ordem: c.ordem } });
    classificacaoIdPorSigla.set(c.sigla, row.id);
    res.classificacoes++;
  }

  async function doadoraIdPorNumero(numero: string): Promise<number> {
    const animal = await db.animal.findFirst({ where: { numero }, select: { id: true } });
    if (!animal) throw new Error(`import FIV: doadora ${numero} não encontrada`);
    return animal.id;
  }
  async function reprodutorIdPorIdeagri(ideagriId: number): Promise<number> {
    const rep = await db.reprodutor.findFirst({ where: { ideagriId }, select: { id: true } });
    if (!rep) throw new Error(`import FIV: reprodutor ${ideagriId} não encontrado`);
    return rep.id;
  }

  const coletaIdPorIdeagri = new Map<number, number>();
  for (const c of dados.coletas ?? []) {
    const doadoraId = await doadoraIdPorNumero(c.doadoraNumero);
    const row = await db.coleta.upsert({
      where: { ideagriId: c.ideagriId },
      update: { doadoraId, data: dataUtc(c.data), tecnico: c.tecnico, metodo: c.metodo, laboratorio: c.laboratorio, status: c.status },
      create: { ideagriId: c.ideagriId, doadoraId, data: dataUtc(c.data), tecnico: c.tecnico, metodo: c.metodo, laboratorio: c.laboratorio, status: c.status },
    });
    coletaIdPorIdeagri.set(c.ideagriId, row.id);
    res.coletas++;
  }

  for (const [ideagriId, coletaId] of coletaIdPorIdeagri) {
    const oocitos = (dados.oocitosColeta ?? []).filter((o) => o.coletaIdeagriId === ideagriId);
    if (!oocitos.length) continue;
    await db.oocitoColeta.deleteMany({ where: { coletaId } });
    await db.oocitoColeta.createMany({ data: oocitos.map((o) => ({ coletaId, qualidade: o.qualidade.trim().toUpperCase(), viavel: o.viavel, quantidade: o.quantidade })) });
    res.oocitos += oocitos.length;
  }

  const fertilizacaoIdPorIdeagri = new Map<number, number>();
  for (const fert of dados.fertilizacoes ?? []) {
    const coletaId = coletaIdPorIdeagri.get(fert.coletaIdeagriId);
    if (coletaId == null) throw new Error(`import FIV: fertilização ${fert.ideagriId} referencia coleta ${fert.coletaIdeagriId} ausente`);
    const reprodutorId = await reprodutorIdPorIdeagri(fert.reprodutorIdeagriId);
    const row = await db.fertilizacaoColeta.upsert({
      where: { ideagriId: fert.ideagriId },
      update: { coletaId, reprodutorId, data: fert.data ? dataUtc(fert.data) : null, tecnica: fert.tecnica },
      create: { ideagriId: fert.ideagriId, coletaId, reprodutorId, data: fert.data ? dataUtc(fert.data) : null, tecnica: fert.tecnica },
    });
    fertilizacaoIdPorIdeagri.set(fert.ideagriId, row.id);
    res.fertilizacoes++;
  }

  // Reconciliação: um evento TE com o mesmo ideagriEmbriaoId ganha o embrião interno.
  const eventosTe = await db.eventoReprodutivo.findMany({ where: { ideagriEmbriaoId: { not: null }, embriaoColetaId: null }, select: { id: true, ideagriEmbriaoId: true } });
  const eventosPorEmbriao = new Map<number, { id: number }[]>();
  for (const ev of eventosTe) {
    if (ev.ideagriEmbriaoId == null) continue;
    const lista = eventosPorEmbriao.get(ev.ideagriEmbriaoId) ?? [];
    lista.push({ id: ev.id });
    eventosPorEmbriao.set(ev.ideagriEmbriaoId, lista);
  }

  for (const emb of dados.embrioesColeta ?? []) {
    const fertilizacaoId = fertilizacaoIdPorIdeagri.get(emb.fertilizacaoIdeagriId);
    if (fertilizacaoId == null) throw new Error(`import FIV: embrião ${emb.ideagriId} referencia fertilização ${emb.fertilizacaoIdeagriId} ausente`);
    const classificacaoId = classificacaoIdPorSigla.get(emb.classificacaoSigla) ?? null;
    if (emb.classificacaoSigla && classificacaoId == null) throw new Error(`import FIV: classificação ${emb.classificacaoSigla} não encontrada`);
    const eventos = eventosPorEmbriao.get(emb.ideagriId) ?? [];
    if (eventos.length > 1) throw new Error(`import FIV: origem ambígua — embrião ${emb.ideagriId} aparece em ${eventos.length} transferências`);
    const transferido = eventos.length === 1;
    const estado = transferido ? "TRANSFERIDO" : emb.viavel ? "DISPONIVEL" : "DESCARTADO";
    const row = await db.embriaoColeta.upsert({
      where: { ideagriId: emb.ideagriId },
      update: { fertilizacaoId, classificacaoId, codigoInterno: emb.codigoInterno, estagio: emb.estagio, viavel: emb.viavel, estado },
      create: { ideagriId: emb.ideagriId, fertilizacaoId, classificacaoId, codigoInterno: emb.codigoInterno, estagio: emb.estagio, viavel: emb.viavel, estado },
    });
    res.embrioes++;
    if (transferido) {
      await db.eventoReprodutivo.update({ where: { id: eventos[0].id }, data: { embriaoColetaId: row.id } });
      res.embrioesReconciliados++;
    }
  }

  const grupoIdPorIdeagri = new Map<number, number>();
  for (const g of dados.gruposPool ?? []) {
    const row = await db.grupoPoolDoadora.upsert({ where: { ideagriId: g.ideagriId }, update: { nome: g.nome }, create: { ideagriId: g.ideagriId, nome: g.nome } });
    grupoIdPorIdeagri.set(g.ideagriId, row.id);
    res.grupos++;
  }
  for (const [ideagriId, grupoId] of grupoIdPorIdeagri) {
    const itens = (dados.itensGrupoPool ?? []).filter((i) => i.grupoIdeagriId === ideagriId);
    if (!itens.length) continue;
    await db.itemGrupoPoolDoadora.deleteMany({ where: { grupoId } });
    const doadoraIds = await Promise.all(itens.map((i) => doadoraIdPorNumero(i.doadoraNumero)));
    await db.itemGrupoPoolDoadora.createMany({ data: doadoraIds.map((doadoraId) => ({ grupoId, doadoraId })) });
    res.itens += itens.length;
  }

  return res;
}
