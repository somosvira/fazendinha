import { afterEach, describe, expect, it, vi } from "vitest";

const { armazenamento, rede } = vi.hoisted(() => ({
  armazenamento: new Map<string, unknown>(),
  rede: { online: true },
}));

vi.mock("idb-keyval", () => {
  return {
    get: vi.fn((k: string) => Promise.resolve(armazenamento.get(k))),
    set: vi.fn((k: string, v: unknown) => {
      armazenamento.set(k, v);
      return Promise.resolve();
    }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  onlineManager: { isOnline: () => rede.online, subscribe: () => () => {} },
}));

let propriedadeAtiva: number | null = null;
vi.mock("../../propriedadeScope", () => ({
  comPropriedadeExplicita: (id: number | null, h: Record<string, string> = {}) =>
    id != null ? { ...h, "X-Propriedade-Id": String(id) } : h,
  getPropriedadeAtiva: () => propriedadeAtiva,
}));

function resposta(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  armazenamento.clear();
  rede.online = true;
  propriedadeAtiva = null;
});

describe("fila", () => {
  it("escrita que referencia um registro criado offline segue com o id gerado no cliente", async () => {
    vi.resetModules();
    const { enfileirarMutation } = await import("./fila");

    const id = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => resposta({ id }))
      .mockImplementationOnce(() => resposta({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const criar = enfileirarMutation({ mutationKey: "criar", path: "/registros", method: "POST", body: { id, nome: "X" } });
    const editar = enfileirarMutation({ mutationKey: "editar", path: `/registros/${id}`, method: "PATCH", body: { nome: "Y" } });
    await Promise.all([criar, editar]);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/registros", expect.objectContaining({ body: JSON.stringify({ id, nome: "X" }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/registros/${id}`, expect.objectContaining({ method: "PATCH" }));
  });

  it("processa a fila em sequência — a segunda escrita só começa depois que a primeira responde", async () => {
    vi.resetModules();
    const { enfileirarMutation } = await import("./fila");

    const ordem: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      ordem.push(`start:${url}`);
      return new Promise((resolve) => {
        setTimeout(() => {
          ordem.push(`end:${url}`);
          resolve(new Response(JSON.stringify({ id: "1" }), { status: 200 }));
        }, 20);
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST" }),
      enfileirarMutation({ mutationKey: "b", path: "/b", method: "POST" }),
    ]);

    expect(ordem).toEqual(["start:/api/a", "end:/api/a", "start:/api/b", "end:/api/b"]);
  });

  it("erro de item (não-401) tira só ele da fila, vai pro registro de erros, e o resto segue", async () => {
    vi.resetModules();
    const { enfileirarMutation } = await import("./fila");
    const { get: getMock } = await import("idb-keyval");

    const fetchMock = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ error: "Data inválida" }), { status: 400 })))
      .mockImplementationOnce(() => resposta({ id: "2" }));
    vi.stubGlobal("fetch", fetchMock);

    const item1 = enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST", body: { x: 1 } });
    const item2 = enfileirarMutation({ mutationKey: "b", path: "/b", method: "POST", body: { x: 2 } });

    await expect(item1).rejects.toThrow("Data inválida");
    await expect(item2).resolves.toEqual({ id: "2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const erros = await (getMock as any)("rionovo-fila-erros");
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatchObject({ path: "/a", erro: "Data inválida" });
  });

  it("401 para a fila inteira — item seguinte nunca é tentado", async () => {
    vi.resetModules();
    const { enfileirarMutation } = await import("./fila");

    const fetchMock = vi.fn().mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ error: "não autenticado" }), { status: 401 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const item1 = enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST" });
    enfileirarMutation({ mutationKey: "b", path: "/b", method: "POST" }); // fica pendente pra sempre — não trava o teste

    await expect(item1).rejects.toThrow("não autenticado");
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("depois de um 401, garantirProcessamento (novo login) reenvia a fila do ponto em que parou", async () => {
    vi.resetModules();
    const { set } = await import("idb-keyval");
    await set("rionovo-fila-pendente", []); // o teste anterior deixa a fila parada no 401
    const { enfileirarMutation, garantirProcessamento } = await import("./fila");

    const fetchMock = vi.fn()
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify({ error: "não autenticado" }), { status: 401 })),
      )
      .mockImplementation(() => resposta({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const item1 = enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST" });
    const item2 = enfileirarMutation({ mutationKey: "b", path: "/b", method: "POST" });
    await expect(item1).rejects.toThrow("não autenticado");
    await new Promise((r) => setTimeout(r, 10));

    garantirProcessamento();
    await item2;

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/a", "/api/a", "/api/b"]);
  });

  it("grava o sítio ativo no item ao enfileirar, fixo mesmo se o sítio mudar depois", async () => {
    vi.resetModules();
    const { set: setMock } = await import("idb-keyval");
    const { enfileirarMutation } = await import("./fila");

    (setMock as any).mockClear();
    propriedadeAtiva = 1;
    const fetchMock = vi.fn(() => new Promise<Response>(() => {})); // nunca resolve — item fica na fila
    vi.stubGlobal("fetch", fetchMock);

    enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST" }); // não espera — fica pendente
    await new Promise((r) => setTimeout(r, 10)); // dá tempo do enfileiramento terminar

    propriedadeAtiva = 2; // troca de sítio com o item já na fila e o envio já em voo

    const chamadaComItem = (setMock as any).mock.calls.find(([, v]: [string, any[]]) =>
      Array.isArray(v) && v.some((item) => item.path === "/a"));
    expect(chamadaComItem?.[1].find((item: any) => item.path === "/a")).toMatchObject({ propriedadeId: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/a", expect.objectContaining({
      headers: expect.objectContaining({ "X-Propriedade-Id": "1" }),
    }));
  });

  it("processamento passa por navigator.locks — só uma execução por vez, mesmo sobrepondo chamadas", async () => {
    vi.resetModules();
    let concorrentes = 0;
    let maxConcorrentes = 0;
    const requestMock = vi.fn(async (nome: string, cb: () => Promise<unknown>) => {
      if (nome !== "rionovo-fila-processamento") return cb();
      concorrentes++;
      maxConcorrentes = Math.max(maxConcorrentes, concorrentes);
      try {
        return await cb();
      } finally {
        concorrentes--;
      }
    });
    vi.stubGlobal("navigator", { locks: { request: requestMock } });

    const { enfileirarMutation, garantirProcessamento } = await import("./fila");
    const fetchMock = vi.fn(() => resposta({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const pedido = enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST" });
    garantirProcessamento(); // chamada sobreposta — `processando` já barra, mas prova que a trava é usada
    await pedido;

    expect(requestMock).toHaveBeenCalledWith("rionovo-fila-processamento", expect.any(Function));
    expect(maxConcorrentes).toBe(1);
  });

  it("duas abas enfileirando quase juntas mantêm os dois itens no IndexedDB", async () => {
    const caudas = new Map<string, Promise<unknown>>();
    vi.stubGlobal("navigator", {
      locks: {
        request: (nome: string, cb: () => Promise<unknown>) => {
          const resultado = (caudas.get(nome) ?? Promise.resolve()).then(cb);
          caudas.set(nome, resultado.catch(() => {}));
          return resultado;
        },
      },
    });
    rede.online = false;
    vi.resetModules();
    const abaA = await import("./fila");
    vi.resetModules();
    const abaB = await import("./fila");

    void abaA.enfileirarMutation({ mutationKey: "a", path: "/a", method: "POST" });
    void abaB.enfileirarMutation({ mutationKey: "b", path: "/b", method: "POST" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const gravada = armazenamento.get("rionovo-fila-pendente") as { path: string }[];
    expect(gravada.map((item) => item.path).sort()).toEqual(["/a", "/b"]);
  });
});
