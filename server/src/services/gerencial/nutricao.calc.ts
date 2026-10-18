import { Prisma } from "@prisma/client";
import { calcularAtribuicao } from "../pecuaria/nutricao/atribuicao.calc.js";
import { repartirValor } from "../estoque/valorizacao.calc.js";
import { DIA_MS, textoDia } from "./presenca.calc.js";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export type PresencaDia = { animalId: string; propriedadeId: number; data: string; vaca: boolean | null };
type Intervalo = { desde: Date; ate: Date; vaca: boolean | null };
export type FechamentoAnalise = { id: string; propriedadeId: number; centroCustoId: string; centroCustoNome: string; inicio: Date; fim: Date; animalDias: number;
  participacoes: { id: string; animalId: string; dias: number; intervalos: Intervalo[]; finalidade: string | null }[];
  itens: { id: string; produtoId: string; unidade: string; quantidadeConfirmada: string; custoConhecido: string | null; movimentoEstoqueId: string | null }[] };
const chave = (p: PresencaDia) => `${p.propriedadeId}:${p.animalId}:${p.data}`;
export function diasIntervalos(intervalos: Intervalo[]) {
  const dias: { data: string; vaca: boolean | null }[] = [];
  for (const s of intervalos) for (let t = +s.desde; t < +s.ate; t += DIA_MS) dias.push({ data: textoDia(new Date(t)), vaca: s.vaca });
  return dias.sort((a,b) => a.data.localeCompare(b.data));
}

