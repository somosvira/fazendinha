/* Uso: node scripts/build-pecuaria-v4-json.mjs dump.txt saida.json
 * Carga técnica determinística, sem sincronização. Datas só conhecidas; ausência = null.
 * Mantém referências legadas no snapshot, sem inferir relações por proximidade de datas. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { decodificarDump, corrigirMojibake } from "./build-pecuaria-json.mjs";

export const CAMPOS = {
  R: [
    "id",
    "tipo",
    "animal",
    "data",
    "hora",
    "reprodutor",
    "embriao",
    "diagnosticoRef",
    "diagnostico",
    "complemento",
    "partoPrevisto",
    "tipoParto",
    "numeroCrias",
    "cria1",
    "cria2",
    "sexoCria1",
    "sexoCria2",
    "doses",
    "lactacao",
    "programacao",
    "protocolo",
    "pessoa",
    "responsavel",
    "periodo",
    "coleta",
    "loteProduto",
  ],
  L: ["id", "animal", "inicio", "fim", "motivoSecagem", "induzida"],
  P: ["id", "animal", "tipo", "inicio", "fim"],
  A: [
    "id",
    "tipo",
    "rebanho",
    "numero",
    "nome",
    "sexo",
    "nascimento",
    "entrada",
    "partosAntesEntrada",
    "aptidao",
    "mae",
    "pai",
    "produto",
  ],
  I: [
    "id",
    "nome",
    "implante",
    "horaImplante",
    "retirada",
    "responsavelImplante",
    "responsavelRetirada",
    "setor",
  ],
  S: ["id", "programacao", "animal", "implante", "perda", "protocolo"],
  T: ["id", "nome", "ativo"],
  E: ["id", "protocolo", "principioAtivo", "dia", "produto"],
  TP: ["id", "nome"],
  MS: ["id", "nome"],
};
const TABELAS = {
  R: "REPRODUCAO",
  L: "LACTACAO",
  P: "ANIMALPERIODO",
  A: "ANIMAL",
  I: "PROGRAMACAOIATF",
  S: "PROGRAMACAOIATFASSOCIACAO",
  T: "PROTOCOLOIATF",
  E: "PROTOCOLOIATFPRINCIPIOATIVO",
  TP: "TIPOPARTO",
  MS: "MOTIVOSECAGEM",
};
const integer = (v) =>
  v === null
    ? null
    : /^\d+$/.test(v) && Number.isSafeInteger(Number(v))
      ? Number(v)
      : null;
const tipos = {
  1: "IA",
  2: "COBERTURA",
  3: "TE",
  4: "DIAGNOSTICO",
  7: "PARTO",
};
const dataValida = (v) =>
  v === null ||
  (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v);
export function transformarV4(texto) {
  const tabelas = Object.fromEntries(
    Object.keys(CAMPOS).map((tag) => [tag, []]),
  );
  const chaves = new Set();
  for (const original of texto.split(/\r?\n/)) {
    const linha = original.trim();
    if (
      !linha.startsWith("@") ||
      linha.startsWith("@V4@") ||
      linha.startsWith("@CONTAGEM@")
    )
      continue;
    const m = linha.match(/^@([A-Z]+)@(.*)$/);
    if (!m || !CAMPOS[m[1]])
      throw new Error(
        "Prefixo de extração desconhecido: " + linha.slice(0, 40),
      );
    const [tag, corpo] = [m[1], m[2]];
    const valores = corpo
      .split("~|~")
      .map((x) => corrigirMojibake(x).trim() || null);
    if (valores.length !== CAMPOS[tag].length)
      throw new Error(
        `${tag}: ${valores.length} campos; esperado ${CAMPOS[tag].length}`,
      );
    const registro = Object.fromEntries(
      CAMPOS[tag].map((campo, i) => [campo, valores[i]]),
    );
    if (integer(registro.id) === null)
      throw new Error(`${tag}: chave inválida`);
    const chave = `${TABELAS[tag]}:${registro.id}`;
    if (chaves.has(chave)) throw new Error(`Chave duplicada no dump: ${chave}`);
    chaves.add(chave);
    tabelas[tag].push(registro);
  }
  for (const linhas of Object.values(tabelas))
    linhas.sort((a, b) => Number(a.id) - Number(b.id));
  if (!tabelas.R.length || !tabelas.A.length)
    throw new Error("Extração incompleta: REPRODUCAO e ANIMAL obrigatórios");
  const animais = new Map(tabelas.A.map((a) => [a.id, a]));
  const eventos = new Map(tabelas.R.map((r) => [r.id, r]));
  const pendencias = [];
  const avisar = (chave, codigo, mensagem) =>
    pendencias.push({ chave, codigo, mensagem });
  const fatos = tabelas.R.map((r) => {
    const chaveExterna = `REPRODUCAO:${r.id}`;
    const tipo = tipos[r.tipo] ?? null;
    const animal = animais.get(r.animal);
    if (!tipo)
      avisar(
        chaveExterna,
        "TIPO_NAO_SUPORTADO",
        "Tipo original mantido sem converter em fato operacional.",
      );
    if (!r.data || !dataValida(r.data))
      throw new Error(`${chaveExterna}: data inválida ou ausente`);
    if (!animal || animal.tipo !== "A" || animal.rebanho !== "1")
      avisar(
        chaveExterna,
        "ANIMAL_FORA_REBANHO",
        "Resolver identidade existente antes da carga.",
      );
    let tentativaChave = null;
    if (tipo === "DIAGNOSTICO") {
      const candidatas = tabelas.R.filter(
        (t) =>
          ["1", "2", "3"].includes(t.tipo) &&
          t.diagnosticoRef === r.id &&
          t.animal === r.animal,
      );
      if (candidatas.length === 1 && candidatas[0].data <= r.data)
        tentativaChave = `REPRODUCAO:${candidatas[0].id}`;
      else
        avisar(
          chaveExterna,
          candidatas.length
            ? "VINCULO_DIAGNOSTICO_CONFLITANTE"
            : "DIAGNOSTICO_SEM_TENTATIVA",
          "CDDIAGNOSTICO da tentativa aponta ao exame; não vincular por data.",
        );
    }
    if (["IA", "COBERTURA", "TE"].includes(tipo) && r.diagnosticoRef) {
      const d = eventos.get(r.diagnosticoRef);
      if (!d || d.tipo !== "4" || d.animal !== r.animal || d.data < r.data)
        avisar(
          chaveExterna,
          "REFERENCIA_DIAGNOSTICO_INVALIDA",
          "Referência original não comprovada como exame posterior do mesmo animal.",
        );
    }
    if (tipo === "IA" && r.doses === null)
      avisar(
        chaveExterna,
        "QUANTIDADE_DESCONHECIDA",
        "Não converter ausência de NUMDOSES em dose conhecida.",
      );
    if (tipo === "DIAGNOSTICO" && r.diagnostico === "P")
      avisar(
        chaveExterna,
        "GESTACAO_NAO_RECONCILIADA",
        "Avaliação positiva preservada; vínculo/encerramento da gestação exige revisão, sem gestação aberta presumida.",
      );
    if (tipo === "PARTO" && !r.cria1 && !r.cria2)
      avisar(
        chaveExterna,
        "CRIAS_SEM_REFERENCIA",
        "Não cadastrar/vincular crias nem filiação por data ou genitor candidato.",
      );
    if (tipo === "TE")
      avisar(
        chaveExterna,
        "MATERIAL_LEGADO",
        "CDEMBRIAO referencia ANIMAL legado do material; nunca uma cria.",
      );
    const desfechoOriginal =
      tabelas.TP.find((x) => x.id === r.tipoParto)?.nome ?? null;
    const desfecho = desfechoOriginal?.toLowerCase().includes("aborto")
      ? "ABORTO"
      : desfechoOriginal?.toLowerCase().includes("vivo/natimorto")
        ? "MISTO"
        : desfechoOriginal?.toLowerCase().includes("natimorto")
          ? "NATIMORTO"
          : tipo === "PARTO"
            ? "VIVO"
            : null;
    return {
      origem: "IDEAGRI",
      chaveExterna,
      tipo,
      animalIdeagriId: integer(r.animal),
      data: r.data,
      hora: r.hora,
      tentativaChave,
      resultado:
        tipo === "DIAGNOSTICO"
          ? r.diagnostico === "P"
            ? "POSITIVO"
            : r.diagnostico === "N"
              ? "NEGATIVO"
              : "INCONCLUSIVO"
          : null,
      desfecho,
      desfechoOriginal,
      contaParidade: tipo === "PARTO",
      anteriorEntrada:
        tipo === "PARTO" && !!animal?.entrada && r.data < animal.entrada,
      quantidade: r.doses,
      criasComReferencia: [r.cria1, r.cria2].filter(Boolean).map(integer),
      snapshot: r,
    };
  }).sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      Number(a.snapshot.id) - Number(b.snapshot.id),
  );
  const lactacoes = tabelas.L.map((l) => {
    const chaveExterna = `LACTACAO:${l.id}`;
    if (
      !l.inicio ||
      !dataValida(l.inicio) ||
      !dataValida(l.fim) ||
      (l.fim && l.fim < l.inicio)
    )
      throw new Error(`${chaveExterna}: intervalo inválido`);
    const partos = tabelas.R.filter(
      (r) => r.tipo === "7" && r.lactacao === l.id && r.animal === l.animal,
    );
    const partoChave =
      partos.length === 1 ? `REPRODUCAO:${partos[0].id}` : null;
    if (!partoChave)
      avisar(
        chaveExterna,
        "LACTACAO_SEM_PARTO_COMPROVADO",
        "Preservar período sem deduzir vínculo pelo início.",
      );
    return {
      origem: "IDEAGRI",
      chaveExterna,
      animalIdeagriId: integer(l.animal),
      inicio: l.inicio,
      fim: l.fim,
      partoChave,
      snapshot: l,
    };
  });
  const periodos = tabelas.P.map((p) => {
    const chaveExterna = `ANIMALPERIODO:${p.id}`;
    if (
      !p.inicio ||
      !dataValida(p.inicio) ||
      !dataValida(p.fim) ||
      (p.fim && p.fim < p.inicio)
    )
      throw new Error(`${chaveExterna}: intervalo inválido`);
    return {
      origem: "IDEAGRI",
      chaveExterna,
      animalIdeagriId: integer(p.animal),
      tipo:
        { 1: "DOADORA", 2: "RECEPTORA", 3: "DESCARTE" }[p.tipo] ??
        "DESCONHECIDO",
      inicio: p.inicio,
      fim: p.fim,
      snapshot: p,
    };
  });
  for (const r of [...tabelas.T, ...tabelas.E, ...tabelas.I, ...tabelas.S])
    avisar(
      `IATF_LEGADO:${r.id}`,
      "IATF_HISTORICO_PENDENTE",
      "Fonte preservada em auditoria/vínculo; não equivale a protocolo publicado, início individual ou execução de etapa.",
    );
  const totais = Object.fromEntries(
    Object.entries(tabelas).map(([tag, linhas]) => [
      TABELAS[tag],
      linhas.length,
    ]),
  );
  const porTipo = Object.fromEntries(
    Object.values(tipos).map((tipo) => [
      tipo,
      fatos.filter((f) => f.tipo === tipo).length,
    ]),
  );
  return {
    versao: 4,
    origem: "IDEAGRI",
    sha256: createHash("sha256").update(JSON.stringify(tabelas)).digest("hex"),
    fatos,
    lactacoes,
    periodos,
    animais: tabelas.A,
    programacoes: tabelas.I,
    participacoes: tabelas.S,
    protocolos: tabelas.T,
    etapas: tabelas.E,
    catalogos: { tiposParto: tabelas.TP, motivosSecagem: tabelas.MS },
    relatorio: { totais, porTipo, pendencias },
  };
}
export function verificarCompletude(texto, dados) {
  if (!texto.split(/\r?\n/).some((l) => l.trim() === "@V4@FIM"))
    throw new Error("Dump sem marcador final; extração parcial não aceita.");
  for (const [tag, tabela] of Object.entries(TABELAS)) {
    const linha = texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith(`@CONTAGEM@${tag}~|~`));
    if (
      !linha ||
      Number(linha.split("~|~")[1]) !== dados.relatorio.totais[tabela]
    )
      throw new Error(`Contagem extraída divergente/ausente: ${tabela}`);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [entrada, saida] = process.argv.slice(2);
  if (!entrada || !saida)
    throw new Error("Informe dump.txt e saída.json explicitamente.");
  const texto = decodificarDump(readFileSync(entrada));
  const dados = transformarV4(texto);
  verificarCompletude(texto, dados);
  writeFileSync(saida, JSON.stringify(dados, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        sha256: dados.sha256,
        ...dados.relatorio.totais,
        porTipo: dados.relatorio.porTipo,
        pendencias: dados.relatorio.pendencias.length,
      },
      null,
      2,
    ),
  );
}
