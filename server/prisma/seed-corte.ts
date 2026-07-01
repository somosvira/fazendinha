// Seed de DEMONSTRAÇÃO do Corte (gado de corte): 10 piquetes + 12 lotes +
// pesagens derivadas do mock, com ResumoLote COMPUTADO (não hardcoded) pelo
// engine resumos.recompute.ts. Idempotente (upsert por chave natural; pesagens
// via deleteMany + create).
//
// Fonte dos dados: o próprio mock server-side (server/src/services/corte/mock.ts).
//
//   pnpm --filter rionovo-server run seed:corte

import { PrismaClient } from "@prisma/client";
import { lotes, resumos, piquetes } from "../src/services/corte/mock.js";
import { recomputarResumo } from "../src/services/corte/resumos.recompute.js";

const prisma = new PrismaClient();

const MS = 86_400_000;
const HOJE = "2026-05-28"; // âncora do app
const addDias = (iso: string, n: number) => new Date(Date.parse(iso) + n * MS).toISOString().slice(0, 10);
const between = (a: string, b: string, frac: number) =>
  new Date(Date.parse(a) + (Date.parse(b) - Date.parse(a)) * frac).toISOString().slice(0, 10);

// Mapeia o estado OCUPADO/DESCANSO/REFORMA do mock — o schema usa o mesmo enum.
function estadoPiquete(e: string): "DISPONIVEL" | "OCUPADO" | "DESCANSO" | "REFORMA" {
  return (["DISPONIVEL", "OCUPADO", "DESCANSO", "REFORMA"].includes(e) ? e : "DISPONIVEL") as any;
}

