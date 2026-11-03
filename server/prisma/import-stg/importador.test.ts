import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  vinculos: [] as Array<Record<string, unknown>>, auditorias: [] as Array<Record<string, unknown>>, fatos: [] as Array<Record<string, unknown>>, associacoes: [] as Array<Record<string, unknown>>,
  candidatos: [] as string[], falhar: "", contexto: "regra-v1", lactacaoAberta: false, erroAuditoria: false, transacoes: [] as unknown[], preparar: vi.fn(), gravar: vi.fn(), antesTransacao: undefined as (() => void) | undefined,
}));
vi.mock("../../src/services/pecuaria/importacao/historico.js", async () => {
  const { z } = await import("zod");
  return {
    fatoHistoricoSchema: z.object({ tipo: z.enum(["PESAGEM", "LEITE", "ECC", "QUALIDADE", "MASTITE", "ASSOCIACAO_PESO_SECAGEM"]), dados: z.record(z.unknown()) }).strict(),
    prepararFatoHistoricoTx: estado.preparar,
    gravarFatoHistoricoTx: estado.gravar,
  };
});
vi.mock("../../src/db.js", () => {
  const db = {
    usuario: { findUnique: async () => ({ id: 1, status: "ATIVO" }) },
    vinculoImportacaoPecuaria: {
      findMany: async () => structuredClone(estado.vinculos),
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const chave = (where.bancoOrigem_tabelaOrigem_chaveOrigem ?? where) as Record<string, unknown>;
        const v = estado.vinculos.find(v => Object.entries(chave).every(([k, valor]) => v[k] === valor)); return v ? structuredClone(v) : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => { const v = { id: `v${estado.vinculos.length + 1}`, ...data }; estado.vinculos.push(v); return v; },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const v = estado.vinculos.find(v => v.id === where.id)!; Object.assign(v, data); return v; },
    },
    auditoriaPecuaria: {
      findMany: async () => estado.auditorias,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (estado.erroAuditoria) throw new Error("auditoria indisponível");
        estado.auditorias.push({ id: `audit${estado.auditorias.length}`, ...data }); return data;
      },
    },
    $executeRaw: async () => 0,
    $transaction: async (executar: (tx: unknown) => Promise<unknown>, opcoes: unknown) => {
      estado.transacoes.push(opcoes);
      estado.antesTransacao?.();
      const copia = JSON.parse(JSON.stringify({ vinculos: estado.vinculos, fatos: estado.fatos, auditorias: estado.auditorias, associacoes: estado.associacoes })) as { vinculos: typeof estado.vinculos; fatos: typeof estado.fatos; auditorias: typeof estado.auditorias; associacoes: typeof estado.associacoes };
      try { return await executar(db); } catch (erro) { Object.assign(estado, copia); throw erro; }
    },
  };
  return { prisma: db };
});
import { cargaStgSchema } from "./contrato.js";
import { importarStg } from "./importador.js";

const destino = { databaseUrl: "postgresql://test:test@127.0.0.1:1/fazendinha_seedatev3", namespace: "dev", bancoConfirmado: "fazendinha_seedatev3" };
const fato = (peso = "300") => ({ tipo: "PESAGEM" as const, dados: { animalId: "00000000-0000-7000-8000-000000000001", data: "2024-01-01", pesoKg: peso } });
const carga = () => ({ bancoOrigem: "STG_EXTRATO", autorId: 1, itens: [{ chave: "PESO:1", dependencias: [] as string[], operacao: "CRIAR" as const, fato: fato() }] });
const preparar = async () => importarStg(carga(), { destino });
const executar = async (manifestoConfirmado: string) => importarStg(carga(), { destino, executar: true, manifestoConfirmado });

