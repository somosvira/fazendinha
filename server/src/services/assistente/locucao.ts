import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../env.js";
import { AssistenteError, type ContextoAssistente } from "./tipos.js";
const permissao = (ctx: ContextoAssistente) =>
  JSON.stringify([
    ctx.usuario.dono,
    [...ctx.usuario.areas].sort(),
    [...ctx.usuario.flags].sort(),
    [...ctx.usuario.abas].sort(),
  ]);
export function emitirLocucao(
  texto: string,
  ctx: ContextoAssistente,
): string | undefined {
  if (!env.JWT_SECRET || texto.length > 4000 || !texto.trim()) return;
  const corpo = Buffer.from(
    JSON.stringify({
      texto,
      usuarioId: ctx.usuario.id,
      sitio: ctx.propriedadeId,
      permissao: permissao(ctx),
      expira: Date.now() + 900_000,
    }),
  ).toString("base64url");
  return `${corpo}.${createHmac("sha256", env.JWT_SECRET).update(corpo).digest("base64url")}`;
}
export function lerLocucao(token: string, ctx: ContextoAssistente): string {
  try {
    const [corpo, assinatura, extra] = token.split(".");
    const esperado = createHmac("sha256", env.JWT_SECRET)
      .update(corpo)
      .digest();
    const recebido = Buffer.from(assinatura, "base64url");
    if (
      extra ||
      esperado.length !== recebido.length ||
      !timingSafeEqual(esperado, recebido)
    )
      throw new Error();
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString());
    if (
      dados.usuarioId !== ctx.usuario.id ||
      dados.sitio !== ctx.propriedadeId ||
      dados.permissao !== permissao(ctx) ||
      dados.expira < Date.now()
    )
      throw new Error();
    return dados.texto;
  } catch {
    throw new AssistenteError(
      "VALIDACAO",
      "Esta resposta não pode mais ser ouvida. Faça a consulta novamente.",
    );
  }
}
