import { createHash } from "node:crypto";
import { resolve } from "node:path";
import XLSX from "xlsx";
import { prisma } from "../src/db.js";
import { env } from "../src/env.js";
import { criarConta } from "../src/services/financeiro/contas.js";
import { criarCategoria, criarCentroCusto } from "../src/services/financeiro/cadastros-gerenciais.js";
import { criarOperacao } from "../src/services/financeiro/operacoes.js";
import { criarParceiro, atualizarParceiro } from "../src/services/financeiro/parceiros.js";
import { criarPropriedade } from "../src/services/propriedade.js";

const ABA = "RN_SICOOB PJ";
const NOME_PROPRIEDADE = "Rio Novo";
const NOME_CONTA = "BB MAGC";
const VAZIO = "(vazio)";

type Linha = {
  linha: number;
  data: Date;
  natureza: "Credito" | "Debito";
  grupo: string | null;
  categoria: string | null;
  parceiro: string | null;
  documento: string | null;
  valor: number;
};

function texto(valor: unknown) {
  if (typeof valor !== "string") return null;
  const normalizado = valor.trim();
  return normalizado && normalizado !== VAZIO ? normalizado : null;
}

function dataExcel(valor: unknown, linha: number) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return new Date(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate()));
  throw new Error(`A linha ${linha} da aba ${ABA} não tem uma data válida.`);
}