beforeEach(() => {
  Object.assign(estado, { vinculos: [], auditorias: [], fatos: [], associacoes: [], candidatos: [], falhar: "", contexto: "regra-v1", lactacaoAberta: false, erroAuditoria: false, transacoes: [], antesTransacao: undefined });
  estado.preparar.mockReset().mockImplementation(async (_tx, f, _autor, opcoes) => {
    if (f.tipo === "ASSOCIACAO_PESO_SECAGEM") {
      const fonte = f.dados.pesagem.chaveOrigem;
      const peso = f.dados.pesagem.id ?? estado.vinculos.find(v => `${v.tabelaOrigem}:${v.chaveOrigem}` === fonte)?.destinoId ?? null;
      const motivo = !peso ? "Pesagem ainda não conciliada" : !f.dados.lactacaoId || estado.lactacaoAberta ? "Encerramento não comprovado" : null;
      const ativo = estado.associacoes.find(a => a.revogado !== true && (a.fato as typeof f).dados.lactacaoId === f.dados.lactacaoId);
      return { entidade: "VinculoPesagemSecagem", existenteId: motivo ? null : ativo?.id ?? null, animalId: "animal-da-pesagem", candidatosDuplicidade: [], ...(motivo ? { pendente: { motivo } } : {}), contexto: { associacaoSecagem: { estado: motivo ? "PENDENTE" : "COMPROVADA", pesagemId: peso, lactacaoId: f.dados.lactacaoId ?? null, motivo, vinculoId: motivo ? null : ativo?.id ?? null } } };
    }
    return { entidade: "PesagemAnimal", existenteId: opcoes?.operacao === "VINCULAR" ? opcoes.destinoId : null, candidatosDuplicidade: estado.candidatos, contexto: { regra: estado.contexto, origem: f.dados.chaveOrigem } };
  });
  estado.gravar.mockReset().mockImplementation(async (_tx, f, _autor, opcoes) => {
    if (estado.falhar === f.dados.chaveOrigem) throw new Error("regra clínica mudou");
    if (f.tipo === "ASSOCIACAO_PESO_SECAGEM") { const id = `associacao${estado.associacoes.length + 1}`; estado.associacoes.push({ id, fato: f }); return { id }; }
    if (opcoes?.operacao === "VINCULAR") return { id: opcoes.destinoId };
    if (opcoes?.operacao === "CORRIGIR") { const atual = estado.fatos.find(v => v.id === opcoes.destinoId)!; Object.assign(atual, { fato: f }); return { id: atual.id }; }
    const id = `fato${estado.fatos.length + 1}`; estado.fatos.push({ id, fato: f }); return { id };
  });
});

describe("contrato técnico STG", () => {
  it("injeta origem canônica e recusa divergência, chaves repetidas ou campos extras", () => {
    const fonte = carga();
    expect(cargaStgSchema.parse(fonte).itens[0].fato.dados).toMatchObject({ bancoOrigem: "STG_EXTRATO", chaveOrigem: "PESO:1" });
    expect(cargaStgSchema.safeParse({ ...fonte, itens: [fonte.itens[0], fonte.itens[0]] }).success).toBe(false);
    expect(cargaStgSchema.safeParse({ ...fonte, ignorarConflito: true }).success).toBe(false);
    expect(cargaStgSchema.safeParse({ ...fonte, itens: [{ ...fonte.itens[0], fato: { ...fato(), dados: { ...fato().dados, bancoOrigem: "OUTRO" } } }] }).success).toBe(false);
  });
  it("correção exige destino, motivo, versão e hash anterior; vínculo exige destino e motivo", () => {
    const fonte = carga();
    expect(cargaStgSchema.safeParse({ ...fonte, itens: [{ ...fonte.itens[0], operacao: "CORRIGIR" }] }).success).toBe(false);
    expect(cargaStgSchema.safeParse({ ...fonte, itens: [{ ...fonte.itens[0], operacao: "VINCULAR" }] }).success).toBe(false);
  });
});

