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
/** Chave numérica de animal × sítio × dia: com milhões de animal-dias, montar e comparar textos dominava o tempo. */
function criarChave() {
  const animais = new Map<string, number>(), sitios = new Map<number, number>(), dias = new Map<string, number>();
  const indice = <K>(m: Map<K, number>, k: K) => { let i = m.get(k); if (i === undefined) { i = m.size; m.set(k, i); } return i; };
  return (animalId: string, propriedadeId: number, data: string) => (indice(animais, animalId) * 4096 + indice(sitios, propriedadeId)) * 65536 + indice(dias, data);
}
export function diasIntervalos(intervalos: Intervalo[]) {
  const dias: { data: string; vaca: boolean | null }[] = [];
  for (const s of intervalos) for (let t = +s.desde; t < +s.ate; t += DIA_MS) dias.push({ data: textoDia(new Date(t)), vaca: s.vaca });
  // Datas AAAA-MM-DD: a comparação simples ordena igual e é bem mais rápida que localeCompare.
  return dias.sort((a,b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
}

/** Primeiro atribui os centavos originais ao animal/dia; só depois recorta a consulta. */
export function calcularNutricao(presencas: PresencaDia[], fechamentos: FechamentoAnalise[], inicio: string, fim: string) {
  const diasConsulta = (+new Date(fim)-+new Date(inicio))/DIA_MS+1;
  const chave = criarChave();
  const populacao = new Map<number, PresencaDia>();
  for (const p of presencas) if (p.data >= inicio && p.data <= fim) populacao.set(chave(p.animalId, p.propriedadeId, p.data), { ...p });
  const alimentados = new Set<number>();
  const lacunas: { fechamentoId: string; motivo: string }[] = [];
  const fontes: { fechamentoId: string; participacaoId: string; itemId: string; animalId: string; propriedadeId: number; centroCustoId: string; centroCustoNome: string; finalidade: string | null; unidade: string; quantidade: string; custoConhecido: string | null; custoVacas: string | null; movimentoEstoqueId: string | null; prova: string }[] = [];
  for (const f of fechamentos) {
    const atribuicao = calcularAtribuicao(f.participacoes, f.animalDias, f.itens);
    const porAnimal = new Map(atribuicao.participacoes.map(a => [a.animalId, a]));
    const inicioF = textoDia(f.inicio), fimF = textoDia(f.fim);
    for (const p of f.participacoes) {
      const dias = diasIntervalos(p.intervalos);
      if (dias.length !== p.dias || new Set(dias.map(d => d.data)).size !== p.dias || dias.some(d => d.data < inicioF || d.data > fimF)) {
        lacunas.push({ fechamentoId: f.id, motivo: `Participação ${p.id}: intervalos não conciliam os ${p.dias} dias registrados` });
        continue;
      }
      const noPeriodo = dias.flatMap((d,i) => d.data >= inicio && d.data <= fim ? [i] : []);
      if (!noPeriodo.length) continue;
      for (const i of noPeriodo) {
        const k = chave(p.animalId, f.propriedadeId, dias[i].data);
        if (!populacao.has(k)) lacunas.push({ fechamentoId: f.id, motivo: `Presença registrada de ${p.animalId} diverge da história no dia ${dias[i].data}` });
        else populacao.get(k)!.vaca = dias[i].vaca;
        if (alimentados.has(k)) lacunas.push({ fechamentoId: f.id, motivo: `Alimentação sobreposta em ${dias[i].data} para ${p.animalId}` });
        alimentados.add(k);
      }
      const animal = porAnimal.get(p.animalId)!;
      // Fechamento inteiro dentro do período e mesma condição em todos os dias: o total já rateado é a soma
      // exata das parcelas diárias, sem precisar dividir por dia e somar de volta.
      const inteiro = noPeriodo.length === dias.length, vacas = noPeriodo.filter(i => dias[i].vaca === true).length;
      for (const item of f.itens) {
        const parcela = animal.itens.find(i => i.produtoId === item.produtoId)!;
        let quantidade: string, custoConhecido: string | null, custoVacas: string | null;
        if (inteiro && (vacas === 0 || vacas === dias.length)) {
          quantidade = D(parcela.quantidadeAtribuida).toFixed(3);
          custoConhecido = parcela.custoConhecido == null ? null : D(parcela.custoConhecido).toFixed(2);
          custoVacas = custoConhecido != null && vacas ? custoConhecido : null;
        } else {
          const valores = parcela.custoConhecido == null ? null : repartirValor(parcela.custoConhecido, dias.map(() => 1));
          const quantidades = repartirValor(D(parcela.quantidadeAtribuida).mul(10), dias.map(() => 1)).map(q => q.div(10));
          quantidade = noPeriodo.reduce((s,i) => s.plus(quantidades[i]),D(0)).toFixed(3);
          custoConhecido = valores ? noPeriodo.reduce((s,i) => s.plus(valores[i]),D(0)).toFixed(2) : null;
          custoVacas = valores && vacas ? noPeriodo.filter(i => dias[i].vaca === true).reduce((s,i) => s.plus(valores[i]),D(0)).toFixed(2) : null;
        }
        fontes.push({ fechamentoId: f.id, participacaoId: p.id, itemId: item.id, animalId: p.animalId, propriedadeId: f.propriedadeId,
          centroCustoId: f.centroCustoId, centroCustoNome: f.centroCustoNome, finalidade: p.finalidade, unidade: item.unidade,
          quantidade, custoConhecido, custoVacas,
          movimentoEstoqueId: item.movimentoEstoqueId, prova: "HISTORICO_EXISTENTE_CONCILIADO" });
      }
    }
  }
  const linhas = [...populacao.values()];
  const animalDias = linhas.length;
  const vacaDias = linhas.filter(p => p.vaca === true).length;
  const classificados = linhas.filter(p => p.vaca != null).length;
  const diasAlimentados = linhas.filter(p => alimentados.has(chave(p.animalId, p.propriedadeId, p.data))).length;
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
