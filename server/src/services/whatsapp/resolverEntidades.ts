// A Claude Vision devolve nomes em texto livre (ex.: "Ração", "Atividade Leiteira",
// "Cooperativa Boa Vista"). O Prisma quer IDs. Resolvemos em 3 níveis: match exato
// normalizado → contains normalizado → fallback (ou upsert no caso do fornecedor).
//
// Normalização: NFD para tirar acentos + lower + trim. Suficiente pra cobrir
// "Café" vs "cafe", "Atividade Leiteira" vs "atividade leiteira", etc.

import { prisma } from "../../db.js";

const FALLBACK_CATEGORIA_NOME = "(Sem categoria)";
const FALLBACK_CENTRO_NOME = "Atividade Leiteira";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export async function resolverCategoriaId(nomeSugerido: string | null): Promise<{
  id: number;
  matched: boolean;
}> {
  const candidatas = await prisma.categoria.findMany({ select: { id: true, nome: true } });

  if (nomeSugerido && nomeSugerido.trim()) {
    const alvo = normalizar(nomeSugerido);
    const exato = candidatas.find((c) => normalizar(c.nome) === alvo);
    if (exato) return { id: exato.id, matched: true };
    const contains = candidatas.find(
      (c) => normalizar(c.nome).includes(alvo) || alvo.includes(normalizar(c.nome)),
    );
    if (contains) return { id: contains.id, matched: true };
  }

  const fallback = candidatas.find((c) => c.nome === FALLBACK_CATEGORIA_NOME);
  if (!fallback) {
    throw new Error(
      `Categoria de fallback "${FALLBACK_CATEGORIA_NOME}" não existe no banco. Seedar antes de habilitar o bot WhatsApp.`,
    );
  }
  return { id: fallback.id, matched: false };
}

export async function resolverCentroCustoId(nomeSugerido: string | null): Promise<{
  id: number;
  matched: boolean;
}> {
  const candidatos = await prisma.centroCusto.findMany({ select: { id: true, nome: true } });

  if (nomeSugerido && nomeSugerido.trim()) {
    const alvo = normalizar(nomeSugerido);
    const exato = candidatos.find((c) => normalizar(c.nome) === alvo);
    if (exato) return { id: exato.id, matched: true };
    const contains = candidatos.find(
      (c) => normalizar(c.nome).includes(alvo) || alvo.includes(normalizar(c.nome)),
    );
    if (contains) return { id: contains.id, matched: true };
  }

  const fallback = candidatos.find((c) => c.nome === FALLBACK_CENTRO_NOME) ?? candidatos[0];
  if (!fallback) {
    throw new Error("Nenhum CentroCusto cadastrado — impossível resolver.");
  }
  return { id: fallback.id, matched: false };
}

// Fornecedor: nome é @unique. Cria se não existe (upsert) — tabela pequena, a
// fazenda controla o universo. Deduplicação tipográfica fica pro admin.
export async function resolverFornecedorId(nome: string, documento?: string | null): Promise<number> {
  const limpo = nome.trim();
  if (!limpo) throw new Error("nome de fornecedor vazio");

  // Tentar match exato normalizado primeiro para evitar criar duplicata com
  // capitalização diferente.
  const todos = await prisma.clienteFornecedor.findMany({ select: { id: true, nome: true } });
  const alvo = normalizar(limpo);
  const existente = todos.find((f) => normalizar(f.nome) === alvo);
  if (existente) return existente.id;

  const criado = await prisma.clienteFornecedor.create({
    data: { nome: limpo, documento: documento && documento.trim() ? documento.trim() : null },
  });
  return criado.id;
}