describe("orquestração STG sem banco", () => {
  it("prévia prepara sem escrever e manifesto conserva autor/destino/contexto", async () => {
    const r = await preparar();
    expect(r.conflitos).toEqual([]); expect(r.recibo).toEqual([]);
    expect(r.manifesto.contexto).toMatchObject({ autorId: 1, destino: { host: "127.0.0.1:1", banco: "fazendinha_seedatev3" } });
    expect(JSON.stringify(r.manifesto.contexto)).toContain("regra-v1");
    expect(estado.fatos).toEqual([]); expect(estado.vinculos).toEqual([]); expect(estado.auditorias).toEqual([]); expect(estado.transacoes).toEqual([]);
  });
  it("grava fato, vínculo e auditoria serializáveis e reenvio integral não escreve novamente", async () => {
    const previa = await preparar(); const r = await executar(previa.manifesto.hash);
    expect(r.recibo[0]).toMatchObject({ chave: "PESO:1", estado: "CRIADO", destinoId: "fato1" });
    expect(estado.fatos).toHaveLength(1); expect(estado.vinculos).toHaveLength(1); expect(estado.auditorias).toHaveLength(1);
    expect(estado.transacoes[0]).toMatchObject({ isolationLevel: "Serializable" });
    expect(estado.preparar.mock.calls.length).toBeGreaterThanOrEqual(3);
    const repetido = await executar(previa.manifesto.hash);
    expect(repetido.recibo[0]).toMatchObject({ estado: "REUTILIZADO", destinoId: "fato1" });
    expect(estado.fatos).toHaveLength(1); expect(estado.vinculos).toHaveLength(1); expect(estado.auditorias).toHaveLength(1);
    expect(estado.gravar).toHaveBeenCalledTimes(1);
  });
  it("recusa manifesto arbitrário, mudança de autor, destino ou contexto", async () => {
    const previa = await preparar();
    for (const opcoes of [{ manifestoConfirmado: "a".repeat(64) }, { manifestoConfirmado: previa.manifesto.hash, destino: { ...destino, namespace: "staging" } }]) {
      const r = await importarStg(carga(), { destino, executar: true, ...opcoes }); expect(r.conflitos.length).toBeGreaterThan(0);
    }
    estado.contexto = "regra-v2";
    const r = await executar(previa.manifesto.hash); expect(r.conflitos.length).toBeGreaterThan(0); expect(estado.transacoes).toEqual([]);
  });
  it.each([
    { ...destino, namespace: "prod" },
    { ...destino, databaseUrl: "postgresql://test:test@127.0.0.1:1/outro_banco", bancoConfirmado: "outro_banco" },
    { ...destino, databaseUrl: "postgresql://test:test@stg.neon.tech/fazenda_stg?sslmode=require", namespace: "staging" },
  ])("destino proibido ou STG sem confirmação não começa a execução: %j", async (destinoTeste) => {
    const r = await importarStg(carga(), { destino: destinoTeste, executar: true, manifestoConfirmado: "a".repeat(64) });
    expect(r.conflitos[0]?.chave).toBe("$destino"); expect(estado.preparar).not.toHaveBeenCalled(); expect(estado.transacoes).toEqual([]);
  });
  it("dependência ausente ou cíclica bloqueia o lote na prévia", async () => {
    const fonte = carga(); fonte.itens[0].dependencias = ["PESO:2"]; fonte.itens.push({ ...fonte.itens[0], chave: "PESO:2", dependencias: ["PESO:1"] });
    const r = await importarStg(fonte, { destino }); expect(r.conflitos.some(c => /cíclica/i.test(c.motivo))).toBe(true); expect(estado.transacoes).toEqual([]);
  });
  it("bloqueia todo lote quando candidato não foi revisado", async () => {
    estado.candidatos = ["candidato-1"];
    const r = await preparar(); expect(r.conflitos[0]?.motivo).toMatch(/duplicidade/i); expect(estado.fatos).toEqual([]);
    const fonte = carga(); Object.assign(fonte.itens[0], { duplicidadesRevisadas: ["candidato-1"], motivo: "A fazenda conferiu que são pesagens diferentes" });
    const revisado = await importarStg(fonte, { destino }); expect(revisado.conflitos).toEqual([]);
  });
  it("ordem de candidatos de consulta não altera o manifesto revisado", async () => {
    const fonte = carga(); Object.assign(fonte.itens[0], { duplicidadesRevisadas: ["candidato-a", "candidato-b"], motivo: "A fazenda confirmou que os dois são fatos distintos" });
    estado.candidatos = ["candidato-a", "candidato-b"]; const primeira = await importarStg(fonte, { destino });
    estado.candidatos = ["candidato-b", "candidato-a"]; const segunda = await importarStg(fonte, { destino });
    expect(segunda.manifesto.hash).toBe(primeira.manifesto.hash);
  });
  it("falha reverte fato e vínculo e bloqueia descendentes", async () => {
    const fonte = carga(); fonte.itens.push({ ...fonte.itens[0], chave: "PESO:2", dependencias: ["PESO:1"] });
    const previa = await importarStg(fonte, { destino }); estado.erroAuditoria = true;
    const r = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
    expect(r.recibo.map(i => i.estado)).toEqual(["FALHOU", "BLOQUEADO"]); expect(estado.fatos).toEqual([]); expect(estado.vinculos).toEqual([]);
  });
  it("divergência de hash exige correção explícita e audita atualização do vínculo", async () => {
    const previa = await preparar(); await executar(previa.manifesto.hash);
    const fonte = carga(); fonte.itens[0].fato = fato("310");
    const divergente = await importarStg(fonte, { destino }); expect(divergente.conflitos[0]?.motivo).toMatch(/hash|origem/i);
    Object.assign(fonte.itens[0], { operacao: "CORRIGIR", destinoId: "fato1", motivo: "Correção comprovada no extrato de origem", versaoEsperada: 1, hashOrigemEsperado: estado.vinculos[0].hashOrigem });
    const correcao = await importarStg(fonte, { destino }); expect(correcao.conflitos).toEqual([]);
    const r = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: correcao.manifesto.hash });
    expect(r.recibo[0]).toMatchObject({ estado: "CORRIGIDO", destinoId: "fato1" }); expect(estado.fatos).toHaveLength(1); expect(estado.vinculos).toHaveLength(1); expect(estado.auditorias).toHaveLength(2);
    expect(estado.auditorias[1]).toHaveProperty("antes");
  });
  it("lote parcial exige nova prévia e reenvio integral da nova decisão não acrescenta auditoria", async () => {
    const fonte = carga(); fonte.itens.push({ ...fonte.itens[0], chave: "PESO:2", dependencias: [] });
    const previa = await importarStg(fonte, { destino }); estado.falhar = "PESO:2";
    const parcial = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
    expect(parcial.recibo.map(i => i.estado)).toEqual(["CRIADO", "FALHOU"]);
    estado.falhar = "";
    const semRevisao = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
    expect(semRevisao.conflitos.some(c => /manifesto|parcial/i.test(c.motivo))).toBe(true); expect(estado.fatos).toHaveLength(1);
    const nova = await importarStg(fonte, { destino });
    await importarStg(fonte, { destino, executar: true, manifestoConfirmado: nova.manifesto.hash });
    const auditorias = estado.auditorias.length;
    const repetido = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: nova.manifesto.hash });
    expect(repetido.reenvioIntegral).toBe(true); expect(repetido.manifesto.hash).toBe(nova.manifesto.hash);
    expect(estado.auditorias).toHaveLength(auditorias); expect(estado.fatos).toHaveLength(2);
  });
  it("mudança entre a prévia da execução e a transação bloqueia a gravação", async () => {
    const previa = await preparar(); let leituras = 0;
    const prepararOriginal = estado.preparar.getMockImplementation()!;
    estado.preparar.mockImplementation(async (...args) => { const p = await prepararOriginal(...args); leituras++; return { ...p, contexto: { regra: leituras === 2 ? "regra-alterada" : "regra-v1", origem: "PESO:1" } }; });
    const r = await executar(previa.manifesto.hash);
    expect(r.recibo[0]).toMatchObject({ estado: "FALHOU", motivo: expect.stringMatching(/contexto.*mudou/i) });
    expect(estado.fatos).toEqual([]); expect(estado.vinculos).toEqual([]); expect(estado.auditorias).toEqual([]);
  });
  it("não aceita trocar ID de destino de uma origem conhecida depois da prévia", async () => {
    const inicial = await preparar(); await executar(inicial.manifesto.hash);
    const previa = await preparar();
    estado.antesTransacao = () => { estado.vinculos[0].destinoId = "outro-fato"; };
    const r = await executar(previa.manifesto.hash);
    expect(r.recibo[0]).toMatchObject({ estado: "FALHOU", motivo: expect.stringMatching(/destino.*mudou|destino.*diverg/i) });
    expect(estado.auditorias).toHaveLength(1); expect(estado.gravar).toHaveBeenCalledTimes(1);
  });
  it("vincular cria só proveniência e aparece separado de criação", async () => {
    const fonte = carga(); Object.assign(fonte.itens[0], { operacao: "VINCULAR", destinoId: "existente", motivo: "Equivalência confirmada pela fazenda" });
    const previa = await importarStg(fonte, { destino }); const r = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
    expect(r.recibo[0]).toMatchObject({ estado: "VINCULADO", destinoId: "existente" }); expect(estado.fatos).toEqual([]); expect(estado.vinculos).toHaveLength(1);
  });
});


