// Quando o usuário confirma a nota no WhatsApp, este serviço materializa o
// Lancamento + NotaFiscalArquivo numa transação. Resolve nomes -> IDs, checa
// FechamentoMensal, e atualiza WhatsAppConfirmacaoPendente para CONFIRMADA.

import type { WhatsAppConfirmacaoPendente } from "@prisma/client";
import { prisma } from "../../db.js";
import { assertMesAberto, FechamentoMensalError } from "../fechamento.js";
import { agendarValidacaoAssincrona } from "../notaFiscal/validacaoAssincrona.js";
import {
  resolverCategoriaId,
  resolverCentroCustoId,
  resolverFornecedorId,
} from "./resolverEntidades.js";
import type { ExtracaoNF } from "../../lib/visionExtractor.js";

export type ResultadoCriacao =
  | { ok: true; lancamentoId: number; valor: number; fornecedor: string; categoriaMatched: boolean; centroMatched: boolean }
  | { ok: false; codigo: "MES_FECHADO"; mesAno: string }
  | { ok: false; codigo: "DADOS_INVALIDOS"; mensagem: string }
  | { ok: false; codigo: "ERRO_INTERNO"; mensagem: string };

function parseDataIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  // Construir em UTC (campo é @db.Date — só interessa ano/mês/dia)
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function confirmarECriarLancamento(
  confirmacao: WhatsAppConfirmacaoPendente,
): Promise<ResultadoCriacao> {
  const dados = confirmacao.dadosExtraidos as unknown as ExtracaoNF;

  if (!dados || typeof dados.valorTotal !== "number" || dados.valorTotal <= 0) {
    return { ok: false, codigo: "DADOS_INVALIDOS", mensagem: "valor extraído inválido" };
  }
  const data = parseDataIso(dados.dataEmissao);
  if (!data) {
    return { ok: false, codigo: "DADOS_INVALIDOS", mensagem: "data extraída inválida" };
  }

  // Fechamento mensal: usa dataEmissao como dataCompetencia (regime de caixa,
  // mas o lançamento entra ABERTO e o caixa só conta na liquidação — então
  // checamos com a competência mesmo).
  try {
    await assertMesAberto(data);
  } catch (e) {
    if (e instanceof FechamentoMensalError) {
      return {
        ok: false,
        codigo: "MES_FECHADO",
        mesAno: `${e.mes.toString().padStart(2, "0")}/${e.ano}`,
      };
    }
    throw e;
  }

  const [categoria, centro, fornecedorId] = await Promise.all([
    resolverCategoriaId(dados.categoriaSugerida),
    resolverCentroCustoId(dados.centroCustoSugerido),
    dados.fornecedor && dados.fornecedor.trim()
      ? resolverFornecedorId(dados.fornecedor, dados.cnpj)
      : Promise.resolve<number | null>(null),
  ]);

  const descricao = construirDescricao(dados, { categoriaMatched: categoria.matched, centroMatched: centro.matched });

  try {
    const { lancamento, arquivoId } = await prisma.$transaction(async (tx) => {
      const novo = await tx.lancamento.create({
        data: {
          natureza: "DEBITO",
          valor: dados.valorTotal.toFixed(2),
          dataCompetencia: data,
          dataVencimento: data,
          situacao: "ABERTO",
          categoriaId: categoria.id,
          centroCustoId: centro.id,
          clienteFornecedorId: fornecedorId,
          descricao,
        },
      });

      // Cria NotaFiscalArquivo apontando para o arquivo que já está no storage
      // desde a fase 1 (key "notas/_wa/<sha>.<ext>"). Não chama putObject — o
      // arquivo já foi persistido lá; aqui é só amarração.
      const arquivo = await tx.notaFiscalArquivo.create({
        data: {
          lancamentoId: novo.id,
          storageDriver: confirmacao.storageDriver,
          bucket: confirmacao.bucket,
          storageKey: confirmacao.storageKey,
          mimeType: confirmacao.mimeType,
          tamanhoBytes: confirmacao.tamanhoBytes,
          sha256: confirmacao.sha256,
          statusValidacao: "PENDENTE",
        },
      });

      await tx.whatsAppConfirmacaoPendente.update({
        where: { id: confirmacao.id },
        data: { status: "CONFIRMADA", lancamentoId: novo.id, decididoEm: new Date() },
      });
      return { lancamento: novo, arquivoId: arquivo.id };
    });

    // OCR Tesseract roda em background — não precisa estar na transação.
    agendarValidacaoAssincrona(arquivoId);

    return {
      ok: true,
      lancamentoId: lancamento.id,
      valor: dados.valorTotal,
      fornecedor: dados.fornecedor || "(sem fornecedor)",
      categoriaMatched: categoria.matched,
      centroMatched: centro.matched,
    };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error("[wpp] confirmarECriarLancamento falhou:", mensagem);
    return { ok: false, codigo: "ERRO_INTERNO", mensagem };
  }
}

function construirDescricao(
  dados: ExtracaoNF,
  flags: { categoriaMatched: boolean; centroMatched: boolean },
): string {
  const partes: string[] = ["[WPP]"];
  if (!flags.categoriaMatched || !flags.centroMatched) partes.push("[revisar]");
  if (dados.observacoes) partes.push(dados.observacoes);
  const itensResumo = dados.itens
    .slice(0, 3)
    .map((i) => i.descricao)
    .filter(Boolean)
    .join(" + ");
  if (itensResumo) partes.push(itensResumo);
  return partes.join(" ").slice(0, 240);
}

