// Massa grande para testes de desempenho: um sítio próprio ("Sítio volume") com dois anos de
// história gerada pelos serviços normais (estoque, custo e cronologia respeitados).
// Uso: DATABASE_URL=<banco de volume> npx tsx --env-file=.env scripts/gerar-volume.mts
// Recusa o banco do seed e qualquer destino que não seja loopback.
import { prisma } from "../src/db.ts";
import { criarPropriedade } from "../src/services/propriedade.ts";
import { criarConta } from "../src/services/financeiro/contas.ts";
import { contaSchema, operacaoSchema } from "../src/services/financeiro/schemas.ts";
import { criarOperacao } from "../src/services/financeiro/operacoes.ts";
import { criarProduto } from "../src/services/estoque/produtos.ts";
import { produtoSchema } from "../src/services/estoque/produtos.schemas.ts";
import { criarLote } from "../src/services/pecuaria/rebanho/lotes.ts";
import { cadastrar } from "../src/services/pecuaria/rebanho/animais.ts";
import { cadastrarAnimalSchema } from "../src/services/pecuaria/rebanho/schemas.ts";
import { criarDieta, publicarDieta, atribuirDieta } from "../src/services/pecuaria/nutricao/dietas.ts";
import { confirmarConsumo } from "../src/services/pecuaria/nutricao/consumo.ts";
import { criarAplicacao } from "../src/services/pecuaria/sanidade/aplicacoes.ts";

const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("/fazendinha_volume")) throw new Error("Só gera volume no banco local fazendinha_volume");

const ANIMAIS = Number(process.env.VOLUME_ANIMAIS ?? 3000), LOTES = Number(process.env.VOLUME_LOTES ?? 30), MESES = Number(process.env.VOLUME_MESES ?? 24);
const APLICACOES_MES = Number(process.env.VOLUME_APLICACOES_MES ?? 125);
const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
const d = (dias: number) => { const x = new Date(hoje); x.setUTCDate(x.getUTCDate() + dias); return x.toISOString().slice(0, 10); };
const primeiro = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - MESES, 1));
const inicio0 = Math.round((primeiro.getTime() - hoje.getTime()) / 864e5);
const relativo = (data: Date) => Math.round((data.getTime() - hoje.getTime()) / 864e5);
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const uid = (await prisma.usuario.findFirstOrThrow({ where: { email: "rafael@test.com" } })).id;
const centro = await prisma.centroCusto.findFirstOrThrow({ where: { nome: "Produção leiteira" } });
const fornecedor = await prisma.parceiro.findFirstOrThrow({ where: { nome: "Cooperativa demonstrativa" } });
const catRacao = await prisma.categoria.findFirstOrThrow({ where: { nome: "Ração" } });
const catMed = await prisma.categoria.findFirstOrThrow({ where: { nome: "Medicamentos veterinários" } });
const raca = await prisma.raca.findFirstOrThrow({ where: { sigla: "HO" } }).catch(() => prisma.raca.findFirstOrThrow());
const tipoTratamento = await prisma.tipoAplicacaoSanitaria.findFirstOrThrow({ where: { nome: "Tratamento" } });

let sitio = await prisma.propriedade.findFirst({ where: { nome: "Sítio volume" } });
if (sitio) throw new Error("O Sítio volume já existe neste banco; recrie o banco de volume para gerar de novo.");
sitio = await criarPropriedade({ nome: "Sítio volume", principal: false, cidade: "Cidade demonstrativa", uf: "MG", ordem: 3 }) as never;
const propriedadeId = sitio!.id;
log("sítio", propriedadeId);

const conta = await criarConta({ ...contaSchema.parse({ nome: "Banco Volume", tipo: "BANCO", instituicao: "Banco do Brasil", saldoAbertura: 50_000_000, dataSaldoAbertura: d(inicio0 - 2), agencia: "0001", numeroConta: "90001", digito: "0", titular: "Sítio volume — fictício", tipoBancario: "CORRENTE" }), propriedadeId, usuarioId: uid });

const produto = (nome: string, categoriaId: string, uso: "nutricional" | "sanitario") => criarProduto(produtoSchema.parse({
  nome, unidade: uso === "nutricional" ? "KG" : "ML", categoriaId, centroCustoIds: [centro.id], fornecedorIds: [fornecedor.id],
  usoNutricional: uso === "nutricional", usoSanitario: uso === "sanitario", rastrearPartidas: false, minimoEstoque: 10,
  ...(uso === "nutricional" ? { perfilNutricional: { materiaSecaPercentual: 88 } } : { perfilSanitario: { carenciaLeiteHoras: 72, carenciaCarneHoras: 24, viaPadrao: "Intramuscular", referenciaTecnica: "DADOS SINTÉTICOS DE TESTE." } }),
}), uid);
const racao = await produto("Volume · Ração", catRacao.id, "nutricional");
const silagem = await produto("Volume · Silagem", catRacao.id, "nutricional");
const mineral = await produto("Volume · Mineral", catRacao.id, "nutricional");
const remedio = await produto("Volume · Medicamento", catMed.id, "sanitario");
log("produtos");

const lotes = [];
for (let i = 1; i <= LOTES; i++) lotes.push(await criarLote({ nome: `Volume ${String(i).padStart(2, "0")}`, propriedadeId, centroCustoId: centro.id, observacao: "Massa de volume" } as never, uid));
log("lotes", lotes.length);

