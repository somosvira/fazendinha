// Complemento da massa de volume: serviços e despesas ao longo de dois anos no Sítio volume.
import { prisma } from "../src/db.ts";
import { operacaoSchema } from "../src/services/financeiro/schemas.ts";
import { criarOperacao } from "../src/services/financeiro/operacoes.ts";

const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("/fazendinha_volume")) throw new Error("Só gera volume no banco local fazendinha_volume");
const TOTAL = Number(process.env.VOLUME_OPERACOES ?? 2000);
const uid = (await prisma.usuario.findFirstOrThrow({ where: { email: "rafael@test.com" } })).id;
const sitio = await prisma.propriedade.findFirstOrThrow({ where: { nome: "Sítio volume" } });
const conta = await prisma.contaFinanceira.findFirstOrThrow({ where: { nome: "Banco Volume" } });
const centro = await prisma.centroCusto.findFirstOrThrow({ where: { nome: "Produção leiteira" } });
const parceiros = await prisma.parceiro.findMany({ where: { papeis: { some: { papel: "PRESTADOR_SERVICO" } } } });
const categorias = await prisma.categoria.findMany({ where: { nome: { in: ["Energia elétrica", "Manutenção e serviços", "Combustível", "Serviços veterinários", "Fretes", "Internet e telefonia"] } } });
const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
const d = (dias: number) => { const x = new Date(hoje); x.setUTCDate(x.getUTCDate() + dias); return x.toISOString().slice(0, 10); };
for (let n = 0; n < TOTAL; n++) {
  const dia = -730 + Math.floor((n * 728) / TOTAL), categoria = categorias[n % categorias.length], valor = 80 + (n * 37) % 2400;
  await criarOperacao({ ...operacaoSchema.parse({ tipo: "SERVICO", data: d(dia), descricao: `${categoria.nome} — lançamento ${n + 1}`, parceiroId: parceiros[n % parceiros.length].id, categoriaId: categoria.id, centroCustoId: centro.id, valorTotal: valor,
    financeiro: n % 3 ? { condicao: "A_VISTA", contaId: conta.id, formaPagamento: "PIX" } : { condicao: "A_PRAZO", parcelas: [{ valor, dataVencimento: d(dia + 30) }] } }),
    chave: `volume:servico-v2:${n}`, propriedadeId: sitio.id, usuarioId: uid } as never);
  if ((n + 1) % 500 === 0) console.log("operações", n + 1);
}
await prisma.$disconnect();
