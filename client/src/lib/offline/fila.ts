// Fila de escritas pendentes: substitui mutation do TanStack por uma lista
// de requisições HTTP puras (path/method/body, sem função nenhuma) — cada
// item basta pra ser reenviado, sem precisar de nenhum registro por tipo.
//
// Ordem garantida por construção: um único loop com `await` sequencial
// (`processarFila`), nunca duas chamadas concorrentes — não depende de
// nenhum mecanismo interno de terceiro pra serializar.
//
// Enquanto a fila está sendo processada, `aguardarFilaLivre()` trava
// qualquer outro fetch do app (ver req.ts) — uma leitura nunca chega ao
// servidor antes das escritas que vieram antes dela.
import { get, set } from "idb-keyval";
import { onlineManager } from "@tanstack/react-query";
import { comPropriedadeExplicita, getPropriedadeAtiva } from "../../propriedadeScope";

const CHAVE = "rionovo-fila-pendente";
const CHAVE_ERROS = "rionovo-fila-erros";

interface PedidoMutation {
  mutationKey: string;
  path: string;
  method: string;
  body?: unknown;
}

interface ItemFila extends PedidoMutation {
  filaId: string;
  criadoEm: string;
  /** Sítio ativo no momento do enfileiramento — trocar de sítio antes da
   *  reconexão não deve mudar pra onde o item já enfileirado é enviado. */
  propriedadeId: number | null;
}

interface ItemErro extends ItemFila {
  erro: string;
  falhouEm: string;
}

// Erro HTTP de verdade (resposta não-2xx) — carrega o status pra
// `processarFila` distinguir 401 (sessão inválida, para a fila inteira) de
// erro de item (validação/regra de negócio, só tira esse item da fila).
class ErroHttp extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface Progresso {
  atual: number;
  total: number;
}

let fila: ItemFila[] = [];
let carregandoPromise: Promise<void> | null = null;
let carregada = false;
let processando = false;
let liberarGate: (() => void) | undefined;
let gate: Promise<void> | null = null;
let progresso: Progresso | null = null;

const ouvintes = new Set<() => void>();
const pendencias = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function notificar() {
  for (const cb of ouvintes) cb();
}

export function inscrever(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

export function obterFila(): PedidoMutation[] {
  return fila;
}

export function filaTravada(): boolean {
  return gate !== null;
}

export function aguardarFilaLivre(): Promise<void> {
  return gate ?? Promise.resolve();
}

export function obterProgresso(): Progresso | null {
  return progresso;
}

function travar() {
  if (gate) return;
  gate = new Promise((resolve) => { liberarGate = resolve; });
  notificar();
}

function destravar() {
  gate = null;
  liberarGate?.();
  notificar();
}

function carregar(): Promise<void> {
  if (carregada) return Promise.resolve();
  if (!carregandoPromise) {
    carregandoPromise = get<ItemFila[]>(CHAVE).then((v) => {
      fila = v ?? [];
      carregada = true;
      notificar();
    });
  }
  return carregandoPromise;
}

async function persistir(): Promise<void> {
  await set(CHAVE, fila);
  notificar();
}

// Fetch cru, sem passar por `aguardarFilaLivre()` (é quem detém o gate).
async function fetchCru(path: string, method: string, body: unknown, propriedadeId: number | null): Promise<any> {
  const headers = comPropriedadeExplicita(propriedadeId, body !== undefined ? { "content-type": "application/json" } : {});
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      typeof json?.error === "string" ? json.error
      : typeof json?.erro === "string" ? json.erro
      : json?.error?.issues?.length ? json.error.issues.map((i: any) => i.message).join("; ")
      : `HTTP ${res.status}`;
    throw new ErroHttp(msg, res.status);
  }
  return json;
}

async function moverParaErros(item: ItemFila, mensagemErro: string): Promise<void> {
  const erros = (await get<ItemErro[]>(CHAVE_ERROS)) ?? [];
  await set(CHAVE_ERROS, [...erros, { ...item, erro: mensagemErro, falhouEm: new Date().toISOString() }]);
}

async function processarFila(): Promise<void> {
  await carregar();
  for (let atual = 1; fila.length > 0; atual++) {
    // `total` recalculado a cada volta (não fixado no início) — cobre o
    // raro caso de algo entrar na fila no meio do replay.
    progresso = { atual, total: atual - 1 + fila.length };
    notificar();
    const item = fila[0];
    let resposta: any;
    try {
      resposta = await fetchCru(item.path, item.method, item.body, item.propriedadeId);
    } catch (err) {
      // rede caiu de novo no meio do replay — deixa o item na fila, tenta
      // de novo na próxima reconexão, sem rejeitar ninguém.
      if (err instanceof TypeError) return;
      pendencias.get(item.filaId)?.reject(err);
      pendencias.delete(item.filaId);
      // 401 é da sessão inteira, não do item — todo item atrás tomaria o
      // mesmo erro. Para tudo aqui; `entrar()` em App.tsx retoma após relogar.
      if (err instanceof ErroHttp && err.status === 401) return;
      // Erro de item (validação/regra de negócio) não contamina os outros —
      // tira só ele da fila, pro registro auditável, e segue com o resto.
      await moverParaErros(item, err instanceof Error ? err.message : String(err));
      fila = fila.slice(1);
      await persistir();
      continue;
    }
    fila = fila.slice(1);
    await persistir();
    pendencias.get(item.filaId)?.resolve(resposta);
    pendencias.delete(item.filaId);
  }
}

export function garantirProcessamento(): void {
  if (processando || !onlineManager.isOnline()) return;
  processando = true;
  travar();
  carregar()
    .then(() => processarFila())
    .finally(() => {
      processando = false;
      progresso = null;
      destravar();
    });
}

// Chamar uma vez no boot. `garantirProcessamento()` trava o gate SÍNCRONO
// (antes de qualquer await) quando há rede — por isso vai primeiro, não
// dentro de um `.then()` (isso reabriria a corrida que o gate existe pra
// fechar: um fetch de outra parte do app rodando antes da fila decidir se
// precisa travar). `carregar()` roda à parte porque precisa acontecer
// mesmo offline (só pra `pendentes` aparecer certo na UI), caso em que
// `garantirProcessamento()` sozinho não chega a chamá-lo.
export function iniciarFila(): void {
  garantirProcessamento();
  carregar();
}

export async function enfileirarMutation(pedido: PedidoMutation): Promise<any> {
  await carregar();
  const item: ItemFila = { ...pedido, filaId: crypto.randomUUID(), criadoEm: new Date().toISOString(), propriedadeId: getPropriedadeAtiva() };
  fila = [...fila, item];
  await persistir();
  garantirProcessamento();
  return new Promise((resolve, reject) => pendencias.set(item.filaId, { resolve, reject }));
}
