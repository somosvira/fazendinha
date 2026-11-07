import type { Alerta } from "@prisma/client";
import { prisma } from "../../../../db.js";
import type { UsuarioContexto } from "../../../auth/sessao.js";
import { temPermissao } from "../../../auth/papeis.js";
const camposPrazo = new Set([
  "versao",
  "origem",
  "politicaId",
  "politicaVersao",
  "tipoExameId",
  "tipoExameVersao",
  "publico",
  "referencia",
  "dataReferencia",
  "intervalo",
  "unidade",
  "antecedencia",
  "tolerancia",
  "resolucao",
  "dias",
  "efeito",
]);
function prazoOperacional(resumo: unknown) {
  return resumo && typeof resumo === "object" && !Array.isArray(resumo)
    ? Object.fromEntries(
        Object.entries(resumo).filter(([campo]) => camposPrazo.has(campo)),
      )
    : {};
}
export async function detalheAlertaReprodutivo(
  alerta: Alerta,
  usuario: UsuarioContexto,
) {
  const n = await prisma.necessidadeReprodutiva.findUnique({
    where: { alertaId: alerta.id },
  });
  if (!n)
    return {
      alertaId: alerta.id,
      titulo: alerta.titulo,
      motivo: alerta.motivo,
      situacao: alerta.situacao,
      evidenciaDisparo: alerta.snapshotInicial,
      origem: { estado: "INDISPONIVEL" as const },
      acoes: [],
    };
  const [animal, eventos] = await Promise.all([
    prisma.animal.findUnique({
      where: { id: n.animalId },
      select: { id: true, brinco: true, nome: true },
    }),
    prisma.eventoAlerta.findMany({
      where: { alertaId: alerta.id },
      select: {
        id: true,
        revisao: true,
        comando: true,
        criadoEm: true,
        autorUsuarioId: true,
        autorTecnico: true,
        payload: true,
      },
      orderBy: { revisao: "asc" },
    }),
  ]);
  const escrever =
    temPermissao(usuario, "lancar") &&
    !["RESOLVIDO", "ENCERRADO", "DISPENSADO"].includes(n.situacao);
  return {
    alertaId: alerta.id,
    produtor: "reproducao",
    necessidadeId: n.id,
    revisao: n.revisao,
    titulo: alerta.titulo,
    motivo: n.motivo,
    situacao: n.situacao,
    evidenciaDisparo: alerta.snapshotInicial,
    origem: {
      estado: animal ? ("DISPONIVEL" as const) : ("REMOVIDA" as const),
      animal,
      tipo: n.tipo,
      origemId: n.origemId,
      tarefaId: n.tarefaId,
      demandaId: n.demandaId,
      participacaoId: n.participacaoId,
      dataReferencia: n.dataReferencia.toISOString().slice(0, 10),
      previstaPara: n.previstaPara?.toISOString().slice(0, 10) ?? null,
      dataAtencao:
        n.revisaoEm?.toISOString().slice(0, 10) ??
        n.previstaPara?.toISOString().slice(0, 10) ??
        null,
      regraSnapshot: prazoOperacional(n.regraSnapshot),
      decisao: n.decisao,
      destino: n.decisaoDestino,
      revisaoEm: n.revisaoEm?.toISOString().slice(0, 10) ?? null,
    },
    eventos,
    acoes: escrever
      ? [
          ...(n.tipo === "DISPOSITIVO_SEM_RETIRADA"
            ? ["REGISTRAR_RETIRADA_FISICA"]
            : []),
          "REAGENDAR",
          ...(n.tipo === "DISPOSITIVO_SEM_RETIRADA" ? [] : ["DISPENSAR"]),
          ...(n.participacaoId ? ["RETIRAR"] : []),
          "SUSPENDER",
        ]
      : [],
  };
}
