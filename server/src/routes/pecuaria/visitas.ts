import * as planner from "../../services/pecuaria/reproducao/planner.js";
import * as selecoes from "../../services/pecuaria/reproducao/selecoes.js";
import { consultaPlannerSchema, previaSelecaoLivreSchema, previaGrupoPlannerSchema, incluirGrupoPlannerSchema } from "../../services/pecuaria/reproducao/planner.schemas.js";
import { Hono } from "hono";
import { z } from "zod";
import {
  resolverEscopoEscrita,
  resolverEscopoLeitura,
} from "../../services/propriedade.js";
import * as s from "../../services/pecuaria/reproducao/schemas.js";
import * as visitas from "../../services/pecuaria/reproducao/visitas.js";
import {
  validarV4,
  falhaV4,
  apresentarV4,
  usuarioV4,
  protegerCustosV4,
} from "./reproducao.js";
const envelope = z.object({ propriedadeId: s.sitio }).strict();
export const visitasRouter = new Hono()
  .use("*", protegerCustosV4)
  .get("/", async (c) => {
    try {
      return c.json(
        await visitas.listarVisitas(await resolverEscopoLeitura(c)),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .get("/sugestoes", async (c) => {
    try {
      const data = s.data.parse(c.req.query("data"));
      const { data: _data, propriedadeId: _sitio, ...filtros } = c.req.query();
      const criterios = s.criteriosVisitaSchema.parse(filtros);
      return c.json(
        apresentarV4(
          c,
          await visitas.sugestoesVisita(await resolverEscopoLeitura(c), data, criterios),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .get("/selecoes", async c => {
    try { const propriedadeId = s.sitio.parse(await resolverEscopoLeitura(c));
      return c.json(await selecoes.listarSelecoes(propriedadeId, ["1", "true"].includes(c.req.query("incluirInativas") ?? "")));
    } catch (e) { return falhaV4(c,e); }
  })
  .get("/selecoes/opcoes", async c => {
    try { return c.json(await selecoes.opcoesSelecao(s.sitio.parse(await resolverEscopoLeitura(c)), s.data.parse(c.req.query("data")))); }
    catch (e) { return falhaV4(c, e); }
  })
  .post("/selecoes", validarV4(selecoes.criarSelecaoSchema), async c => {
    try { const b=c.req.valid("json"); return c.json(await selecoes.criarSelecao({ ...b,
      propriedadeId: await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c)),201);
    } catch(e) { return falhaV4(c,e); }
  })
  .put("/selecoes/:id", validarV4(selecoes.atualizarSelecaoSchema), async c => {
    try { const b=c.req.valid("json"); return c.json(await selecoes.atualizarSelecao(s.uuid.parse(c.req.param("id")),{ ...b,
      propriedadeId: await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c)));
    } catch(e) { return falhaV4(c,e); }
  })
  .get("/agenda", async c => {
    try { const b = consultaPlannerSchema.parse({ ...c.req.query(), propriedadeId: await resolverEscopoLeitura(c) });
      return c.json(apresentarV4(c, await planner.consultarAgenda(b)));
    } catch (e) { return falhaV4(c, e); }
  })
  .post("/selecoes/previa", validarV4(previaSelecaoLivreSchema), async c => {
    try { const b = c.req.valid("json"); const propriedadeId = s.sitio.parse(await resolverEscopoLeitura(c));
      if (propriedadeId !== b.propriedadeId) throw new z.ZodError([{ code: "custom", path: ["propriedadeId"], message: "Sítio da prévia difere do escopo ativo" }]);
      return c.json(apresentarV4(c, await planner.previaGrupoPlanner(b)));
    } catch (e) { return falhaV4(c, e); }
  })
  .get("/planner", async c => {
    try { const b=consultaPlannerSchema.parse({ ...c.req.query(), propriedadeId: await resolverEscopoLeitura(c) });
      return c.json(apresentarV4(c,await planner.consultarPlanner(b)));
    } catch(e) { return falhaV4(c,e); }
  })
  .get("/planner/previa", async c => {
    try {
      const consulta = c.req.query();
      let grupo: unknown;
      try { grupo = JSON.parse(consulta.grupo ?? "null"); }
      catch { throw new z.ZodError([{ code: "custom", path: ["grupo"], message: "Grupo inválido" }]); }
      const b = previaGrupoPlannerSchema.parse({ ...consulta, grupo, propriedadeId: await resolverEscopoLeitura(c) });
      return c.json(apresentarV4(c, await planner.previaGrupoPlanner(b)));
    } catch (e) { return falhaV4(c, e); }
  })
  .post("/planner/previa", validarV4(previaGrupoPlannerSchema), async c => {
    try { const b=c.req.valid("json"); return c.json(apresentarV4(c,await planner.previaGrupoPlanner({ ...b,
      propriedadeId: await resolverEscopoEscrita(c,b.propriedadeId) })));
    } catch(e) { return falhaV4(c,e); }
  })
  .post("/:id/grupos", validarV4(incluirGrupoPlannerSchema), async c => {
    try { const b=c.req.valid("json"); return c.json(apresentarV4(c,await planner.incluirGrupoPlanner(s.uuid.parse(c.req.param("id")),{ ...b,
      propriedadeId: await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c))),201);
    } catch(e) { return falhaV4(c,e); }
  })
  .get("/:id", async (c) => {
    try {
      return c.json(
        apresentarV4(
          c,
          await visitas.detalheVisita(
            c.req.param("id"),
            await resolverEscopoLeitura(c),
          ),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/", validarV4(s.visitaSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await visitas.criarVisita(
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/:id/atividades", validarV4(s.atividadeSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await visitas.adicionarAtividade(
          c.req.param("id"),
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .put(
    "/:id/participantes/:participanteId/rascunho",
    validarV4(
      z
        .object({ propriedadeId: s.sitio, rascunho: z.record(z.unknown()), versaoRascunho: z.number().int().nonnegative() })
        .strict(),
    ),
    async (c) => {
      try {
        const b = c.req.valid("json");
        return c.json(
          apresentarV4(
            c,
            await visitas.salvarRascunho(
              c.req.param("id"),
              c.req.param("participanteId"),
              await resolverEscopoEscrita(c, b.propriedadeId),
              b.rascunho,
              usuarioV4(c),
              b.versaoRascunho,
            ),
          ),
        );
      } catch (e) {
        return falhaV4(c, e);
      }
    },
  )
  .post(
    "/:id/atividades/:atividadeId/confirmacao",
    validarV4(s.confirmacaoVisitaSchema),
    async (c) => {
      try {
        const b = c.req.valid("json");
        return c.json(
          apresentarV4(
            c,
            await visitas.confirmarAtividade(
              c.req.param("id"),
              c.req.param("atividadeId"),
              {
                ...b,
                propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
              },
              usuarioV4(c),
            ),
          ),
        );
      } catch (e) {
        return falhaV4(c, e);
      }
    },
  )
  .post("/:id/impressoes", validarV4(envelope), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        apresentarV4(
          c,
          await visitas.imprimirVisita(
            c.req.param("id"),
            await resolverEscopoEscrita(c, b.propriedadeId),
            usuarioV4(c),
          ),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/:id/encerramento", validarV4(envelope), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await visitas.encerrarVisita(
          c.req.param("id"),
          await resolverEscopoEscrita(c, b.propriedadeId),
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  });
visitasRouter.get("/:id/atividades/:atividadeId/previa", async (c) => {
  try {
    return c.json(
      await visitas.previaAtividade(
        c.req.param("id"),
        c.req.param("atividadeId"),
        await resolverEscopoEscrita(c, Number(c.req.query("propriedadeId"))),
      ),
    );
  } catch (e) {
    return falhaV4(c, e);
  }
});

visitasRouter.post("/:id/participantes/:participanteId/regularizacao",validarV4(s.regularizacaoSchema),async c=>{
  try{const b=c.req.valid("json");return c.json(apresentarV4(c,await visitas.regularizarParticipanteVisita(c.req.param("id"),c.req.param("participanteId"),{...b,propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId)},usuarioV4(c))));}catch(e){return falhaV4(c,e);}
});

visitasRouter.get("/:id/participantes/:participanteId/substitutos", async c => {
  try { return c.json(await visitas.substitutosParticipanteVisita(s.uuid.parse(c.req.param("id")), s.uuid.parse(c.req.param("participanteId")), await resolverEscopoEscrita(c, Number(c.req.query("propriedadeId")) || undefined))); }
  catch (e) { return falhaV4(c, e); }
});

visitasRouter.get("/:id/participantes/:participanteId/tarefa", async c => {
  try {
    return c.json(apresentarV4(c, await visitas.tarefaParticipanteVisita(
      s.uuid.parse(c.req.param("id")), s.uuid.parse(c.req.param("participanteId")),
      s.sitio.parse(await resolverEscopoLeitura(c)),
    )));
  } catch (e) { return falhaV4(c, e); }
});
