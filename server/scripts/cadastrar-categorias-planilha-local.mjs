import pg from "pg";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Catálogo gerencial identificado no cache da planilha Rio Novo de maio/2026.
// Aliases explícitos conservam os cadastros equivalentes do seed, sem renomeá-los.
const catalogo = [
  ["Criação Animal", [
    ["Animal Aquisição", "Aquisição de animais"], ["Curral"], ["Energia Eletrica"],
    ["Investimento Criação Animal"], ["Medicamento Animal", "Medicamentos veterinários"],
    ["Ração"], ["Reprodução"], ["Sede"],
  ]],
  ["Despesas Administrativas", [["Admin - BPO Financeiro", "BPO financeiro"], ["Contabilidade"], ["Internet"], ["Tarifas", "Tarifas bancárias"]]],
  ["Impostos", [["DARF"]]],
  ["Máquinas e Equipamentos", [["Combustível"], ["Manutenção"], ["Maq e Equip Investimento", "Máquinas e equipamentos"]]],
  ["Obra Civil", [["Empreitada"], ["Material de Construção"]]],
  ["Plantio", [["Galpão"], ["Investimento Plantio"], ["Medicamento Plantio"], ["Plantio"]]],
  ["Produção Rural", [
    ["Pessoal - Exames Ocupacionais", "Exames ocupacionais"], ["Pessoal - FGTS", "FGTS"],
    ["Pessoal - Férias", "Férias"], ["Pessoal - Plano de Saúde", "Plano de saúde"],
    ["Pessoal - Rescisão", "Rescisões"], ["Pessoal - Salário", "Salários"],
  ]],
  ["Venda de Produção", [["Venda de Café"], ["Venda de Leite"]]],
];
const normalizar = nome => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
const identificar = (linhas, nomes) => {
  const candidatos = linhas.filter(linha => nomes.some(nome => normalizar(nome) === normalizar(linha.nome)));
  if (candidatos.length > 1) throw Error(`Cadastro ambíguo: ${nomes.join(" / ")}`);
  if (candidatos[0]?.ativo === false) throw Error(`Cadastro inativo exige revisão: ${candidatos[0].nome}`);
  return candidatos[0];
};
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--aplicar")) throw Error("Use sem argumentos para prévia, ou --aplicar para confirmar a carga local");
const aplicar = args.includes("--aplicar");
const url = new URL(process.env.DATABASE_URL ?? "");
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/fazendinha_seedatev3" || url.search) {
  throw Error("Carga permitida somente em PostgreSQL local fazendinha_seedatev3, sem parâmetros de conexão alternativos");
}
const manifestos = ["../.seedatev3/manifesto.json", "../.seedatev3/v4/manifesto.json"].map(p => fileURLToPath(new URL(p, import.meta.url)));
const hashManifestos = () => manifestos.map(p => [p, existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null]);
const manifestosAntes = JSON.stringify(hashManifestos());
const db = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
const quote = nome => `"${nome.replaceAll('"', '""')}"`;
const estadosProtegidos = async () => {
  const tabelas = (await db.query(`SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('public', 'pecuaria') AND tablename NOT IN ('Categoria', 'GrupoCategoria', 'AuditoriaFinanceira')
    ORDER BY schemaname, tablename`)).rows;
  const estados = [];
  for (const t of tabelas) {
    const tabela = `${quote(t.schemaname)}.${quote(t.tablename)}`;
    const { rows } = await db.query(`SELECT count(*)::int AS quantidade,
      md5(coalesce(string_agg(digest, '' ORDER BY digest), '')) AS hash
      FROM (SELECT md5(to_jsonb(linha)::text) AS digest FROM ${tabela} linha) dados`);
    estados.push({ tabela, ...rows[0] });
  }
  return estados;
};
const motivo = "Cadastro local dos grupos/categorias da planilha Rio Novo maio/2026; preservação do seed";
async function auditar(entidade, anterior, posterior) {
  await db.query(`INSERT INTO public."AuditoriaFinanceira"
    (id, entidade, "entidadeId", acao, motivo, "estadoAnterior", "estadoPosterior")
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
  [randomUUID(), entidade, posterior.id, anterior ? "ATUALIZADA" : "CRIADA", motivo, anterior ? JSON.stringify(anterior) : null, JSON.stringify(posterior)]);
}
await db.connect();
try {
  await db.query(aplicar ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await db.query("SET LOCAL lock_timeout = '5s'");
  await db.query("SET LOCAL statement_timeout = '30s'");
  const identidade = (await db.query("SELECT current_database() AS banco, host(inet_server_addr()) AS endereco")).rows[0];
  if (identidade.banco !== "fazendinha_seedatev3" || !["127.0.0.1", "::1"].includes(identidade.endereco)) throw Error("Identidade do banco local divergente");
  if (aplicar) await db.query('LOCK TABLE public."Categoria", public."GrupoCategoria" IN SHARE ROW EXCLUSIVE MODE');
  const gruposAntes = (await db.query('SELECT * FROM public."GrupoCategoria" ORDER BY ordem, nome')).rows;
  const categoriasAntes = (await db.query('SELECT * FROM public."Categoria" ORDER BY ordem, nome')).rows;
  const protegidosAntes = aplicar ? await estadosProtegidos() : [];
  const grupos = [];
  const categorias = [];
  let ordemGrupo = Math.max(-1, ...gruposAntes.map(g => g.ordem)) + 1;
  let ordemCategoria = Math.max(-1, ...categoriasAntes.map(c => c.ordem)) + 1;
  for (const [nomeGrupo, nomesCategorias] of catalogo) {
    const existente = identificar(gruposAntes, [nomeGrupo]);
    const grupo = existente ?? { id: randomUUID(), nome: nomeGrupo, ativo: true, ordem: ordemGrupo++ };
    grupos.push({ grupo, novo: !existente });
    for (const nomes of nomesCategorias) {
      const anterior = identificar(categoriasAntes, nomes);
      if (anterior?.grupoId && anterior.grupoId !== grupo.id) throw Error(`Categoria já vinculada a outro grupo: ${anterior.nome}`);
      const categoria = anterior ? { ...anterior, grupoId: grupo.id } : {
        id: randomUUID(), nome: nomes[0], grupoId: grupo.id, ativo: true, ordem: ordemCategoria++,
        classificacao: null, usoGenetico: false, usoSanitario: false, usoNutricional: false,
      };
      categorias.push({ origem: nomes[0], grupo: grupo.nome, anterior, categoria });
    }
  }
  if (grupos.length !== 8 || categorias.length !== 30 || new Set(categorias.map(c => c.categoria.id)).size !== 30) throw Error("Catálogo não fecha 8 grupos e 30 categorias distintas");
  if (aplicar) {
    for (const { grupo, novo } of grupos) if (novo) {
      await db.query('INSERT INTO public."GrupoCategoria" (id, nome, ordem) VALUES ($1,$2,$3)', [grupo.id, grupo.nome, grupo.ordem]);
      await auditar("GrupoCategoria", null, grupo);
    }
    for (const { anterior, categoria: c } of categorias) {
      if (!anterior) {
        await db.query('INSERT INTO public."Categoria" (id,nome,"grupoId",ordem) VALUES ($1,$2,$3,$4)', [c.id, c.nome, c.grupoId, c.ordem]);
        await auditar("Categoria", null, c);
      } else if (anterior.grupoId !== c.grupoId) {
        await db.query('UPDATE public."Categoria" SET "grupoId"=$1 WHERE id=$2', [c.grupoId, c.id]);
        await auditar("Categoria", anterior, c);
      }
    }
    const categoriasDepois = (await db.query('SELECT * FROM public."Categoria"')).rows;
    const gruposDepois = (await db.query('SELECT * FROM public."GrupoCategoria"')).rows;
    for (const anterior of categoriasAntes) {
      const depois = categoriasDepois.find(c => c.id === anterior.id);
      const previsto = categorias.find(c => c.categoria.id === anterior.id)?.categoria ?? anterior;
      if (!depois || Object.keys(anterior).some(k => depois[k] !== previsto[k])) throw Error(`Categoria alterada além do vínculo previsto: ${anterior.nome}`);
    }
    for (const { categoria: c } of categorias) {
      const depois = categoriasDepois.find(d => d.id === c.id);
      if (!depois || Object.keys(c).some(k => depois[k] !== c[k])) throw Error(`Categoria não confere: ${c.nome}`);
    }
    for (const { grupo: g } of grupos) {
      const depois = gruposDepois.find(d => d.id === g.id);
      if (!depois || Object.keys(g).some(k => depois[k] !== g[k])) throw Error(`Grupo não confere: ${g.nome}`);
    }
    if (JSON.stringify(protegidosAntes) !== JSON.stringify(await estadosProtegidos())) throw Error("Dados fora do catálogo foram alterados; carga revertida");
    if (manifestosAntes !== JSON.stringify(hashManifestos())) throw Error("Manifesto do seed mudou durante a carga; carga revertida");
    await db.query("COMMIT");
  } else await db.query("ROLLBACK");
  console.log(JSON.stringify({
    modo: aplicar ? "aplicado" : "previa", banco: identidade.banco,
    gruposCriados: grupos.filter(g => g.novo).length,
    categoriasCriadas: categorias.filter(c => !c.anterior).length,
    categoriasReaproveitadas: categorias.filter(c => c.anterior).length,
    vinculosAtualizados: categorias.filter(c => c.anterior && c.anterior.grupoId !== c.categoria.grupoId).length,
    tabelasProtegidasConferidas: protegidosAntes.length,
    categorias: categorias.map(c => ({ origem: c.origem, cadastro: c.categoria.nome, grupo: c.grupo, acao: !c.anterior ? "criar" : c.anterior.grupoId !== c.categoria.grupoId ? "vincular" : "preservar" })),
  }, null, 2));
} catch (erro) {
  await db.query("ROLLBACK");
  throw erro;
} finally {
  await db.end();
}
