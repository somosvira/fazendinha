import { afterEach, describe, expect, it, vi } from "vitest";
import { executarComGuardaNavegacao, registrarGuardaNavegacao } from "./navegacaoGuardada";

afterEach(() => { vi.restoreAllMocks(); });

describe("guarda de navegação local", () => {
  it("mantém sítio e tela quando a gravação rejeita a saída", async () => {
    const estado = { sitio: 1, tela: "visita" };
    const cancelar = registrarGuardaNavegacao(async () => false);
    const resultado = executarComGuardaNavegacao(() => { estado.sitio = 2; estado.tela = "estoque"; });
    expect(resultado).toBeInstanceOf(Promise);
    await expect(resultado).resolves.toBe(false);
    expect(estado).toEqual({ sitio: 1, tela: "visita" });
    cancelar();
  });

  it("aguarda a gravação antes de executar a navegação", async () => {
    let concluir!: (ok: boolean) => void;
    const guarda = vi.fn(() => new Promise<boolean>(resolver => { concluir = resolver; }));
    const acao = vi.fn();
    const cancelar = registrarGuardaNavegacao(guarda);
    const resultado = executarComGuardaNavegacao(acao);
    await Promise.resolve();
    expect(acao).not.toHaveBeenCalled();
    concluir(true);
    await expect(resultado).resolves.toBe(true);
    expect(acao).toHaveBeenCalledOnce();
    expect(guarda).toHaveBeenCalledOnce();
    cancelar();
  });

  it("aplica somente o destino mais recente enquanto a mesma gravação aguarda", async () => {
    let concluir!: (ok: boolean) => void;
    const guarda = vi.fn(() => new Promise<boolean>(resolver => { concluir = resolver; }));
    const primeira = vi.fn(), segunda = vi.fn();
    const cancelar = registrarGuardaNavegacao(guarda);
    const resultadoAntigo = executarComGuardaNavegacao(primeira);
    await Promise.resolve();
    const resultadoAtual = executarComGuardaNavegacao(segunda);
    concluir(true);
    await expect(resultadoAntigo).resolves.toBe(true);
    await expect(resultadoAtual).resolves.toBe(true);
    expect(primeira).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledOnce();
    cancelar();
  });

  it("remove a guarda quando a tela proprietária desmonta durante a espera", async () => {
    let concluir!: (ok: boolean) => void;
    const guarda = vi.fn(() => new Promise<boolean>(resolver => { concluir = resolver; }));
    const acao = vi.fn();
    const cancelar = registrarGuardaNavegacao(guarda);
    const resultado = executarComGuardaNavegacao(acao);
    await Promise.resolve();
    cancelar();
    concluir(true);
    await expect(resultado).resolves.toBe(false);
    expect(acao).not.toHaveBeenCalled();
    const semGuarda = vi.fn();
    expect(executarComGuardaNavegacao(semGuarda)).toBeUndefined();
    expect(semGuarda).toHaveBeenCalledOnce();
  });
});

it("consulta todas as guardas de formulários e preserva a restante ao desmontar uma", async () => {
  const primeira = vi.fn().mockResolvedValue(true);
  const segunda = vi.fn().mockResolvedValue(false);
  const cancelarPrimeira = registrarGuardaNavegacao(primeira);
  const cancelarSegunda = registrarGuardaNavegacao(segunda);
  const navegar = vi.fn();
  await expect(executarComGuardaNavegacao(navegar)).resolves.toBe(false);
  expect(primeira).toHaveBeenCalledOnce(); expect(segunda).toHaveBeenCalledOnce();
  expect(navegar).not.toHaveBeenCalled();
  cancelarPrimeira();
  segunda.mockResolvedValue(true);
  await expect(executarComGuardaNavegacao(navegar)).resolves.toBe(true);
  expect(navegar).toHaveBeenCalledOnce();
  cancelarSegunda();
});

it("entrega a intenção de troca de sítio às guardas sem liberar navegação comum", async () => {
  const guarda = vi.fn(async (intencao: "navegacao" | "troca-sitio") => intencao === "troca-sitio");
  const remover = registrarGuardaNavegacao(guarda);
  const trocar = vi.fn(), sair = vi.fn();
  try {
    await executarComGuardaNavegacao(trocar, "troca-sitio");
    await executarComGuardaNavegacao(sair);
    expect(trocar).toHaveBeenCalledOnce();
    expect(sair).not.toHaveBeenCalled();
    expect(guarda).toHaveBeenNthCalledWith(1, "troca-sitio");
    expect(guarda).toHaveBeenNthCalledWith(2, "navegacao");
  } finally { remover(); }
});

it("não reaproveita autorização de troca de sítio para saída concorrente", async () => {
  let resolverTroca!: (valor: boolean) => void;
  const guarda = vi.fn((intencao: "navegacao" | "troca-sitio") => intencao === "troca-sitio" ? new Promise<boolean>(resolve => { resolverTroca = resolve; }) : Promise.resolve(false));
  const remover = registrarGuardaNavegacao(guarda);
  const trocar = vi.fn(), sair = vi.fn();
  try {
    const troca = executarComGuardaNavegacao(trocar, "troca-sitio");
    const saida = executarComGuardaNavegacao(sair);
    resolverTroca(true);
    await Promise.all([troca, saida]);
    expect(guarda).toHaveBeenCalledTimes(2);
    expect(sair).not.toHaveBeenCalled();
  } finally { remover(); }
});

it("reusa a confirmação da saída após uma troca concorrente e executa apenas a intenção mais recente", async () => {
  let concluir!: (ok: boolean) => void;
  const guarda = vi.fn((intencao: "navegacao" | "troca-sitio") =>
    intencao === "troca-sitio" ? Promise.resolve(true) : new Promise<boolean>(ok => { concluir = ok; }));
  const remover = registrarGuardaNavegacao(guarda);
  const primeira = vi.fn(), trocar = vi.fn(), ultima = vi.fn(), sincronizar = vi.fn();
  try {
    const resultados = [
      executarComGuardaNavegacao(primeira),
      executarComGuardaNavegacao(trocar, "troca-sitio"),
      executarComGuardaNavegacao(ultima),
      executarComGuardaNavegacao(sincronizar),
    ];
    concluir(true);
    await expect(Promise.all(resultados)).resolves.toEqual([true, true, true, true]);
    expect(guarda).toHaveBeenCalledTimes(2);
    expect(primeira).not.toHaveBeenCalled();
    expect(trocar).not.toHaveBeenCalled();
    expect(ultima).toHaveBeenCalledOnce();
    expect(sincronizar).toHaveBeenCalledOnce();
  } finally { remover(); }
});
