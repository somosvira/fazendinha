import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { temArea, temPermissao } from "../auth/papeis.js";
import { conferirAnimalNoFato } from "../pecuaria/fatos.js";
import { confirmarFato } from "../pecuaria/idempotencia.js";
import { registrarPesagemTx } from "../pecuaria/rebanho/animais.js";
import { RebanhoError } from "../pecuaria/rebanho/regras.js";
import { pesagemSchema } from "../pecuaria/rebanho/schemas.js";
import {
  AssistenteError,
  type ContextoAssistente,
  type FerramentaAssistente,
} from "./tipos.js";

export const podeEditarRebanho = (u: {
  dono: boolean;
  areas: string[];
  flags: string[];
}) => temArea(u, "pecuaria") && temPermissao(u, "lancar");
interface Proposta {
  chave: string;
  usuarioId: number;
  propriedadeId: number;
  animalId: string;
  data: string;
  pesoKg: number;
  expiraEm: number;
}
export function assinarProposta(dados: Proposta) {
  const corpo = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${corpo}.${createHmac("sha256", env.JWT_SECRET).update(corpo).digest("base64url")}`;
}
export function lerProposta(
  token: string,
  usuarioId: number,
  propriedadeId: number | null,
): Proposta {
  try {
    const [corpo, assinatura, extra] = token.split(".");
    const esperado = createHmac("sha256", env.JWT_SECRET)
      .update(corpo)
      .digest();
    const recebido = Buffer.from(assinatura, "base64url");
    if (
      extra ||
      recebido.length !== esperado.length ||
      !timingSafeEqual(esperado, recebido)
    )
      throw new Error();
    const dados = JSON.parse(
      Buffer.from(corpo, "base64url").toString(),
    ) as Proposta;
    if (
      dados.usuarioId !== usuarioId ||
      dados.propriedadeId !== propriedadeId ||
      dados.expiraEm < Date.now()
    )
      throw new Error();
    return dados;
  } catch {
    throw new AssistenteError(
      "VALIDACAO",
      "Esta confirmação expirou ou mudou de contexto. Peça novamente a pesagem.",
    );
  }
}
const argumentos = z
  .object({
    brinco: z.string().trim().min(1).max(100).nullable(),
    data: z.string().nullable(),
    pesoKg: z.number().nullable(),
  })
  .strict();
export const ferramentaPesagem: FerramentaAssistente = {
  dominio: "rebanho",
  permitida: (ctx) => ctx.modo === "editar" && podeEditarRebanho(ctx.usuario),
  spec: {
    type: "function",
    name: "preparar_pesagem",
    description:
      "Prepara uma pesagem de rotina manual de UM animal para confirmação humana. Não grava. Só para peso de rotina; nascimento, desmama, parto, secagem e saída exigem seus fluxos. Não invente brinco, data ou peso: use null quando faltar.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        brinco: { type: ["string", "null"] },
        data: {
          type: ["string", "null"],
          description: "YYYY-MM-DD; hoje apenas se solicitado",
        },
        pesoKg: { type: ["number", "null"] },
      },
      required: ["brinco", "data", "pesoKg"],
      additionalProperties: false,
    },
  },
  executar: async (args, ctx) => {
    const input = argumentos.parse(args);
    const esclarecer = (resposta: string) => ({
      modo: "esclarecimento" as const,
      resposta,
      fontes: [],
    });
    if (!ctx.propriedadeId)
      return esclarecer(
        "Selecione uma fazenda específica antes de preparar uma pesagem.",
      );
    if (!input.brinco || !input.data || input.pesoKg == null)
      return esclarecer(
        "Para preparar a pesagem de rotina, informe o brinco exato, a data e o peso em kg. O registro será manual, com precisão não informada; você confere tudo antes de confirmar.",
      );
    const payload = pesagemSchema.parse({
      data: input.data,
      pesoKg: input.pesoKg,
      tipo: "ROTINA",
      origem: "MANUAL",
    });
    const data = new Date(`${payload.data}T00:00:00Z`);
    const animais = await prisma.animal.findMany({
      where: {
        brinco: input.brinco,
        localizacoes: {
          some: {
            propriedadeId: ctx.propriedadeId,
            desde: { lte: data },
            OR: [{ ate: null }, { ate: { gt: data } }],
          },
        },
      },
      select: { id: true, brinco: true, nome: true },
      take: 2,
    });
    if (animais.length !== 1)
      return esclarecer(
        animais.length
          ? "Há mais de um animal com esse brinco no sítio e data. Confira a identificação na ficha antes de registrar."
          : "Não encontrei esse brinco no sítio e data informados. Confira o brinco, a fazenda e a data.",
      );
    const animal = animais[0];
    await prisma.$transaction((tx) =>
      conferirAnimalNoFato(tx, animal.id, ctx.propriedadeId!, data),
    );
    const token = assinarProposta({
      chave: randomUUID(),
      usuarioId: ctx.usuario.id,
      propriedadeId: ctx.propriedadeId,
      animalId: animal.id,
      data: payload.data,
      pesoKg: payload.pesoKg,
      expiraEm: Date.now() + 15 * 60_000,
    });
    // Comparação com a pesagem anterior ajuda a conferir peso digitado errado.
    const anterior = await prisma.pesagem.findFirst({
      where: { animalId: animal.id, data: { lt: data } },
      orderBy: { data: "desc" },
      select: { data: true, pesoKg: true },
    });
    return {
      modo: "proposta",
      resposta: "Confira os dados antes de registrar esta pesagem.",
      fontes: [],
      proposta: {
        token,
        animal: [animal.brinco, animal.nome].filter(Boolean).join(" · "),
        data: payload.data,
        pesoKg: payload.pesoKg,
        tipo: "Rotina",
        origem: "Manual",
        precisao: "Não informada",
        ...(anterior
          ? {
              anterior: {
                data: anterior.data.toISOString().slice(0, 10),
                pesoKg: Number(anterior.pesoKg),
              },
            }
          : {}),
      },
    };
  },
};
export async function confirmarPesagem(token: string, ctx: ContextoAssistente) {
  if (ctx.modo !== "editar" || !podeEditarRebanho(ctx.usuario))
    throw new AssistenteError(
      "VALIDACAO",
      "Você não tem permissão para registrar pesagens neste modo.",
    );
  const dados = lerProposta(token, ctx.usuario.id, ctx.propriedadeId);
  const input = {
    ...pesagemSchema.parse({
      data: dados.data,
      pesoKg: dados.pesoKg,
      tipo: "ROTINA",
      origem: "MANUAL",
    }),
    chave: dados.chave,
    animalId: dados.animalId,
    propriedadeId: dados.propriedadeId,
  };
  try {
    const fato = await confirmarFato(
      input,
      ctx.usuario.id,
      "ASSISTENTE_PESAGEM",
      async (tx, body, usuarioId) => {
        await conferirAnimalNoFato(
          tx,
          body.animalId,
          body.propriedadeId,
          new Date(`${body.data}T00:00:00Z`),
        );
        return registrarPesagemTx(tx, body, usuarioId);
      },
      (tx, id) => tx.pesagem.findUniqueOrThrow({ where: { id } }),
    );
    return {
      modo: "dados" as const,
      resposta: `Pesagem registrada: ${Number(fato.pesoKg).toLocaleString("pt-BR")} kg em ${dados.data.split("-").reverse().join("/")}.`,
      fontes: [
        {
          titulo: "Conferir ficha do animal",
          url: `/pecuaria/rebanho/animais/${dados.animalId}?sitio=${dados.propriedadeId}`,
        },
      ],
    };
  } catch (e) {
    if (e instanceof RebanhoError)
      throw new AssistenteError("VALIDACAO", e.message);
    throw e;
  }
}