const associacaoSecagem = (lactacaoId: string | null = "lactacao-comprovada") => ({ chave: "ASSOCIACAO_SECAGEM:1", dependencias: [] as string[], operacao: "CRIAR" as const,
  fato: { tipo: "ASSOCIACAO_PESO_SECAGEM" as const, dados: { pesagem: { chaveOrigem: "PESO:1" }, lactacaoId, propriedadeId: 7, evidenciaEncerramento: "Encerramento conferido na origem" } } });
it("associação por origem captura dependência declarada sem confundir chaves", () => {
  const fonte = { ...carga(), itens: [associacaoSecagem()] };
  expect(cargaStgSchema.parse(fonte).itens[0].dependencias).toEqual(["PESO:1"]);
});
it("peso válido é importado e associação sem prova fica pendente sem ID/vínculo fictício", async () => {
  const fonte = { ...carga(), itens: [...carga().itens, associacaoSecagem(null)] };
  const previa = await importarStg(fonte, { destino }); expect(previa.conflitos).toEqual([]);
  const r = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
  expect(r.recibo.find(i => i.chave === "PESO:1")?.estado).toBe("CRIADO");
  expect(r.recibo.find(i => i.chave === "ASSOCIACAO_SECAGEM:1")).toMatchObject({ estado: "PENDENTE" });
  expect(r.recibo.find(i => i.chave === "ASSOCIACAO_SECAGEM:1")).not.toHaveProperty("destinoId");
  expect(r.pendentes).toBe(1); expect(r.associacoesSecagem[0]).toMatchObject({ estado: "PENDENTE", executada: false });
  expect(estado.fatos).toHaveLength(1); expect(estado.associacoes).toEqual([]); expect(estado.vinculos).toHaveLength(1);
  expect(estado.gravar.mock.calls.every(([, f]) => f.tipo !== "ASSOCIACAO_PESO_SECAGEM")).toBe(true);
});
it("uma nova prévia após conciliar a pesagem resolve associação e reenvio conserva todos os IDs", async () => {
  const fonte = { ...carga(), itens: [...carga().itens, associacaoSecagem()] };
  const primeira = await importarStg(fonte, { destino }); await importarStg(fonte, { destino, executar: true, manifestoConfirmado: primeira.manifesto.hash });
  const segunda = await importarStg(fonte, { destino }); expect(segunda.associacoesSecagem[0].estado).toBe("COMPROVADA");
  const concluido = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: segunda.manifesto.hash });
  expect(concluido.recibo.find(i => i.chave === "ASSOCIACAO_SECAGEM:1")).toMatchObject({ estado: "CRIADO", destinoId: "associacao1" });
  const auditorias = estado.auditorias.length;
  const reenvio = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: segunda.manifesto.hash });
  expect(reenvio.reenvioIntegral).toBe(true); expect(estado.fatos).toHaveLength(1); expect(estado.associacoes).toHaveLength(1); expect(estado.auditorias).toHaveLength(auditorias);
});
it("pendência bloqueia apenas descendentes que exigem a associação e mantém independentes", async () => {
  const pendente = associacaoSecagem(null);
  const fonte = { ...carga(), itens: [pendente, ...carga().itens, { ...carga().itens[0], chave: "PESO:2", dependencias: [pendente.chave] }] };
  const previa = await importarStg(fonte, { destino }); const r = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
  expect(r.recibo.find(i => i.chave === pendente.chave)?.estado).toBe("PENDENTE");
  expect(r.recibo.find(i => i.chave === "PESO:1")?.estado).toBe("CRIADO"); expect(r.recibo.find(i => i.chave === "PESO:2")?.estado).toBe("BLOQUEADO");
});


