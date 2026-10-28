import { AlertaError } from "../../services/alertas/erros.js";
import { prisma } from "../../db.js";
import { decidirProgramacao } from "../../services/pecuaria/sanidade/programacoes/decisoes.js";
import { Hono } from "hono";
import { z } from "zod";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea, temPermissao } from "../../services/auth/papeis.js";
import { resolverEscopoEscrita } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { conflitoTransacaoPecuaria } from "../../services/pecuaria/transacao.js";
import { decidirNecessidade, decisaoNecessidadeSchema } from "../../services/pecuaria/sanidade/alertas/decisoes.js";
import { Prisma } from "@prisma/client";

export const atendimentoAlertasRouter = new Hono().post("/alertas/:id/decisoes", async c => {
  const usuario = getUsuario(c);
  if (!usuario || usuario.id < 1 || !temArea(usuario, "pecuaria") || !temPermissao(usuario, "lancar")) return c.json({ error: "Decidir sobre alertas exige uma pessoa autenticada com permissão para lançar na Pecuária" }, 403);
  try {
    const alertaId = z.string().uuid().parse(c.req.param("id"));
    const body: unknown = await c.req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return c.json({ error: "Informe os dados da decisão", code: "VALIDACAO" }, 422);
    if ("alertaId" in body) return c.json({ error: "O alerta é informado pela URL", code: "VALIDACAO" }, 422);
    const input = decisaoNecessidadeSchema.parse({ ...body, alertaId });
    input.propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
    if (input.acao === "VINCULAR_APLICACAO") input.propriedadeAplicacaoId = await resolverEscopoEscrita(c, input.propriedadeAplicacaoId);
    const programa = await prisma.necessidadeProgramacaoSanitaria.findFirst({ where: { alertaId, regraNecessidadeId: null }, select: { id: true } });
    if (programa) { const n = await decidirProgramacao(input, usuario.id); return c.json({ id: n.id, alertaId: n.alertaId, revisao: n.revisao, situacao: n.situacao }); }
    const n = await decidirNecessidade(input, usuario.id);
    return c.json({ id: n.id, alertaId: n.alertaId, revisao: n.revisao, situacao: n.situacao, dataAtencao: n.dataAtencao, motivo: n.motivo });
  } catch (e) {
    if (e instanceof z.ZodError) return c.json({ error: e.issues[0]?.message, code: "VALIDACAO", campo: e.issues[0]?.path.join(".") }, 422);
    if (e instanceof RebanhoError || e instanceof AlertaError) return c.json({ error: e.message, code: e.code, campo: e.campo }, e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409);
    if (conflitoTransacaoPecuaria(e) || e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return c.json({ error: "O alerta ou a aplicação mudou. Confira antes de confirmar novamente", code: "CONFLITO" }, 409);
    if (e instanceof SyntaxError) return c.json({ error: "JSON inválido", code: "VALIDACAO" }, 422);
    console.error("[pecuaria/atendimento-alertas]", e);
    return c.json({ error: "Erro ao confirmar a decisão" }, 500);
  }
});