/** Primeiro atribui os centavos originais ao animal/dia; só depois recorta a consulta. */
export function calcularNutricao(presencas: PresencaDia[], fechamentos: FechamentoAnalise[], inicio: string, fim: string) {
  const diasConsulta = (+new Date(fim)-+new Date(inicio))/DIA_MS+1;
  const populacao = new Map(presencas.filter(p => p.data >= inicio && p.data <= fim).map(p => [chave(p), { ...p }]));
  const alimentados = new Set<string>();
  const lacunas: { fechamentoId: string; motivo: string }[] = [];
  const fontes: { fechamentoId: string; participacaoId: string; itemId: string; animalId: string; propriedadeId: number; centroCustoId: string; centroCustoNome: string; finalidade: string | null; unidade: string; quantidade: string; custoConhecido: string | null; custoVacas: string | null; movimentoEstoqueId: string | null; prova: string }[] = [];
  for (const f of fechamentos) {
    const atribuicao = calcularAtribuicao(f.participacoes, f.animalDias, f.itens);
    for (const p of f.participacoes) {
      const dias = diasIntervalos(p.intervalos);
      if (dias.length !== p.dias || new Set(dias.map(d => d.data)).size !== p.dias || dias.some(d => d.data < textoDia(f.inicio) || d.data > textoDia(f.fim))) {
        lacunas.push({ fechamentoId: f.id, motivo: `Participação ${p.id}: intervalos não conciliam os ${p.dias} dias registrados` });
        continue;
      }
      const noPeriodo = dias.flatMap((d,i) => d.data >= inicio && d.data <= fim ? [i] : []);
      if (!noPeriodo.length) continue;
      for (const i of noPeriodo) {
        const k = chave({ ...dias[i], animalId: p.animalId, propriedadeId: f.propriedadeId });
        if (!populacao.has(k)) lacunas.push({ fechamentoId: f.id, motivo: `Presença registrada de ${p.animalId} diverge da história no dia ${dias[i].data}` });
        else populacao.get(k)!.vaca = dias[i].vaca;
        if (alimentados.has(k)) lacunas.push({ fechamentoId: f.id, motivo: `Alimentação sobreposta em ${dias[i].data} para ${p.animalId}` });
        alimentados.add(k);
      }
      const animal = atribuicao.participacoes.find(a => a.animalId === p.animalId)!;
      for (const item of f.itens) {
        const parcela = animal.itens.find(i => i.produtoId === item.produtoId)!;
        const valores = parcela.custoConhecido == null ? null : repartirValor(parcela.custoConhecido, dias.map(() => 1));
        const quantidades = repartirValor(D(parcela.quantidadeAtribuida).mul(10), dias.map(() => 1)).map(q => q.div(10));
        fontes.push({ fechamentoId: f.id, participacaoId: p.id, itemId: item.id, animalId: p.animalId, propriedadeId: f.propriedadeId,
          centroCustoId: f.centroCustoId, centroCustoNome: f.centroCustoNome, finalidade: p.finalidade, unidade: item.unidade,
          quantidade: noPeriodo.reduce((s,i) => s.plus(quantidades[i]),D(0)).toFixed(3),
          custoConhecido: valores ? noPeriodo.reduce((s,i) => s.plus(valores[i]),D(0)).toFixed(2) : null,
          custoVacas: valores && noPeriodo.some(i => dias[i].vaca === true) ? noPeriodo.filter(i => dias[i].vaca === true).reduce((s,i) => s.plus(valores[i]),D(0)).toFixed(2) : null,
          movimentoEstoqueId: item.movimentoEstoqueId, prova: "HISTORICO_EXISTENTE_CONCILIADO" });
      }
    }
  }
  const linhas = [...populacao.values()];
  const animalDias = linhas.length;
  const vacaDias = linhas.filter(p => p.vaca === true).length;
  const classificados = linhas.filter(p => p.vaca != null).length;
  const diasAlimentados = linhas.filter(p => alimentados.has(chave(p))).length;
  const custosPendentes = fontes.filter(f => f.custoConhecido == null).length;
  const custo = fontes.reduce((s,f) => s.plus(f.custoConhecido ?? 0),D(0));
  const custoVacas = fontes.reduce((s,f) => s.plus(f.custoVacas ?? 0),D(0));
  const parcial = diasAlimentados !== animalDias || custosPendentes > 0 || lacunas.length > 0 || !animalDias;
  const temConhecido = fontes.some(f => f.custoConhecido != null);
  const medias = (valor: Prisma.Decimal, ad: number, incompleto: boolean, conhecido: boolean) => ({ animalDias: ad, populacaoMedia: D(ad).div(diasConsulta).toFixed(4), custoConhecido: conhecido ? valor.toFixed(2) : null,
    porDia: ad && conhecido ? valor.div(ad).toFixed(4) : null, porPeriodo: ad && conhecido ? valor.mul(diasConsulta).div(ad).toFixed(2) : null, parcial: incompleto });
  const porUnidade = new Map<string,{ unidade: string; quantidadeConhecida: Prisma.Decimal; quantidadePendente: Prisma.Decimal }>();
  for (const f of fontes) { const u=porUnidade.get(f.unidade) ?? { unidade:f.unidade,quantidadeConhecida:D(0),quantidadePendente:D(0) }; const campo=f.custoConhecido==null?"quantidadePendente":"quantidadeConhecida";u[campo]=u[campo].plus(f.quantidade);porUnidade.set(f.unidade,u); }
  return { rebanho: medias(custo,animalDias,parcial,temConhecido), vacas: medias(custoVacas,vacaDias,parcial || classificados !== animalDias,fontes.some(f => f.custoVacas != null)),
    cobertura: { animalDias, diasAlimentados, diasClassificados: classificados, itensComCusto: fontes.length-custosPendentes, itensPendentes: custosPendentes,
      quantidades: [...porUnidade.values()].map(u => ({ unidade:u.unidade,quantidadeConhecida:u.quantidadeConhecida.toFixed(3),quantidadePendente:u.quantidadePendente.toFixed(3) })) },
    fontes, lacunas, metodologia: "Rateio por presença: centavos por animal e depois por dia, em ordem cronológica; não mede ingestão individual. Média no período = custo conhecido ÷ população média. Vacas: fêmeas com paridade comprovada, secas e lactantes." };
}
