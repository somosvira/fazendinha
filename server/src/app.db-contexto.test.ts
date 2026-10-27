import { afterEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  clientes: [] as Array<{ id: number; desconectar: ReturnType<typeof vi.fn> }>,
}));
vi.mock("./lib/runtime.js", () => ({ isCloudflareWorkers: () => true }));
vi.mock("@prisma/client", async (original) => ({
  ...await original<typeof import("@prisma/client")>(),
  PrismaClient: class {
    readonly id = estado.clientes.length + 1;
    readonly $disconnect = vi.fn(async () => undefined);
    constructor() { estado.clientes.push({ id: this.id, desconectar: this.$disconnect }); }
    readonly $queryRaw = async () => this.id;
    readonly $executeRaw = async () => 0;
    readonly $transaction = async <T>(executar: (tx: this) => Promise<T>) => executar(this);
  },
}));

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/fazendinha_unit";
const { app } = await import("./app.js");
const { prisma } = await import("./db.js");
const { transacaoPecuaria } = await import("./services/pecuaria/transacao.js");

function sinal() {
  let resolver!: () => void;
  const promessa = new Promise<void>(resolve => { resolver = resolve; });
  return { promessa, resolver };
}

const primeiraIniciada = sinal(), segundaIniciada = sinal();
const retomarPrimeira = sinal(), retomarSegunda = sinal();
app.get("/__teste/contexto/primeira", async c => {
  const antes = await prisma.$queryRaw`SELECT 1`;
  primeiraIniciada.resolver();
  await retomarPrimeira.promessa;
  const depois = await transacaoPecuaria(tx => tx.$queryRaw`SELECT 1`);
  return c.json({ antes, depois });
});
app.get("/__teste/contexto/segunda", async c => {
  const antes = await prisma.$queryRaw`SELECT 1`;
  segundaIniciada.resolver();
  await retomarSegunda.promessa;
  const depois = await transacaoPecuaria(tx => tx.$queryRaw`SELECT 1`);
  return c.json({ antes, depois });
});

app.get("/__teste/contexto/erro", async () => {
  await prisma.$queryRaw`SELECT 1`;
  throw new Error("Falha da consulta");
});

app.get("/__teste/contexto/limpeza", async c => {
  await prisma.$queryRaw`SELECT 1`;
  estado.clientes.at(-1)!.desconectar.mockRejectedValueOnce(new Error("detalhe privado"));
  return c.json({ ok: true });
});

app.get("/__teste/contexto/sem-banco", c => c.json({ ok: true }));

afterEach(() => { vi.restoreAllMocks(); });

describe("contexto de banco nas requisições do Worker", () => {
  it("preserva o cliente da consulta e da transação quando outra requisição começa durante um await", async () => {
    const primeira = app.request("/__teste/contexto/primeira");
    await primeiraIniciada.promessa;
    const segunda = app.request("/__teste/contexto/segunda");
    await segundaIniciada.promessa;
    retomarPrimeira.resolver();
    const respostaPrimeira = await primeira;
    retomarSegunda.resolver();
    const respostaSegunda = await segunda;
    const a = await respostaPrimeira.json(), b = await respostaSegunda.json();
    expect(respostaPrimeira.status).toBe(200);
    expect(respostaSegunda.status).toBe(200);
    expect(a.depois).toBe(a.antes);
    expect(b.depois).toBe(b.antes);
    expect(a.antes).not.toBe(b.antes);
    expect(estado.clientes.find(c => c.id === a.antes)?.desconectar).toHaveBeenCalledOnce();
    expect(estado.clientes.find(c => c.id === b.antes)?.desconectar).toHaveBeenCalledOnce();
  });

  it("encerra a conexão mesmo quando a rota falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const antes = estado.clientes.length;

    expect((await app.request("/__teste/contexto/erro")).status).toBe(500);
    expect(estado.clientes).toHaveLength(antes + 1);
    expect(estado.clientes[antes].desconectar).toHaveBeenCalledOnce();
  });

  it("não transforma uma resposta válida em erro se apenas a desconexão falha", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const resposta = await app.request("/__teste/contexto/limpeza");
    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ ok: true });
    expect(aviso).toHaveBeenCalledWith("[db] Falha ao encerrar conexão da requisição");
  });

  it("não abre conexão para uma rota sem banco e recusa consulta fora de requisição", async () => {
    const antes = estado.clientes.length;

    expect((await app.request("/__teste/contexto/sem-banco")).status).toBe(200);
    expect(estado.clientes).toHaveLength(antes);
    expect(() => prisma.$queryRaw`SELECT 1`).toThrow("exige contexto de requisição");
  });
});