it("quantidade de pesos de secagem deriva do lote real, sem presumir os cem mencionados", async () => {
  const fonte = carga(); Object.assign(fonte.itens[0].fato.dados, { tipo: "SECAGEM" });
  const previa = await importarStg(fonte, { destino }); expect(previa.pesosSecagem).toMatchObject({ total: 1, aCriar: 1, reutilizaveis: 0 });
  expect(JSON.stringify(previa.manifesto.contexto)).toContain('"resumoSecagens"');
  await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
  const segunda = await importarStg(fonte, { destino }); expect(segunda.pesosSecagem).toMatchObject({ total: 1, aCriar: 0, reutilizaveis: 1 });
});
it("pendência sem peso conciliado não constitui reenvio integral concluído", async () => {
  const fonte = { ...carga(), itens: [associacaoSecagem(null)] };
  const previa = await importarStg(fonte, { destino }); const primeiro = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
  expect(primeiro.reenvioIntegral).toBe(false); expect(primeiro.recibo[0].estado).toBe("PENDENTE"); expect(estado.vinculos).toEqual([]);
  const repetido = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
  expect(repetido.reenvioIntegral).toBe(false); expect(repetido.pendentes).toBe(1); expect(estado.vinculos).toEqual([]); expect(estado.auditorias).toEqual([]);
});


