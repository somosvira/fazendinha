// Promove um NotaFiscalUploadPendente para Lancamento + NotaFiscalArquivo
// numa única transação. Esta é a função que efetivamente "finaliza o upload":
// só aqui o arquivo deixa de ser pendente e vira parte do histórico.
//
// Aceita os dados do form já resolvidos para IDs reais (categoriaId,
// centroCustoId, contaBancariaId, clienteFornecedorId). A resolução de FK
// fica na rota — aqui só transação.

import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { assertMesAberto, FechamentoMensalError } from "../fechamento.js";
import { agendarValidacaoAssincrona } from "./validacaoAssincrona.js";

export type DadosLancamentoNovo = {
  natureza: "DEBITO" | "CREDITO";
  valor: Prisma.Decimal | string; // sempre positivo
  dataCompetencia: Date;
  dataVencimento: Date;
  dataLiquidacao: Date | null; // null -> ABERTO
  categoriaId: number;
  centroCustoId: number;
  contaBancariaId: number | null;
  clienteFornecedorId: number | null;
  descricao: string | null;
  numeroDocumento: string | null;
};

export type ResultadoConfirmacao =
  | {
      ok: true;
      lancamento: { id: number };
      arquivo: { id: number };
    }
  | { ok: false; codigo: "PENDENTE_INVALIDA"; mensagem: string }
  | { ok: false; codigo: "MES_FECHADO"; ano: number; mes: number }
  | { ok: false; codigo: "ERRO_INTERNO"; mensagem: string };

export async function confirmarPendenteECriarLancamento(args: {
  pendenteId: number;
  dados: DadosLancamentoNovo;
}): Promise<ResultadoConfirmacao> {
  const { pendenteId, dados } = args;

  const pendente = await prisma.notaFiscalUploadPendente.findUnique({
    where: { id: pendenteId },
  });
  if (!pendente) {
    return { ok: false, codigo: "PENDENTE_INVALIDA", mensagem: "Upload pendente não encontrado." };
  }
  if (pendente.status !== "AGUARDANDO") {
    return {
      ok: false,
      codigo: "PENDENTE_INVALIDA",
      mensagem: `Upload pendente em estado ${pendente.status} — recomece o upload.`,
    };
  }
  if (pendente.expiraEm < new Date()) {
    return {
      ok: false,
      codigo: "PENDENTE_INVALIDA",
      mensagem: "Upload pendente expirou (>30min). Reenvie a foto.",
    };
  }

  // Fechamento mensal sobre a data efetiva de caixa: liquidação se existir,
  // senão competência.
  const dataCaixa = dados.dataLiquidacao ?? dados.dataCompetencia;
  try {
    await assertMesAberto(dataCaixa);
  } catch (e) {
    if (e instanceof FechamentoMensalError) {
      return { ok: false, codigo: "MES_FECHADO", ano: e.ano, mes: e.mes };
    }
    throw e;
  }

  try {
    const { lancamentoId, arquivoId } = await prisma.$transaction(async (tx) => {
      const novo = await tx.lancamento.create({
        data: {
          natureza: dados.natureza,
          valor: dados.valor,
          dataCompetencia: dados.dataCompetencia,
          dataVencimento: dados.dataVencimento,
          dataLiquidacao: dados.dataLiquidacao,
          situacao: dados.dataLiquidacao ? "LIQUIDADO" : "ABERTO",
          categoriaId: dados.categoriaId,
          centroCustoId: dados.centroCustoId,
          contaBancariaId: dados.contaBancariaId,
          clienteFornecedorId: dados.clienteFornecedorId,
          descricao: dados.descricao,
          numeroDocumento: dados.numeroDocumento,
        },
      });

      // O arquivo já está no storage (key notas/_pendente/<sha>.<ext>); aqui
      // só criamos a amarração definitiva. Mantemos a mesma key — não vale o
      // custo de copiar o objeto pra notas/<lancamentoId>/.
      const arquivo = await tx.notaFiscalArquivo.create({
        data: {
          lancamentoId: novo.id,
          storageDriver: pendente.storageDriver,
          bucket: pendente.bucket,
          storageKey: pendente.storageKey,
          mimeType: pendente.mimeType,
          tamanhoBytes: pendente.tamanhoBytes,
          sha256: pendente.sha256,
          statusValidacao: "PENDENTE",
          ocrTexto: pendente.ocrTexto,
        },
      });

      // Trava otimista: só promove a pendente se ela continua AGUARDANDO.
      // Evita race com cleanup/cancelamento concorrente.
      const r = await tx.notaFiscalUploadPendente.updateMany({
        where: { id: pendente.id, status: "AGUARDANDO" },
        data: { status: "CONFIRMADO", lancamentoId: novo.id, decididoEm: new Date() },
      });
      if (r.count === 0) {
        throw new Error("pendente mudou de estado durante a transação");
      }
      return { lancamentoId: novo.id, arquivoId: arquivo.id };
    });

    // OCR Tesseract roda em background — fora da transação.
    agendarValidacaoAssincrona(arquivoId);

    return { ok: true, lancamento: { id: lancamentoId }, arquivo: { id: arquivoId } };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error("[confirmarPendente] falhou:", mensagem);
    return { ok: false, codigo: "ERRO_INTERNO", mensagem };
  }
}