const animais: string[] = [];
for (let n = 1; n <= ANIMAIS; n++) {
  const a = await cadastrar(cadastrarAnimalSchema.parse({
    brinco: `VOL-${String(n).padStart(5, "0")}`, nome: `Volume ${n}`, sexo: "F", origem: "COMPRADO",
    dataNascimento: d(inicio0 - 900), dataEntrada: d(inicio0 - 10), partosAntesDaEntrada: 1, propriedadeId,
    loteId: lotes[(n - 1) % LOTES].id, aptidao: "LEITE", papelReprodutivo: "NENHUM", composicao: [{ racaId: raca.id, fracao64: 64 }],
  }), uid, { nascimentoHistorico: true });
  animais.push(a.id);
  if (n % 500 === 0) log("animais", n);
}

const dietas = [];
for (const [nome, r] of [["Volume · Lactação", 4], ["Volume · Recria", 2]] as const) {
  const dieta = await criarDieta({ nome, observacao: "Massa de volume", itens: [{ produtoId: racao.id, quantidadeCabecaDia: r }, { produtoId: silagem.id, quantidadeCabecaDia: 20 }, { produtoId: mineral.id, quantidadeCabecaDia: 0.2 }] } as never, uid);
  await publicarDieta(dieta.id, uid);
  dietas.push({ ...dieta, r });
}
for (const [i, lote] of lotes.entries()) await atribuirDieta({ loteId: lote.id, propriedadeId, dietaId: dietas[i % 2].id, desde: d(inicio0) }, uid);
log("dietas");

const porLote = Math.ceil(ANIMAIS / LOTES);
for (let m = 0; m < MESES; m++) {
  // Mês do calendário: o fechamento por período não atravessa meses.
  const ini = relativo(new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + m, 1)));
  const fim = relativo(new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + m + 1, 0)));
  if (fim >= 0) break;
  const diasMes = fim - ini + 1;
  const qRacao = Math.ceil(lotes.reduce((t, _, i) => t + dietas[i % 2].r * animais.filter((_, n) => n % LOTES === i).length * diasMes, 0) * 1.1), qSilagem = Math.ceil(20 * ANIMAIS * diasMes * 1.1), qMineral = Math.ceil(0.2 * ANIMAIS * diasMes * 1.1);
  await criarOperacao({ ...operacaoSchema.parse({ tipo: "COMPRA_ESTOQUE", data: d(ini), descricao: `Compra mensal de alimentos ${d(ini)}`, parceiroId: fornecedor.id, centroCustoId: centro.id,
    itens: [[racao, qRacao, 2.1], [silagem, qSilagem, 0.32], [mineral, qMineral, 4.5], [remedio, APLICACOES_MES * 5, 3]].map(([p, q, preco]) => ({ produtoId: (p as { id: string }).id, descricao: (p as { nome: string }).nome, quantidade: q, unidade: (p as { unidade: string }).unidade, valorUnitario: preco, estocavel: true })),
    financeiro: m % 2 ? { condicao: "A_VISTA", contaId: conta.id, formaPagamento: "PIX" } : { condicao: "A_PRAZO", parcelas: [{ valor: Math.round((qRacao * 2.1 + qSilagem * 0.32 + qMineral * 4.5 + APLICACOES_MES * 5 * 3) * 100) / 100, dataVencimento: d(ini + 30) }] } }),
    chave: `volume:compra:${m}`, propriedadeId, usuarioId: uid } as never);
  // Aplicações espalhadas no mês, em ordem de data.
  for (let k = 0; k < APLICACOES_MES; k++) {
    const dia = ini + Math.floor((k * (diasMes - 1)) / APLICACOES_MES), animalId = animais[(m * APLICACOES_MES + k * 7) % animais.length];
    await criarAplicacao({ chave: `volume:aplicacao:${m}:${k}`, animalId, propriedadeId, data: d(dia), aplicadaEm: `${d(dia)}T12:00:00Z`,
      produtoId: remedio.id, nomeProdutoAplicado: remedio.nome, origemInsumo: "BAIXA_ESTOQUE", tipoAplicacaoId: tipoTratamento.id, dose: "5", unidadeDose: "ML", via: "Intramuscular",
      estadoCarenciaLeite: "INFORMADO", estadoCarenciaCarne: "INFORMADO", carenciaLeiteHoras: 72, carenciaCarneHoras: 24, referenciaCarencia: "Massa de volume" } as never, uid);
  }
  // Fechamento por período de cada lote, no fim do mês.
  for (const [i, lote] of lotes.entries()) {
    const animaisLote = animais.filter((_, n) => n % LOTES === i).length, r = dietas[i % 2].r;
    await confirmarConsumo({ chave: `volume:fechamento:${m}:${i}`, loteId: lote.id, propriedadeId, inicio: d(ini), fim: d(fim), centroCustoId: centro.id,
      itens: [[racao, r], [silagem, 20], [mineral, 0.2]].map(([p, q]) => ({ produtoId: (p as { id: string }).id, quantidadeConfirmada: Math.round((q as number) * animaisLote * diasMes * 1000) / 1000, modoEstoque: "BAIXA_ESTOQUE" as const })) }, uid);
  }
  log("mês", m + 1, d(ini));
}
log("pronto");
await prisma.$disconnect();
