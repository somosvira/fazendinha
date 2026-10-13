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
