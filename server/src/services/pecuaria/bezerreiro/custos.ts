import type { Prisma } from '@prisma/client';
import type { FonteCusto } from '../custos/custos.calc.js';

type Permanencia = { animalId: string; desde: Date; ate: Date | null };
type Intervalo = { inicio: number; fim: number };
type Candidato = { fonte: FonteCusto; escopo: Intervalo[]; periodo: Intervalo | null };
const DIA = 86_400_000;
const instante = (data: string) => new Date(`${data}T00:00:00Z`).getTime();
function unir(intervalos: Intervalo[]): Intervalo[] {
  const unidos: Intervalo[] = [];
  for (const intervalo of [...intervalos].sort((a, b) => a.inicio - b.inicio)) {
    const ultimo = unidos.at(-1);
    if (ultimo && intervalo.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, intervalo.fim);
    else unidos.push({ ...intervalo });
  }
  return unidos;
}
const sobrepoe = (a: Intervalo, b: Intervalo) => a.inicio < b.fim && b.inicio < a.fim;
const contem = (escopo: Intervalo[], intervalo: Intervalo) => escopo.some(e => e.inicio <= intervalo.inicio && e.fim >= intervalo.fim);

/** O valor já atribuído ao animal é indivisível sem prova de sua distribuição temporal. */
export async function recortarFontesCustosBezerreiroTx(tx: Prisma.TransactionClient, propriedadeId: number,
  fontes: FonteCusto[], permanencias: Permanencia[], consulta: { de?: string; ate?: string }) {
  const selecionado = (animalId: string) => unir(permanencias.filter(p => p.animalId === animalId).map(p => ({
    inicio: Math.max(p.desde.getTime(), consulta.de ? instante(consulta.de) : -Infinity),
    fim: Math.min(p.ate?.getTime() ?? Infinity, consulta.ate ? instante(consulta.ate) + DIA : Infinity),
  })).filter(p => p.inicio < p.fim));
  const candidatos = fontes.flatMap<Candidato>(fonte => {
    const escopo = selecionado(fonte.animalId);
    if (!escopo.length) return [];
    if (fonte.tipo !== 'NUTRICAO' || !fonte.periodoConsumo) {
      const data = instante(fonte.data);
      return escopo.some(e => e.inicio <= data && e.fim > data) ? [{ fonte, escopo, periodo: null }] : [];
    }
    const periodo = { inicio: instante(fonte.periodoConsumo.inicio), fim: instante(fonte.periodoConsumo.fim) + DIA };
    return escopo.some(e => sobrepoe(e, periodo)) ? [{ fonte, escopo, periodo }] : [];
  });
  const verificar = candidatos.filter(c => c.periodo && !contem(c.escopo, c.periodo));
  const ids = [...new Set(verificar.map(c => c.fonte.id))];
  const participacoes = ids.length ? await tx.participacaoConsumoAnimal.findMany({
    where: { id: { in: ids }, fechamento: { propriedadeId, status: 'CONFIRMADO' } },
    select: { id: true, animalId: true, dias: true, SegmentoConsumoAnimal: { select: { desde: true, ate: true } } },
  }) : [];
  let recortePendente = false;
  const recortadas = candidatos.flatMap<FonteCusto>(({ fonte, escopo, periodo }) => {
    if (!periodo || contem(escopo, periodo)) return [fonte];
    const participacao = participacoes.find(p => p.id === fonte.id && p.animalId === fonte.animalId);
    const segmentos = participacao?.SegmentoConsumoAnimal.map(s => ({ inicio: s.desde.getTime(), fim: s.ate.getTime() })) ?? [];
    const unidos = unir(segmentos);
    const dias = segmentos.reduce((total, s) => total + (s.fim - s.inicio) / DIA, 0);
    const diasUnicos = unidos.reduce((total, s) => total + (s.fim - s.inicio) / DIA, 0);
    const provaValida = segmentos.length > 0 && participacao && Number.isInteger(participacao.dias) && participacao.dias > 0
      && dias === participacao.dias && diasUnicos === dias
      && segmentos.every(s => s.inicio >= periodo.inicio && s.fim <= periodo.fim && s.inicio < s.fim);
    if (provaValida) {
      if (unidos.every(s => contem(escopo, s))) return [fonte];
      if (!unidos.some(s => escopo.some(e => sobrepoe(e, s)))) return [];
    }
    // Não dividir por dias nem atribuir ao último dia do fechamento sem prova.
    recortePendente = true;
    return [{ ...fonte, valorMaterial: null, valorServico: null }];
  });
  return { fontes: recortadas, recortePendente };
}
