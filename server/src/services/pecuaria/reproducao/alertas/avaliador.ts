import type { PrismaClient } from "@prisma/client";
import { dataCivil, diaCivil } from "../../sanidade/alertas/datas.calc.js";
import { reconciliarAlertasReprodutivosAnimalTx } from "./produtor.js";
/** Lotes confirmam publicações e cursor juntos. A trava global serializa avaliadores, o animal serializa fatos/automação. */
export async function avaliarAlertasReprodutivos(
  db: PrismaClient,
  agora = new Date(),
  maxLotes = 20,
) {
  const hoje = dataCivil(diaCivil(agora));
  let lotes = 0;
  try {
    while (lotes < maxLotes) {
      const estado = await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('avaliacao-alertas-reproducao',0))`;
          const controle = await tx.avaliacaoAlertas.upsert({
            where: { id: "reproducao" },
            create: { id: "reproducao", produtor: "reproducao" },
            update: {},
          });
          if (
            controle.diaCoberto &&
            controle.diaCoberto >= hoje &&
            !controle.cursor &&
            controle.estado !== "DESATUALIZADO"
          )
            return "CONCLUIDO";
          const cursor = controle.cursor
            ? (JSON.parse(controle.cursor) as { dia: string; animalId: string })
            : null;
          const referencia = cursor ? new Date(cursor.dia) : hoje;
          const animais = await tx.animal.findMany({
            where: {
              ...(cursor?.animalId ? { id: { gt: cursor.animalId } } : {}),
              OR: [
                { sexo: "F", localizacoes: { some: { ate: null } } },
                {
                  id: {
                    in: (
                      await tx.necessidadeReprodutiva.findMany({
                        where: {
                          situacao: {
                            notIn: ["ENCERRADO", "RESOLVIDO", "DISPENSADO"],
                          },
                        },
                        select: { animalId: true },
                        distinct: ["animalId"],
                      })
                    ).map((n) => n.animalId),
                  },
                },
              ],
            },
            select: { id: true },
            orderBy: { id: "asc" },
            take: 25,
          });
          for (const a of animais)
            await reconciliarAlertasReprodutivosAnimalTx(
              tx,
              a.id,
              null,
              referencia,
            );
          const concluiu = animais.length < 25;
          await tx.avaliacaoAlertas.update({
            where: { id: "reproducao" },
            data: concluiu
              ? {
                  diaCoberto: referencia,
                  ultimaConclusao: new Date(),
                  cursor: null,
                  estado: "CONCLUIDO",
                  erro: null,
                }
              : {
                  cursor: JSON.stringify({
                    dia: referencia.toISOString(),
                    animalId: animais.at(-1)!.id,
                  }),
                  estado: "EM_EXECUCAO",
                  erro: null,
                },
          });
          return concluiu && referencia >= hoje ? "CONCLUIDO" : "CONTINUAR";
        },
        { timeout: 55000, isolationLevel: "ReadCommitted" },
      );
      lotes++;
      if (estado === "CONCLUIDO") return { estado, lotes };
    }
    return { estado: "PARCIAL", lotes };
  } catch (erro) {
    await db.avaliacaoAlertas.upsert({
      where: { id: "reproducao" },
      create: {
        id: "reproducao",
        produtor: "reproducao",
        estado: "FALHA",
        erro: "Falha na avaliação reprodutiva",
      },
      update: { estado: "FALHA", erro: "Falha na avaliação reprodutiva" },
    });
    throw erro;
  }
}
