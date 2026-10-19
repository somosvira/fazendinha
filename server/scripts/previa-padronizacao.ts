import { Client } from "pg";
import { env } from "../src/env.js";

// Conferência somente de leitura: não cria cadastros, fatos, estoque ou agrupamentos.
const banco = new Client({ connectionString: env.DATABASE_URL });
await banco.connect();
try {
  await banco.query("BEGIN READ ONLY");
  const relacoes = (await banco.query<{ nome: string; tipo: string }>(`SELECT c.relname AS nome,c.relkind::text AS tipo FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pecuaria' AND c.relname=ANY($1::text[])`, [["Protocolo", "ProtocoloSanitario", "ProtocoloIatf", "ProgramacaoIatf", "ParticipanteIatf", "TarefaIatf", "ExameAnimal", "AvaliacaoReprodutiva", "InterpretacaoReprodutiva", "PeriodoReprodutivoAnimal", "RegistroChuva"]])).rows;
  const comum = relacoes.some(r => r.nome === "Protocolo");
  const consulta = async (sql: string) => (await banco.query<Record<string, unknown>>(sql)).rows;
  const contagens: Record<string, unknown> = {};
  for (const r of relacoes) contagens[r.nome] = { armazenamento: r.tipo === "v" ? "projeção de leitura" : "tabela", quantidade: (await consulta(`SELECT count(*)::int AS n FROM pecuaria."${r.nome}"`))[0].n };
  const conflitosPapel = await consulta(`SELECT a."animalId",count(*)::int AS evidencias FROM pecuaria."PeriodoReprodutivoAnimal" a JOIN pecuaria."PeriodoReprodutivoAnimal" b ON a."animalId"=b."animalId" AND a.id<b.id AND a.tipo<>b.tipo AND a.inicio<COALESCE(b.fim,'infinity'::date) AND b.inicio<COALESCE(a.fim,'infinity'::date) ${comum ? 'WHERE a."revogadoEm" IS NULL AND b."revogadoEm" IS NULL' : ''} GROUP BY a."animalId"`);
  const colisoes: Record<string, unknown> = {};
  if (!comum) for (const [sanitario,reprodutivo] of [["ProtocoloSanitario","ProtocoloIatf"],["RodadaProtocoloSanitario","ProgramacaoIatf"],["ExecucaoProtocoloSanitario","ParticipanteIatf"],["TarefaSanitaria","TarefaIatf"]]) colisoes[reprodutivo] = await consulta(`SELECT i.id FROM pecuaria."${reprodutivo}" i JOIN pecuaria."${sanitario}" s ON s.id=i.id`);
  const arquivosIncompletos = await consulta(`SELECT id,nome,publicado,jsonb_array_length(etapas) AS etapas FROM pecuaria."ProtocoloIatf" WHERE NOT publicado OR etapas='[]'::jsonb`);
  console.log(JSON.stringify({ estado: comum ? "estrutura comum" : "estrutura anterior", contagens, colisoes, conflitosPapel, arquivosIncompletos, orientacao: "Colisões de ID são mapeadas, conflitos de papel ficam explícitos e arquivos incompletos não se tornam operacionais. Conferir backup e ensaio em cópia antes do rollout. Nenhum dado foi modificado." }, null, 2));
  await banco.query("ROLLBACK");
} finally { await banco.end(); }