it("reabertura e revogação invalidam prova estática de reenvio completo sem perder o peso", async () => {
  const fonte = { ...carga(), itens: [...carga().itens, associacaoSecagem()] };
  const primeira = await importarStg(fonte, { destino }); await importarStg(fonte, { destino, executar: true, manifestoConfirmado: primeira.manifesto.hash });
  const comprovada = await importarStg(fonte, { destino }); await importarStg(fonte, { destino, executar: true, manifestoConfirmado: comprovada.manifesto.hash });
  estado.lactacaoAberta = true; estado.associacoes[0].revogado = true;
  const auditorias = estado.auditorias.length;
  const replay = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: comprovada.manifesto.hash });
  expect(replay.reenvioIntegral).toBe(false); expect(replay.associacoesSecagem[0]).toMatchObject({ estado: "PENDENTE", executada: false, vinculoId: null });
  expect(replay.recibo.some(i => i.chave === "ASSOCIACAO_SECAGEM:1" && i.estado === "REUTILIZADO")).toBe(false);
  expect(estado.fatos).toHaveLength(1); expect(estado.associacoes).toHaveLength(1); expect(estado.auditorias).toHaveLength(auditorias);
});
it("novo encerramento depois de revogar não remapeia a origem antiga para outra associação", async () => {
  const fonte = { ...carga(), itens: [...carga().itens, associacaoSecagem()] };
  const primeira = await importarStg(fonte, { destino }); await importarStg(fonte, { destino, executar: true, manifestoConfirmado: primeira.manifesto.hash });
  const comprovada = await importarStg(fonte, { destino }); await importarStg(fonte, { destino, executar: true, manifestoConfirmado: comprovada.manifesto.hash });
  estado.associacoes[0].revogado = true;
  const replay = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: comprovada.manifesto.hash });
  expect(replay.reenvioIntegral).toBe(false); expect(replay.associacoesSecagem[0].estado).toBe("CONFLITO");
  const nova = await importarStg(fonte, { destino }); expect(nova.conflitos.some(c => /ativo|revogado|origem/i.test(c.motivo))).toBe(true);
  expect(estado.fatos).toHaveLength(1); expect(estado.associacoes).toHaveLength(1);
});


it("falha da auditoria da associação reverte vínculo e origem, conservando peso anterior", async () => {
  estado.fatos.push({ id: "peso-anterior", fonte: "já conciliado" });
  const pedido = associacaoSecagem(); const fonte = { ...carga(), itens: [{ ...pedido, fato: { ...pedido.fato, dados: { ...pedido.fato.dados, pesagem: { id: "peso-anterior" } } } }] };
  const previa = await importarStg(fonte, { destino }); estado.erroAuditoria = true;
  const r = await importarStg(fonte, { destino, executar: true, manifestoConfirmado: previa.manifesto.hash });
  expect(r.recibo[0].estado).toBe("FALHOU"); expect(r.associacoesSecagem[0]).toMatchObject({ estado: "CONFLITO", executada: false });
  expect(estado.fatos).toHaveLength(1); expect(estado.associacoes).toEqual([]); expect(estado.vinculos).toEqual([]);
});