async function main() {
  // 1) Piquetes — upsert por codigo (10).
  for (const p of piquetes) {
    const data = {
      nome: p.nome,
      capim: p.capim,
      areaHa: p.areaHa,
      lotacaoMaxUA: p.lotacaoMaxUA,
      cercaTipo: p.cercaTipo ?? null,
      ultimaReforma: p.ultimaReforma ? new Date(p.ultimaReforma) : null,
      estado: estadoPiquete(p.estado),
      diasDescanso: p.diasDescanso ?? null,
      observacao: p.observacao ?? null,
    };
    await prisma.piquete.upsert({ where: { codigo: p.codigo }, update: data, create: { codigo: p.codigo, ...data } });
  }

  // Resolve piqueteId por codigo (para ligar o lote ao piquete).
  const piqueteIdByCodigo: Record<string, number> = {};
  for (const p of await prisma.piquete.findMany({ select: { id: true, codigo: true } })) piqueteIdByCodigo[p.codigo] = p.id;

  // 2) Lotes — upsert por codigo (12). Resolve piqueteId do piqueteAtual (codigo).
  const loteIdByCodigo: Record<string, number> = {};
  for (const l of lotes) {
    const piqueteId = l.piqueteAtual ? piqueteIdByCodigo[l.piqueteAtual] ?? null : null;
    const data = {
      nome: l.nome,
      categoria: l.categoria as any,
      fase: l.fase as any,
      raca: l.raca,
      numCabecas: l.numCabecas,
      numCabecasEntrada: l.numCabecasEntrada,
      dataFormacao: new Date(l.dataFormacao),
      origem: l.origem ?? null,
      piqueteId,
      estado: (l.estado as any) ?? "ATIVO",
      observacao: l.observacao ?? null,
    };
    const row = await prisma.loteCorte.upsert({ where: { codigo: l.codigo }, update: data, create: { codigo: l.codigo, ...data } });
    loteIdByCodigo[l.codigo] = row.id;
  }

  // 3) Pesagens — derivadas do resumo do mock, abrangendo a vida do lote.
  //    entrada (na dataFormacao) → 1-2 intermediárias → atual (≈ resumo.pesoMedio
  //    na resumo.ultimaPesagem). Idempotente: deleteMany + create por lote.
  //    O ResumoLote NÃO é semeado: é computado pelo engine no passo 4.
  let totalPesagens = 0;
  for (const l of lotes) {
    const loteId = loteIdByCodigo[l.codigo];
    const r = resumos.find((x) => x.loteId === l.id);
    await prisma.pesagemLote.deleteMany({ where: { loteId } });
    if (!r || r.pesoMedio == null) continue;

    const pesoAtual = r.pesoMedio;
    // Peso de entrada: usa pesoMedioEntrada quando há; senão estima a partir do
    // GMD acumulado, ou cai num default conservador relativo ao atual.
    const dataFormacao = l.dataFormacao;
    const dataUltima = r.ultimaPesagem ?? HOJE;
    const diasVida = Math.max(1, Math.round((Date.parse(dataUltima) - Date.parse(dataFormacao)) / MS));
    let pesoEntrada: number;
    if (r.pesoMedioEntrada != null) pesoEntrada = r.pesoMedioEntrada;
    else if (r.gmdAcumulado != null) pesoEntrada = Math.max(30, Math.round(pesoAtual - r.gmdAcumulado * diasVida));
    else pesoEntrada = Math.max(30, Math.round(pesoAtual * 0.85));

    const numEntrada = l.numCabecasEntrada;
    const numAtual = l.numCabecas;

    // Pontos: entrada, ~1/3, ~2/3, atual. Filtra colisões de data (mesmo dia).
    const pontos: { data: string; pesoMedio: number; numCabecas: number }[] = [
      { data: dataFormacao, pesoMedio: pesoEntrada, numCabecas: numEntrada },
      { data: between(dataFormacao, dataUltima, 1 / 3), pesoMedio: Math.round(pesoEntrada + (pesoAtual - pesoEntrada) / 3), numCabecas: numEntrada },
      { data: between(dataFormacao, dataUltima, 2 / 3), pesoMedio: Math.round(pesoEntrada + (2 * (pesoAtual - pesoEntrada)) / 3), numCabecas: numAtual },
      { data: dataUltima, pesoMedio: pesoAtual, numCabecas: numAtual },
    ];
    // Dedup por data, preservando ordem.
    const vistos = new Set<string>();
    const finais = pontos.filter((p) => (vistos.has(p.data) ? false : (vistos.add(p.data), true)));

    let anterior: { data: string; pesoMedio: number } | null = null;
    for (const p of finais) {
      let gmd: number | null = null;
      if (anterior) {
        const dias = Math.round((Date.parse(p.data) - Date.parse(anterior.data)) / MS);
        if (dias > 0) gmd = Number(((p.pesoMedio - anterior.pesoMedio) / dias).toFixed(3));
      }
      await prisma.pesagemLote.create({
        data: {
          loteId,
          data: new Date(p.data),
          pesoMedio: p.pesoMedio,
          numCabecas: p.numCabecas,
          pesoTotal: Number((p.pesoMedio * p.numCabecas).toFixed(2)),
          metodo: "BALANCA_LOTE",
          responsavel: "Equipe de campo",
          gmdDesdeUltima: gmd,
        },
      });
      anterior = p;
      totalPesagens++;
    }
  }

  // 3.5) Eventos da Onda 2 — manejo sanitário + suplementação + operação
  //      comercial. Idempotente: deleteMany por lote + create. Valores derivados
  //      do mock (eventos / resumos) onde possível.
  const loteIds = Object.values(loteIdByCodigo);
  await prisma.manejoSanitario.deleteMany({ where: { loteId: { in: loteIds } } });
  await prisma.suplementacao.deleteMany({ where: { loteId: { in: loteIds } } });
  await prisma.operacaoComercial.deleteMany({ where: { loteId: { in: loteIds } } });

  let totalManejos = 0;
  let totalSuplementos = 0;
  let totalOperacoes = 0;

  // Manejo + suplementação para cada lote ATIVO: ~2 manejos (aftosa com próxima
  // dose futura + vermifugação 5-8-11) e 1 suplementação mineral ativa.
  for (const l of lotes) {
    if ((l.estado ?? "ATIVO") !== "ATIVO") continue;
    const loteId = loteIdByCodigo[l.codigo];

    // Aftosa: etapa nov anterior, próxima dose etapa nov/2026 (futura → alimenta
    // proximaVacina no read-model).
    await prisma.manejoSanitario.create({
      data: {
        loteId,
        data: new Date("2025-11-08"),
        tipo: "VACINA_AFTOSA",
        produto: "Aftosa trivalente",
        doseMl: 5,
        numCabecas: l.numCabecasEntrada,
        responsavel: "Wagner",
        carenciaDias: 0,
        proximaDose: new Date("2026-11-08"),
        observacao: "Calendário sanitário — etapa de novembro",
      },
    });
    totalManejos++;

    // Vermifugação 5-8-11 (etapa de maio), próxima etapa em agosto.
    await prisma.manejoSanitario.create({
      data: {
        loteId,
        data: new Date("2026-05-22"),
        tipo: "VERMIFUGACAO_5811",
        produto: "Ivermectina 1%",
        doseMl: 8,
        numCabecas: l.numCabecas,
        responsavel: "Wagner",
        carenciaDias: 21,
        proximaDose: new Date("2026-08-22"),
      },
    });
    totalManejos++;

    // Suplementação mineral ativa (dataFim null).
    await prisma.suplementacao.create({
      data: {
        loteId,
        dataInicio: new Date(addDias(HOJE, -120)),
        dataFim: null,
        tipo: "MINERAL",
        produto: "Mineral 90 (proteinado seca)",
        consumoCabecaDiaG: 120,
        custoKg: 4.8,
        observacao: "Cocho coberto · consumo monitorado",
      },
    });
    totalSuplementos++;
  }

  // Operações comerciais — uma COMPRA histórica (recria machos) e uma VENDA_ABATE
  // de cabeça-cheia que ZERA o lote TER-02 (boi gordo pronto) → estado VENDIDO.
  const compraLoteId = loteIdByCodigo["RDM-01"];
  if (compraLoteId) {
    await prisma.operacaoComercial.create({
      data: {
        loteId: compraLoteId,
        data: new Date("2025-07-08"),
        tipo: "COMPRA",
        numCabecas: 29,
        pesoMedio: 178,
        pesoTotal: Number((178 * 29).toFixed(2)),
        arrobas: Number(((178 * 29 * 0.52) / 15).toFixed(2)),
        precoArroba: 210,
        receitaTotal: Number((((178 * 29 * 0.52) / 15) * 210).toFixed(2)),
        comprador: "Fazenda Boa Vista (origem)",
        observacao: "Entrada do lote de recria 2025",
      },
    });
    totalOperacoes++;
  }

  // Venda ao abate do TER-02 (14 cabeças, 502 kg, @ 339) — derivada do evento
  // e-043 do mock. Cabeça-cheia → flipa o lote para VENDIDO e zera o efetivo.
  const vendaLoteId = loteIdByCodigo["TER-02"];
  if (vendaLoteId) {
    const venda = await prisma.loteCorte.findUnique({ where: { id: vendaLoteId }, select: { numCabecas: true } });
    const cabecas = venda?.numCabecas ?? 14;
    const pesoMedio = 502;
    const arrobas = Number(((pesoMedio * cabecas * 0.52) / 15).toFixed(2));
    await prisma.operacaoComercial.create({
      data: {
        loteId: vendaLoteId,
        data: new Date("2026-06-25"),
        tipo: "VENDA_ABATE",
        numCabecas: cabecas,
        pesoMedio,
        pesoTotal: Number((pesoMedio * cabecas).toFixed(2)),
        arrobas,
        precoArroba: 339,
        receitaTotal: Number((arrobas * 339).toFixed(2)),
        comprador: "Frigorífico Minerva",
        observacao: "Venda direta — lote pronto",
      },
    });
    totalOperacoes++;
    // Cabeça-cheia: zera efetivo e baixa o lote.
    await prisma.loteCorte.update({
      where: { id: vendaLoteId },
      data: { estado: "VENDIDO", numCabecas: 0 },
    });
  }

  // 4) ResumoLote — COMPUTADO pelo engine a partir das pesagens + manejos
  //    semeados (proximaVacina/proximoVermifugo/ultimoManejo agora populam).
  for (const codigo of Object.keys(loteIdByCodigo)) {
    await recomputarResumo(loteIdByCodigo[codigo]);
  }

  console.log(
    `Seed corte ok: ${piquetes.length} piquetes, ${lotes.length} lotes, ${totalPesagens} pesagens, ` +
      `${totalManejos} manejos, ${totalSuplementos} suplementações, ${totalOperacoes} operações, ` +
      `${Object.keys(loteIdByCodigo).length} resumos computados.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
