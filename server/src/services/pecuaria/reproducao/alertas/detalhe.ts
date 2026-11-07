import { necessidadeAtualTx } from "./identidade.js";
import type { Alerta, Prisma } from "@prisma/client";
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
  return detalheAlertaReprodutivoTx(prisma, alerta, usuario);
}
export async function detalheAlertaReprodutivoTx(
  tx: Prisma.TransactionClient,
  alerta: Alerta,
  usuario: UsuarioContexto,
) {
  const consultada = await tx.necessidadeReprodutiva.findUnique({
    where: { alertaId: alerta.id },
  });
  if (!consultada)
    return {
      alertaId: alerta.id,
      titulo: alerta.titulo,
      motivo: alerta.motivo,
      situacao: alerta.situacao,
      evidenciaDisparo: alerta.snapshotInicial,
      origem: { estado: "INDISPONIVEL" as const },
      acoes: [],
    };
  const n = await necessidadeAtualTx(tx, consultada);
  if (n.propriedadeId !== alerta.propriedadeId)
    return {
      alertaId: alerta.id,
      produtor: "reproducao",
      necessidadeId: consultada.id,
      titulo: alerta.titulo,
      motivo: alerta.motivo,
      situacao: alerta.situacao,
      evidenciaDisparo: alerta.snapshotInicial,
      origem: { estado: "INDISPONIVEL" as const },
      acoes: [],
    };
  const alertaAtual =
    n.alertaId && n.alertaId !== alerta.id
      ? await tx.alerta.findUniqueOrThrow({ where: { id: n.alertaId } })
      : alerta;
  const doAnimal = await tx.necessidadeReprodutiva.findMany({
    where: { animalId: n.animalId },
    select: { id: true, alertaId: true, convergidaParaId: true },
  });
  const mapa = new Map(doAnimal.map((i) => [i.id, i]));
  const identidades = doAnimal.filter((i) => {
    const visitadas = new Set<string>();
    let atual: (typeof doAnimal)[number] | undefined = i;
    while (
      atual &&
      atual.id !== n.id &&
      atual.convergidaParaId &&
      !visitadas.has(atual.id)
    ) {
      visitadas.add(atual.id);
      atual = mapa.get(atual.convergidaParaId);
    }
    return atual?.id === n.id;
  });
  const [animal, eventos] = await Promise.all([
    tx.animal.findUnique({
      where: { id: n.animalId },
      select: { id: true, brinco: true, nome: true },
    }),
    tx.eventoAlerta.findMany({
      where: {
        alertaId: {
          in: identidades.flatMap((i) => (i.alertaId ? [i.alertaId] : [])),
        },
      },
      select: {
        id: true,
        revisao: true,
        comando: true,
        criadoEm: true,
        autorUsuarioId: true,
        autorTecnico: true,
        payload: true,
      },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    }),
  ]);
  const escrever =
    temPermissao(usuario, "lancar") &&
    !["RESOLVIDO", "ENCERRADO", "DISPENSADO"].includes(n.situacao);
  return {
    alertaId: alertaAtual.id,
    identidadeConsultada: {
      necessidadeId: consultada.id,
      alertaId: alerta.id,
      evidencia: alerta.snapshotInicial,
    },
    produtor: "reproducao",
    necessidadeId: n.id,
    revisao: n.revisao,
    titulo: alertaAtual.titulo,
    motivo: n.motivo,
    situacao: n.situacao,
    evidenciaDisparo: alertaAtual.snapshotInicial,
    origem: {
      estado: animal ? ("DISPONIVEL" as const) : ("REMOVIDA" as const),
      animal,
      tipo: n.tipo,
      origemId: n.origemId,
      tarefaId: n.tarefaId,
      demandaId: n.demandaId,
      participacaoId: n.participacaoId,
      dataReferencia: n.dataReferencia.toISOString().slice(0, 10),
      previstaPara:
        (["REAGENDAR", "SUSPENDER"].includes(n.decisao ?? "")
          ? (n.revisaoEm ?? n.previstaPara)
          : n.previstaPara
        )
          ?.toISOString()
          .slice(0, 10) ?? null,
      previstaPelaRegra: n.previstaPara?.toISOString().slice(0, 10) ?? null,
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