function chave(linha: number) {
  const hex = createHash("sha256").update(`rio-novo-2026-05-04:${linha}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function descricao(linha: Linha) {
  const partes = ["Importação Rio Novo", linha.data.toISOString().slice(0, 10), linha.categoria, linha.parceiro, linha.documento].filter((parte): parte is string => Boolean(parte));
  return partes.join(" · ").slice(0, 240);
}

function ehPatrimonial(linha: Linha) {
  const categoria = `${linha.grupo ?? ""} ${linha.categoria ?? ""}`.toLocaleLowerCase("pt-BR");
  return categoria.includes("transfer") || categoria.includes("saldo inicial") || categoria.includes("aplica") || categoria.includes("estorno") || categoria.includes("ajuste") || categoria.includes("identificar") || categoria.includes("reembolso");
}

function classificacao(categoria: string | null) {
  const nome = categoria?.toLocaleLowerCase("pt-BR") ?? "";
  return nome.includes("invest") || nome.includes("aquisição") || nome.includes("aquisicao") || nome.includes("material de construção") || nome.includes("maq e equip") || nome.includes("empreitada") ? "INVESTIMENTO" as const : null;
}

/** Lê somente a tabela dinâmica detalhada; abas de totais e projeções não são fatos importáveis. */
export function lerLancamentosRioNovo(caminho: string): Linha[] {
  const arquivo = XLSX.readFile(caminho, { cellDates: true, raw: true });
  const planilha = arquivo.Sheets[ABA];
  if (!planilha) throw new Error(`A planilha obrigatória “${ABA}” não foi encontrada.`);
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(planilha, { header: 1, defval: null, raw: true }) as unknown[][];
  const resultado: Linha[] = [];
  let data: Date | null = null;
  let grupo: string | null = null;
  let categoria: string | null = null;
  let parceiro: string | null = null;
  let documento: string | null = null;

  for (let indice = 6; indice < linhas.length; indice += 1) {
    const registro = linhas[indice] ?? [];
    if (registro[0] === "Total Geral") break;
    const natureza = texto(registro[1]);
    if (natureza !== "Credito" && natureza !== "Debito") continue;
    if (registro[0] != null) data = dataExcel(registro[0], indice + 1);
    if (!data) throw new Error(`A linha ${indice + 1} não pode ser associada a uma data.`);
    grupo = texto(registro[2]) ?? grupo;
    categoria = texto(registro[3]) ?? categoria;
    parceiro = texto(registro[4]) ?? parceiro;
    documento = texto(registro[5]) ?? documento;
    const valor = registro[6];
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor === 0) throw new Error(`A linha ${indice + 1} não tem valor financeiro válido.`);
    if (natureza === "Credito" && valor < 0 || natureza === "Debito" && valor > 0) throw new Error(`O sinal da linha ${indice + 1} diverge de ${natureza}.`);
    resultado.push({ linha: indice + 1, data, natureza, grupo, categoria, parceiro, documento, valor: Math.abs(valor) });
  }

  if (!resultado.length) throw new Error(`Nenhum lançamento detalhado foi encontrado em “${ABA}”.`);
  return resultado;
}

async function garantirCadastro(nome: string, ordem: number, usuarioId: number) {
  const existente = await prisma.centroCusto.findUnique({ where: { nome } });
  return existente ?? criarCentroCusto({ nome, ordem }, usuarioId);
}

async function garantirCategoria(nome: string, ordem: number, usuarioId: number) {
  const existente = await prisma.categoria.findUnique({ where: { nome } });
  return existente ?? criarCategoria({ nome, ordem, classificacao: classificacao(nome) }, usuarioId);
}

async function garantirParceiro(nome: string, papeis: Array<"CLIENTE" | "FORNECEDOR" | "PRESTADOR_SERVICO">, usuarioId: number) {
  const existente = await prisma.parceiro.findFirst({ where: { nome }, include: { papeis: true } });
  if (!existente) return criarParceiro({ nome, papeis, usuarioId });
  const combinados = [...new Set([...existente.papeis.map(({ papel }) => papel), ...papeis])];
  if (combinados.length !== existente.papeis.length) return atualizarParceiro(existente.id, { papeis: combinados }, usuarioId);
  return existente;
}

async function main() {
  const argumentos = process.argv.slice(2).filter((argumento) => argumento !== "--");
  const verificar = argumentos.includes("--verificar");
  const caminho = argumentos.find((argumento) => argumento !== "--verificar");
  if (!caminho || argumentos.filter((argumento) => argumento !== "--verificar").length !== 1) {
    throw new Error("Uso: pnpm --filter rionovo-server run seed:rio-novo -- <arquivo.xlsx> [--verificar]");
  }
  if (env.NODE_ENV === "production") throw new Error("A carga Rio Novo não pode ser executada em produção.");
  const destino = new URL(env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(destino.hostname)) {
    throw new Error("A carga Rio Novo só pode ser executada em um PostgreSQL local.");
  }

  const lancamentos = lerLancamentosRioNovo(resolve(caminho));
  const resumo = {
    total: lancamentos.length,
    inicio: lancamentos.reduce((menor, item) => item.data < menor ? item.data : menor, lancamentos[0].data).toISOString().slice(0, 10),
    fim: lancamentos.reduce((maior, item) => item.data > maior ? item.data : maior, lancamentos[0].data).toISOString().slice(0, 10),
    creditos: lancamentos.filter((item) => item.natureza === "Credito").reduce((soma, item) => soma + item.valor, 0),
    debitos: lancamentos.filter((item) => item.natureza === "Debito").reduce((soma, item) => soma + item.valor, 0),
  };
  if (verificar) {
    process.stdout.write(`${JSON.stringify(resumo)}\n`);
    return;
  }

  const usuario = await prisma.usuario.findFirst({ where: { dono: true, status: "ATIVO" }, orderBy: { id: "asc" } });
  if (!usuario) throw new Error("Crie um usuário dono ativo antes de importar o histórico Rio Novo.");
  const propriedade = await prisma.propriedade.findFirst({ where: { nome: NOME_PROPRIEDADE } })
    ?? await criarPropriedade({ nome: NOME_PROPRIEDADE, principal: false, cidade: "Não informado", uf: "MG" });
  const conta = await prisma.contaFinanceira.findFirst({ where: { propriedadeId: propriedade.id, nome: NOME_CONTA } })
    ?? await criarConta({ nome: NOME_CONTA, tipo: "BANCO", instituicao: "Banco do Brasil", agencia: "Não informado", numeroConta: "Não informado", titular: NOME_PROPRIEDADE, saldoAbertura: 0, dataSaldoAbertura: lancamentos[0].data, incluirNoSaldoGeral: true, propriedadeId: propriedade.id, usuarioId: usuario.id });

  const centros = new Map<string, string>();
  const categorias = new Map<string, string>();
  const parceiros = new Map<string, string>();
  const grupos = [...new Set(lancamentos.map((item) => item.grupo).filter((item): item is string => Boolean(item)))];
  for (const [ordem, nome] of grupos.entries()) centros.set(nome, (await garantirCadastro(nome, ordem, usuario.id)).id);
  const nomesCategorias = [...new Set(lancamentos.map((item) => item.categoria).filter((item): item is string => Boolean(item)))];
  for (const [ordem, nome] of nomesCategorias.entries()) categorias.set(nome, (await garantirCategoria(nome, ordem, usuario.id)).id);
  for (const nome of [...new Set(lancamentos.map((item) => item.parceiro).filter((item): item is string => Boolean(item)))]) {
    const usos = lancamentos.filter((item) => item.parceiro === nome).map((item) => item.natureza === "Credito" ? "CLIENTE" as const : "FORNECEDOR" as const);
    parceiros.set(nome, (await garantirParceiro(nome, usos, usuario.id)).id);
  }

  for (const item of lancamentos) {
    const patrimonial = ehPatrimonial(item);
    const parceiroId = item.parceiro ? parceiros.get(item.parceiro) : undefined;
    const categoriaId = item.categoria ? categorias.get(item.categoria) : undefined;
    const centroCustoId = item.grupo ? centros.get(item.grupo) : undefined;
    if (patrimonial) {
      await criarOperacao({
        chave: chave(item.linha), tipo: item.natureza === "Credito" ? "APORTE" : "RETIRADA", data: item.data,
        descricao: descricao(item), valorTotal: item.valor, propriedadeId: propriedade.id, usuarioId: usuario.id,
        itens: [],
        financeiro: { condicao: "A_VISTA", contaId: conta.id, formaPagamento: "TRANSFERENCIA_BANCARIA" },
      });
      continue;
    }
    if (!parceiroId || !categoriaId || !centroCustoId) throw new Error(`A linha ${item.linha} não possui classificação suficiente para criar uma operação.`);
    if (item.natureza === "Debito") {
      await criarOperacao({
        chave: chave(item.linha), tipo: "SERVICO", data: item.data, descricao: descricao(item), valorTotal: item.valor,
        parceiroId, categoriaId, centroCustoId, classificacao: classificacao(item.categoria), propriedadeId: propriedade.id, usuarioId: usuario.id,
        itens: [],
        financeiro: { condicao: "A_VISTA", contaId: conta.id, formaPagamento: "TRANSFERENCIA_BANCARIA" },
      });
    } else {
      await criarOperacao({
        chave: chave(item.linha), tipo: "VENDA", data: item.data, descricao: descricao(item), parceiroId, centroCustoId,
        itens: [{ descricao: item.categoria ?? "Receita sem categoria", quantidade: 1, unidade: "UN", valorTotal: item.valor, estocavel: false, categoriaId, classificacao: classificacao(item.categoria) }],
        propriedadeId: propriedade.id, usuarioId: usuario.id,
        financeiro: { condicao: "A_VISTA", contaId: conta.id, formaPagamento: "TRANSFERENCIA_BANCARIA" },
      });
    }
  }
  process.stdout.write(`Carga Rio Novo concluída: ${JSON.stringify(resumo)}\n`);
}

main()
  .catch((erro: unknown) => { console.error(erro instanceof Error ? erro.message : erro); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
