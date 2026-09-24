/* Transformador da carga da Pecuária v1: dump do IDEAGRI (scripts/pecuaria-dump.sql) →
 * server/prisma/pecuaria_v1.json (consumido pelo importador da F6).
 *
 * Uso: node scripts/build-pecuaria-json.mjs <dump.txt> [geradoEm-YYYY-MM-DD] [saida.json]
 *
 * ENCODING (decisão): resolvido aqui, não no .sh — assim não depende da máquina Windows.
 *  1. o arquivo é decodificado como UTF-8 se for UTF-8 válido; senão como windows-1252
 *     (o isql entrega um ou outro conforme o charset da conexão);
 *  2. cada campo passa por `corrigirMojibake`, que desfaz UTF-8 lido como latin1
 *     ("HolandÃªs" → "Holandês") se o texto ainda vier duplamente codificado;
 *  3. tudo sai normalizado em NFC.
 *
 * Heurísticas documentadas:
 *  - propriedade = parte do SETOR antes do primeiro "-" (tolera "São Francisco- Receptoras");
 *    sem setor → "Principal";
 *  - papelReprodutivo = RECEPTORA se o setor contém "recept" (case/acento-insensível);
 *  - origem = NASCIDO se dataNascimento === dataEntrada, senão COMPRADO;
 *  - aptidao = CORTE se Nelore (sigla NE / nome "Nelore") ocupa > 32/64 da composição;
 *    sem ANIMALRACA, usa o racaTexto ("1/2 NE, GO", "Nelore"); senão LEITE (fazenda leiteira);
 *  - composição: PERCENTUAL (0–100) → fracao64 = round(pct*64/100); se a soma passar de 64,
 *    o maior componente é reduzido até 64.
 * Determinístico: tudo ordenado por ideagriId / nome.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEP = "~|~";

// ── texto / encoding ─────────────────────────────────────────────────────────

export function decodificarDump(buf) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

// "Ã" ou "Â" seguidos de um byte de continuação UTF-8 (0x80–0xBF) lido como latin1/cp1252.
const MOJIBAKE = /[ÃÂ][\u0080-¿ŒœŠšŸŽžƒˆ˜–-›€™]/;

export function corrigirMojibake(txt) {
  if (txt == null) return txt;
  let atual = txt;
  for (let i = 0; i < 2 && MOJIBAKE.test(atual); i++) {
    const bytes = Buffer.from(
      [...atual].map((ch) => {
        const cp = ch.codePointAt(0);
        if (cp <= 0xff) return cp;
        const idx = CP1252_ALTOS.indexOf(ch);
        return idx >= 0 ? 0x80 + idx : 0x3f;
      }),
    );
    let dec;
    try {
      dec = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      break; // não era mojibake de verdade
    }
    atual = dec;
  }
  return atual.normalize("NFC");
}
// caracteres de cp1252 nas posições 0x80–0x9F (índice = byte - 0x80)
const CP1252_ALTOS = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";

const txt = (x) => {
  if (x == null) return null;
  const t = corrigirMojibake(String(x)).trim();
  return t === "" ? null : t;
};
const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const num = (x) => {
  const t = txt(x);
  if (t == null) return null;
  const v = Number(t.replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

// ── regras ───────────────────────────────────────────────────────────────────

export function parseSetor(setor) {
  const t = txt(setor);
  if (!t) return { propriedadeNome: "Principal", funcao: null };
  const i = t.indexOf("-");
  const antes = (i >= 0 ? t.slice(0, i) : t).trim();
  const depois = i >= 0 ? t.slice(i + 1).trim() : null;
  return { propriedadeNome: antes || "Principal", funcao: depois || null };
}

export function papelReprodutivoDe(setor) {
  const t = txt(setor);
  return t && semAcento(t).includes("recept") ? "RECEPTORA" : "NENHUM";
}

export function origemDe(dataNascimento, dataEntrada) {
  return dataNascimento && dataNascimento === dataEntrada ? "NASCIDO" : "COMPRADO";
}

// [{sigla, percentual}] → [{sigla, fracao64}], soma ≤ 64, ordenado por fracao desc/sigla.
export function composicaoEm64(itens) {
  const acc = new Map();
  for (const { sigla, percentual } of itens) {
    if (!sigla || percentual == null || percentual <= 0) continue;
    acc.set(sigla, (acc.get(sigla) ?? 0) + percentual);
  }
  const comp = [...acc].map(([sigla, pct]) => ({ sigla, fracao64: Math.round((pct * 64) / 100) }));
  const soma = comp.reduce((t, c) => t + c.fracao64, 0);
  if (soma > 64) {
    const maior = comp.reduce((m, c) => (c.fracao64 > m.fracao64 ? c : m));
    maior.fracao64 -= soma - 64;
  }
  return comp
    .filter((c) => c.fracao64 > 0)
    .sort((a, b) => b.fracao64 - a.fracao64 || a.sigla.localeCompare(b.sigla));
}

const ehNelore = (sigla) => {
  const s = semAcento(sigla ?? "");
  return s === "ne" || s === "nel" || s.startsWith("nelore");
};

// Fração de Nelore (0–1) do texto livre do IDEAGRI: "Nelore", "1/2 NE, GO", "1/2 GO, NE".
// O componente sem fração leva o restante.
export function fracaoNeloreTexto(racaTexto) {
  const t = txt(racaTexto);
  if (!t) return 0;
  const partes = t.split(",").map((p) => p.trim()).filter(Boolean);
  let usado = 0;
  let ne = 0;
  let semFracao = null;
  for (const p of partes) {
    const m = p.match(/^(\d+)\s*\/\s*(\d+)\s+(.+)$/);
    if (m) {
      const f = Number(m[1]) / Number(m[2]);
      usado += f;
      if (ehNelore(m[3])) ne += f;
    } else semFracao = p;
  }
  if (semFracao && ehNelore(semFracao)) ne += Math.max(0, 1 - usado);
  return ne;
}

export function aptidaoDe(composicao, racaTexto) {
  if (composicao.length > 0) {
    const ne = composicao.filter((c) => ehNelore(c.sigla)).reduce((t, c) => t + c.fracao64, 0);
    return ne > 32 ? "CORTE" : "LEITE";
  }
  return fracaoNeloreTexto(racaTexto) > 0.5 ? "CORTE" : "LEITE";
}

// ── parse de linhas ──────────────────────────────────────────────────────────

export function parseLinhaAnimal(linha) {
  const f = linha.split(SEP);
  return {
    ideagriId: num(f[0]),
    numero: txt(f[1]),
    nome: txt(f[2]),
    sexo: txt(f[3]),
    dataNascimento: txt(f[4]),
    dataEntrada: txt(f[5]),
    brincoEletronico: txt(f[6]),
    sisbov: txt(f[7]),
    partosAntesDaEntrada: num(f[8]) ?? 0,
    dataBaixa: txt(f[9]),
    motivoIdeagriId: num(f[10]),
    motivoNome: txt(f[11]),
    setor: txt(f[12]),
    grupo: txt(f[13]),
    racaTexto: txt(f[14]),
    ideagriCategoria: num(f[15]),
  };
}

export function montarAnimal(a, racasDoAnimal, pesagens) {
  const { propriedadeNome } = parseSetor(a.setor);
  const composicao = composicaoEm64(racasDoAnimal ?? []);
  const nascimentoEstimado = !a.dataNascimento;
  const dataNascimento = a.dataNascimento ?? a.dataEntrada;
  const out = {
    ideagriId: a.ideagriId,
    brinco: a.numero,
    nome: a.nome,
    sexo: a.sexo,
    dataNascimento,
    nascimentoEstimado,
    origem: nascimentoEstimado ? "COMPRADO" : origemDe(a.dataNascimento, a.dataEntrada),
    dataEntrada: a.dataEntrada ?? dataNascimento,
    partosAntesDaEntrada: a.partosAntesDaEntrada,
    ideagriCategoria: a.ideagriCategoria ?? null,
    propriedadeNome,
    loteNome: a.grupo,
    papelReprodutivo: papelReprodutivoDe(a.setor),
    aptidao: aptidaoDe(composicao, a.racaTexto),
    composicao,
    saida: a.dataBaixa
      ? { data: a.dataBaixa, motivoIdeagriId: a.motivoIdeagriId, motivoNome: a.motivoNome }
      : null,
    pesagens: (pesagens ?? []).slice().sort((x, y) => x.data.localeCompare(y.data) || x.ideagriId - y.ideagriId),
  };
  if (composicao.length === 0) out.racaTexto = a.racaTexto;
  return out;
}

export function construir(texto, geradoEm) {
  const linhas = texto.split("\n").map((l) => l.replace(/\r$/, "").replace(/\s+$/, ""));
  const animaisBrutos = [];
  const racasPorAnimal = new Map();
  const pesagensPorAnimal = new Map();
  const motivos = new Map();
  const racas = new Map();
  const push = (m, k, v) => (m.has(k) ? m.get(k).push(v) : m.set(k, [v]));

  for (const l of linhas) {
    if (l.startsWith("@A@")) animaisBrutos.push(parseLinhaAnimal(l.slice(3)));
    else if (l.startsWith("@RACA@")) {
      const f = l.slice(6).split(SEP);
      const sigla = txt(f[2]) ?? txt(f[3]);
      push(racasPorAnimal, num(f[0]), { sigla, percentual: num(f[4]) });
    } else if (l.startsWith("@MB@")) {
      const f = l.slice(4).split(SEP);
      motivos.set(num(f[0]), { ideagriId: num(f[0]), nome: txt(f[1]) });
    } else if (l.startsWith("@RC@")) {
      const f = l.slice(4).split(SEP);
      racas.set(num(f[0]), { ideagriId: num(f[0]), sigla: txt(f[1]), nome: txt(f[2]) });
    } else if (l.startsWith("@P@")) {
      const f = l.slice(3).split(SEP);
      push(pesagensPorAnimal, num(f[1]), {
        ideagriId: num(f[0]), data: txt(f[2]), pesoKg: num(f[3]), tipoIdeagri: txt(f[4]),
      });
    }
  }

  for (const [id, rs] of racasPorAnimal) {
    const soma = rs.reduce((t, r) => t + (r.percentual ?? 0), 0);
    if (Math.abs(soma - 100) > 1) console.warn(`ANIMALRACA: animal ${id} soma ${soma}% (esperado ~100)`);
  }

  const animais = animaisBrutos
    .filter((a) => a.ideagriId != null)
    .sort((x, y) => x.ideagriId - y.ideagriId)
    .map((a) => montarAnimal(a, racasPorAnimal.get(a.ideagriId), pesagensPorAnimal.get(a.ideagriId)));

  const propriedades = [...new Set(animais.map((a) => a.propriedadeNome))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((nome) => ({ nome }));
  const lotesMap = new Map();
  for (const a of animais) {
    if (!a.loteNome) continue;
    const k = `${a.propriedadeNome}\u0000${a.loteNome}`;
    if (!lotesMap.has(k)) lotesMap.set(k, { nome: a.loteNome, propriedadeNome: a.propriedadeNome, ideagriGrupo: a.loteNome });
  }
  const lotes = [...lotesMap.values()].sort(
    (a, b) => a.propriedadeNome.localeCompare(b.propriedadeNome, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return {
    geradoEm,
    propriedades,
    lotes,
    racas: [...racas.values()].sort((a, b) => a.ideagriId - b.ideagriId),
    motivosSaida: [...motivos.values()].sort((a, b) => a.ideagriId - b.ideagriId),
    animais,
  };
}

function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error("uso: node scripts/build-pecuaria-json.mjs <dump.txt> [geradoEm] [saida.json]");
    process.exit(1);
  }
  const geradoEm = process.argv[3] ?? new Date().toISOString().slice(0, 10);
  const destino = process.argv[4] ?? fileURLToPath(new URL("../server/prisma/pecuaria_v1.json", import.meta.url));
  const json = construir(decodificarDump(readFileSync(dumpPath)), geradoEm);
  if (json.animais.length === 0) {
    console.error("ERRO: nenhum animal no dump — JSON não foi escrito.");
    process.exit(1);
  }
  writeFileSync(destino, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  const ativos = json.animais.filter((a) => !a.saida).length;
  console.log(
    `✓ ${destino}: ${json.animais.length} animais (${ativos} ativos), ${json.propriedades.length} propriedades, ` +
      `${json.lotes.length} lotes, ${json.animais.reduce((t, a) => t + a.pesagens.length, 0)} pesagens`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
