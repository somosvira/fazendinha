// Fila de escritas pendentes: substitui mutation do TanStack por uma lista
// de requisições HTTP puras (path/method/body, sem função nenhuma) — cada
// item basta pra ser reenviado, sem precisar de nenhum registro por tipo.
//
// Ordem garantida por construção: um único loop com `await` sequencial
// (`processarFila`), nunca duas chamadas concorrentes — não depende de
// nenhum mecanismo interno de terceiro pra serializar.
//
// Enquanto a fila está sendo processada, `aguardarFilaLivre()` trava
// qualquer outro fetch do app (ver req.ts) — isso é o que permite
// substituir um id temporário (criado por uma escrita otimista) pelo id
// real em todo o resto da fila antes que outro item que o referencie seja
// enviado.
import { get, set } from "idb-keyval";
import { onlineManager } from "@tanstack/react-query";
import { comPropriedade } from "../../propriedadeScope";

const CHAVE = "rionovo-fila-pendente";

export interface PedidoMutation {
  mutationKey: string;
  path: string;
  method: string;
  body?: unknown;
  /** Id gerado no client pro item otimista, se este pedido cria algo novo. */
  idTemporarioGerado?: string;
}

interface ItemFila extends PedidoMutation {
  filaId: string;
  criadoEm: string;
}

export interface Progresso {
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
async function fetchCru(path: string, method: string, body: unknown): Promise<any> {
  const headers = comPropriedade(body !== undefined ? { "content-type": "application/json" } : {});
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
    throw new Error(msg);
  }
  return json;
}

function substituir(v: unknown, de: string, para: string): unknown {
  if (typeof v === "string") return v === de ? para : v;
  if (Array.isArray(v)) return v.map((x) => substituir(x, de, para));
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, substituir(val, de, para)]));
  }
  return v;
}

function substituirIdNaFila(de: string, para: string) {
  fila = fila.map((item) => ({ ...item, path: item.path.replaceAll(de, para), body: substituir(item.body, de, para) }));
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
      resposta = await fetchCru(item.path, item.method, item.body);
    } catch (err) {
      // rede caiu de novo no meio do replay — deixa o item na fila, tenta
      // de novo na próxima reconexão, sem rejeitar ninguém.
      if (err instanceof TypeError) return;
      pendencias.get(item.filaId)?.reject(err);
      pendencias.delete(item.filaId);
      return; // erro real do servidor — para aqui, não roda os próximos fora de ordem
    }
    if (item.idTemporarioGerado && resposta?.id != null && String(resposta.id) !== item.idTemporarioGerado) {
      substituirIdNaFila(item.idTemporarioGerado, String(resposta.id));
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

export function iniciarFila(): void {
  carregar().then(garantirProcessamento);
}

export async function enfileirarMutation(pedido: PedidoMutation): Promise<any> {
  await carregar();
  const item: ItemFila = { ...pedido, filaId: crypto.randomUUID(), criadoEm: new Date().toISOString() };
  fila = [...fila, item];
  await persistir();
  garantirProcessamento();
  return new Promise((resolve, reject) => pendencias.set(item.filaId, { resolve, reject }));
}
