import { prisma } from "../server/src/db.js";
import { hashSenha } from "../server/src/services/auth/hash.js";
import { ABAS_IDS, FLAGS_IDS } from "../server/src/services/auth/papeis.js";
import { cadastrar } from "../server/src/services/pecuaria/rebanho/animais.js";
import { cadastrarAnimalSchema } from "../server/src/services/pecuaria/rebanho/schemas.js";
import { criarOperacao } from "../server/src/services/financeiro/operacoes.js";
import { operacaoSchema } from "../server/src/services/financeiro/schemas.js";
const alvo = new URL(process.env.DATABASE_URL!);
if (alvo.hostname !== "localhost" || !/^\/qa_ui_[a-f0-9]{16}$/.test(alvo.pathname)) throw new Error("Fixture exige banco QA isolado");
const senhaHash = hashSenha("QaInterface!2026");
for (const [perfil, flags, areas] of [["dono", FLAGS_IDS, ["financeiro", "pecuaria"]], ["consulta", ["verValores", "verInvestimento", "verSalarios", "exportar"], ["financeiro", "pecuaria"]], ["operador", ["lancar"], ["financeiro", "pecuaria"]], ["sem-area", [], []]] as const) {
  await prisma.usuario.create({ data: { nome: `QA ${perfil}`, email: `${perfil}@qa.example.test`, papel: "personalizado", abas: ABAS_IDS, flags: [...flags], areas: [...areas], dono: perfil === "dono", status: "ATIVO", senhaHash } });
}
const sitio = await prisma.propriedade.create({ data: { nome: "QA Principal" } });
await prisma.propriedade.create({ data: { nome: "QA Destino" } });
const conta = await prisma.contaFinanceira.create({ data: { nome: "QA Conta", tipo: "CAIXA", propriedadeId: sitio.id, saldoAbertura: 1000, dataSaldoAbertura: new Date("2026-01-01") } });
const parceiro = await prisma.parceiro.create({ data: { nome: "QA Fornecedor", papeis: { create: [{ papel: "FORNECEDOR" }] } } });
const categoria = await prisma.categoria.create({ data: { nome: "QA Insumos", classificacao: "CUSTEIO" } });
const produto = await prisma.produto.create({ data: { nome: "QA Ração", unidade: "KG", categoriaId: categoria.id, usoNutricional: true } });
const lote = await prisma.lote.create({ data: { nome: "QA Matrizes", propriedadeId: sitio.id } });
await cadastrar(cadastrarAnimalSchema.parse({ brinco: "QA-001", sexo: "F", origem: "COMPRADO", aptidao: "CORTE", propriedadeId: sitio.id, loteId: lote.id, dataNascimento: "2025-01-01", dataEntrada: "2026-01-01" }), null);
await criarOperacao({ ...operacaoSchema.parse({ tipo: "COMPRA_ESTOQUE", data: "2026-10-01", descricao: "QA Compra com valores restritos", parceiroId: parceiro.id, itens: [{ produtoId: produto.id, descricao: "QA Ração", quantidade: 10, unidade: "KG", valorUnitario: 13.79, estocavel: true }], valorTotal: 137.9, financeiro: { condicao: "A_VISTA", contaId: conta.id } }), propriedadeId: sitio.id, usuarioId: null });
console.log("Fixtures QA criadas: quatro perfis, dois sítios, conta, compra, produto e animal.");
await prisma.$disconnect();
