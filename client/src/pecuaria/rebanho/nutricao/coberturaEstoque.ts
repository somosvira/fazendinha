import { listarSaldos, type SaldoDTO } from "../../../estoque/api";
import { hoje } from "../../../financeiro/financeiro-ui";
import { listarDietas, listarPartidasNutricionais, type Dieta, type PartidaNutricional, type ResumoNutricional } from "./api";
import { diasEntre } from "./situacaoFechamento";

/** Abaixo disso, o estoque de um ingrediente merece atenção. */
export const DIAS_ATENCAO = 7;

export type CoberturaIngrediente = {
  produtoId: string; nome: string; unidade: string; propriedadeId: number;
  /** Consumo diário deste lote e de todos os lotes do sítio com dieta que usa o produto. */
  consumoLoteDia: number; consumoSitioDia: number;
  /** Saldo disponível no sítio (descontado o consumo estimado ainda não baixado). */
  saldo: number;
  /** Quantidade que vence antes de ser usada, consumindo primeiro o lote de estoque que vence antes. */
  vencendo: number;
  /** Validade mais próxima entre os lotes de estoque com saldo. */
  proximaValidade: string | null;
  /** Dias que o saldo utilizável cobre o consumo do sítio; null quando não há consumo previsto. */
  dias: number | null;
};
export type CoberturaLote = { dias: number | null; limitante: CoberturaIngrediente | null; ingredientes: CoberturaIngrediente[] };

const disponivel = (s: SaldoDTO) => s.saldoProjetado ?? s.saldo;

/** Quanto dos lotes de estoque vence antes de ser consumido no ritmo diário, gastando primeiro o que vence antes. */
export function perdaPorValidade(partidas: PartidaNutricional[], consumoDia: number, dia = hoje()) {
  const datadas = partidas.filter(p => p.validade && Number(p.saldo) > 0).sort((a, b) => a.validade!.localeCompare(b.validade!));
  let usado = 0, vencendo = 0;
  for (const p of datadas) {
    const validade = p.validade!.slice(0, 10);
    const capacidade = validade < dia ? 0 : Math.max(0, diasEntre(dia, validade) * consumoDia - usado);
    const uso = Math.min(Number(p.saldo), capacidade);
    usado += uso;
    vencendo += Number(p.saldo) - uso;
  }
  return { vencendo, proximaValidade: datadas[0]?.validade?.slice(0, 10) ?? null };
}

/** Cobertura calculada com as dietas vigentes, o efetivo de hoje e o saldo de cada sítio. */
export function calcularCobertura(lotes: ResumoNutricional[], dietas: Dieta[], saldosPorSitio: Map<number, SaldoDTO[]>, partidas: Map<string, PartidaNutricional[]> = new Map(), dia = hoje()): Map<string, CoberturaLote> {
  const porDieta = new Map(dietas.map(d => [d.id, d]));
  const itensDoLote = (r: ResumoNutricional) => (r.vigente ? porDieta.get(r.vigente.dieta.id)?.itens ?? [] : []);
  const demanda = new Map<string, number>();
  for (const r of lotes) for (const i of itensDoLote(r)) {
    const chave = `${r.lote.propriedadeId}:${i.produtoId}`;
    demanda.set(chave, (demanda.get(chave) ?? 0) + Number(i.quantidadeCabecaDia) * r.lote.animaisAtivos);
  }
  const resultado = new Map<string, CoberturaLote>();
  for (const r of lotes) {
    const saldos = saldosPorSitio.get(r.lote.propriedadeId) ?? [];
    const ingredientes = itensDoLote(r).map((i): CoberturaIngrediente => {
      const consumoSitioDia = demanda.get(`${r.lote.propriedadeId}:${i.produtoId}`) ?? 0;
      const saldoProduto = saldos.find(s => s.produtoId === i.produtoId);
      const saldo = saldoProduto ? Math.max(0, disponivel(saldoProduto)) : 0;
      const { vencendo, proximaValidade } = perdaPorValidade(partidas.get(`${r.lote.propriedadeId}:${i.produtoId}`) ?? [], consumoSitioDia, dia);
      const utilizavel = Math.max(0, saldo - vencendo);
      return {
        produtoId: i.produtoId, nome: i.produto?.nome ?? saldoProduto?.nome ?? "Produto", unidade: i.unidade, propriedadeId: r.lote.propriedadeId,
        consumoLoteDia: Number(i.quantidadeCabecaDia) * r.lote.animaisAtivos, consumoSitioDia, saldo, vencendo: Math.min(vencendo, saldo), proximaValidade,
        dias: consumoSitioDia > 0 ? Math.floor(utilizavel / consumoSitioDia) : null,
      };
    });
    const limitante = ingredientes.filter(i => i.dias !== null).sort((a, b) => a.dias! - b.dias!)[0] ?? null;
    resultado.set(r.lote.id, { dias: limitante?.dias ?? null, limitante, ingredientes });
  }
  return resultado;
}

export async function consultarCobertura(lotes: ResumoNutricional[]) {
  const comDieta = lotes.filter(r => r.vigente);
  if (!comDieta.length) return new Map<string, CoberturaLote>();
  const sitios = [...new Set(comDieta.map(r => r.lote.propriedadeId))];
  const [dietas, saldos] = await Promise.all([listarDietas(), Promise.all(sitios.map(id => listarSaldos({ propriedadeId: id })))]);
  const porDieta = new Map(dietas.map(d => [d.id, d]));
  const chaves = [...new Set(comDieta.flatMap(r => (porDieta.get(r.vigente!.dieta.id)?.itens ?? []).map(i => `${r.lote.propriedadeId}:${i.produtoId}`)))];
  // Validade é complemento: produto sem rastreio ou consulta que falha conta o saldo inteiro.
  const partidas = await Promise.all(chaves.map(c => { const [sitio, produtoId] = c.split(":"); return listarPartidasNutricionais(produtoId, Number(sitio)).catch(() => []); }));
  return calcularCobertura(comDieta, dietas, new Map(sitios.map((id, i) => [id, saldos[i]])), new Map(chaves.map((c, i) => [c, partidas[i]])));
}

/** Ingredientes com pouco estoque, um por produto e sítio, com os lotes que dependem dele. */
export function ingredientesEmFalta(cobertura: Map<string, CoberturaLote>, lotes: ResumoNutricional[]) {
  const porProduto = new Map<string, CoberturaIngrediente & { lotes: string[] }>();
  for (const r of lotes) for (const i of cobertura.get(r.lote.id)?.ingredientes ?? []) {
    if ((i.dias === null || i.dias >= DIAS_ATENCAO) && !(i.vencendo > 0)) continue;
    const chave = `${i.propriedadeId}:${i.produtoId}`;
    const atual = porProduto.get(chave) ?? { ...i, lotes: [] };
    atual.lotes.push(r.lote.nome);
    porProduto.set(chave, atual);
  }
  return [...porProduto.values()].sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity) || b.vencendo - a.vencendo);
}

export const textoCobertura = (dias: number | null) => dias === null ? "Sem consumo previsto" : dias === 0 ? "Sem saldo" : `${dias.toLocaleString("pt-BR")} ${dias === 1 ? "dia" : "dias"}`;
export const hrefProdutoEstoque = (produtoId: string) => `/estoque/produtos/${produtoId}`;
