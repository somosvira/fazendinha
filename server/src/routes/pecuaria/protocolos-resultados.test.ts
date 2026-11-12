import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
import { uid } from "../../lib/uid.fixture.js";
const m = vi.hoisted(() => ({
  resultados: vi.fn(),
  vincular: vi.fn(),
  revogar: vi.fn(),
  candidatas: vi.fn(),
  estimar: vi.fn(),
}));
vi.mock(
  "../../services/pecuaria/protocolos/resultados.js",
  async (original) => ({
    ...(await original<
      typeof import("../../services/pecuaria/protocolos/resultados.js")
    >()),
    consultarResultadosProtocolo: m.resultados,
  }),
);
vi.mock(
  "../../services/pecuaria/protocolos/tentativa-participacao.js",
  async (original) => ({
    ...(await original<
      typeof import("../../services/pecuaria/protocolos/tentativa-participacao.js")
    >()),
    vincularTentativaParticipacao: m.vincular,
    revogarTentativaParticipacao: m.revogar,
    listarTentativasCandidatas: m.candidatas,
  }),
);
vi.mock(
  "../../services/pecuaria/custos/estimativa-modelo.js",
  async (original) => ({
    ...(await original<
      typeof import("../../services/pecuaria/custos/estimativa-modelo.js")
    >()),
    estimarModelo: m.estimar,
  }),
);
import { protocolosOperacaoRouter } from "./protocolos-operacao.js";
const id = uid(910),
  tentativaId = uid(911),
  chave = uid(912);
function app({
  sessao = true,
  pecuaria = true,
  lancar = false,
  valores = false,
  idUsuario = 7,
}: Partial<{
  sessao: boolean;
  pecuaria: boolean;
  lancar: boolean;
  valores: boolean;
  idUsuario: number;
}> = {}) {
  const usuario: UsuarioContexto = {
    id: idUsuario,
    nome: "Teste",
    email: "teste@example.test",
    papel: "LEITOR",
    abas: [],
    areas: [
      ...(pecuaria ? ["pecuaria"] : []),
      ...(valores ? ["financeiro"] : []),
    ],
    flags: [...(lancar ? ["lancar"] : []), ...(valores ? ["verValores"] : [])],
    dono: false,
    status: "ATIVO",
  };
  return new Hono<{ Variables: { usuario: UsuarioContexto } }>()
    .use("*", async (c, next) => {
      if (sessao) c.set("usuario", usuario);
      await next();
    })
    .route("/", protocolosOperacaoRouter);
}
const post = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const vinculo = {
  chave,
  tentativaId,
  propriedadeId: 114,
  motivo: "Fato conferido na ficha",
  revisao: "a".repeat(64),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.resultados.mockResolvedValue({ liberado: true, itens: [] });
  m.vincular.mockResolvedValue({ id });
  m.revogar.mockResolvedValue({ id });
  m.candidatas.mockResolvedValue({
    itens: [],
    total: 0,
    pagina: 1,
    porPagina: 10,
  });
  m.estimar.mockResolvedValue({ situacao: "PARCIAL", totalConhecido: "0.00" });
});
it("resultados exige sessão e Pecuária e encaminha contexto/sítio/página ao serviço", async () => {
  expect(
    (
      await app({ sessao: false }).request(
        `/programacoes/${id}/resultados?propriedadeId=114`,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app({ pecuaria: false }).request(
        `/programacoes/${id}/resultados?propriedadeId=114`,
      )
    ).status,
  ).toBe(403);
  expect(m.resultados).not.toHaveBeenCalled();
  expect(
    (
      await app().request(
        `/programacoes/${id}/resultados?propriedadeId=114&pagina=2`,
      )
    ).status,
  ).toBe(200);
  expect(m.resultados).toHaveBeenCalledWith({ programacaoId: id }, 114, {
    pagina: 2,
    porPagina: 10,
  });
  expect(
    (
      await app().request(
        `/participacoes/${id}/resultados?propriedadeId=114&porPagina=11`,
      )
    ).status,
  ).toBe(422);
});
it("vínculo e revogação exigem lançamento, usuário real, sítio coerente e revisão da seleção", async () => {
  expect(
    (
      await app().request(
        `/participacoes/${id}/tentativa-externa`,
        post(vinculo),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app({ lancar: true, idUsuario: 0 }).request(
        `/participacoes/${id}/tentativa-externa`,
        post(vinculo),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app({ lancar: true }).request(
        `/participacoes/${id}/tentativa-externa`,
        post({ ...vinculo, revisao: undefined }),
      )
    ).status,
  ).toBe(422);
  expect(m.vincular).not.toHaveBeenCalled();
  expect(
    (
      await app({ lancar: true }).request(
        `/participacoes/${id}/tentativa-externa?propriedadeId=115`,
        post(vinculo),
      )
    ).status,
  ).toBe(201);
  expect(m.vincular).toHaveBeenCalledWith(id, vinculo, 7);
  expect(
    (
      await app().request(
        `/vinculos-tentativa/${id}/revogacao`,
        post({ chave, propriedadeId: 114, motivo: "Vínculo indevido" }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await app({ lancar: true }).request(
        `/vinculos-tentativa/${id}/revogacao`,
        post({ chave, propriedadeId: 114, motivo: "Vínculo indevido" }),
      )
    ).status,
  ).toBe(200);
  expect(m.revogar).toHaveBeenCalledWith(
    id,
    { chave, propriedadeId: 114, motivo: "Vínculo indevido" },
    7,
  );
});
it("candidatos usam sítio explícito e teto de dez sem revelar preço", async () => {
  expect(
    (await app().request(`/participacoes/${id}/tentativas-candidatas`)).status,
  ).toBe(422);
  expect(
    (
      await app().request(
        `/participacoes/${id}/tentativas-candidatas?propriedadeId=114&porPagina=11`,
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await app().request(
        `/participacoes/${id}/tentativas-candidatas?propriedadeId=114`,
      )
    ).status,
  ).toBe(200);
  expect(m.candidatas).toHaveBeenCalledWith(id, 114, 1);
});
it("estimativa de rascunho protege valores também na resposta e valida sítio sem criar fatos", async () => {
  const i = {
    propriedadeId: 114,
    etapas: [
      { nome: "Aplicação", tipo: "APLICACAO", quantidade: "1", unidade: "ML" },
    ],
  };
  expect(
    (await app({ lancar: true }).request("/modelos/estimativa", post(i)))
      .status,
  ).toBe(403);
  expect(
    (await app({ valores: true }).request("/modelos/estimativa", post(i)))
      .status,
  ).toBe(403);
  expect(m.estimar).not.toHaveBeenCalled();
  const r = await app({ lancar: true, valores: true }).request(
    "/modelos/estimativa",
    post(i),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ totalConhecido: "0.00" });
  expect(m.estimar).toHaveBeenCalledWith({ ...i, referenciasPagina: 1 });
});
