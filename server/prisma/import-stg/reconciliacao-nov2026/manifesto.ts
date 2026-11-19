import { z } from "zod";
import { cadastrarAnimalSchema, criarGenitorSchema } from "../../../src/services/pecuaria/rebanho/schemas.js";

const id = z.string().uuid();
const sitio = z.number().int().positive();
const data = z.string().date();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const texto = z.string().trim().min(1);
const chave = z.string().regex(/^[A-Z0-9_]+:\d+$/);
const fonte = z.record(z.union([z.string(), z.number(), z.null()]));
const base = { chave, dependencias: z.array(chave), fonte, motivo: texto };
const fato = { ...base, animalId: id, propriedadeId: sitio, data };
const correcao = { id, hashOrigemEsperado: hash };
const pessoa = z.enum(["F", "M"]);
const crias = z.array(z.object({ animalId: id, chave, sexo: pessoa, ordem: z.number().int().positive() }).strict());
const guarda = z.object({
  tabela: z.enum(["Animal", "LocalizacaoAnimal", "FinalidadeAnimal", "BaixaAnimal", "LactacaoAnimal", "TentativaReprodutiva", "PartoAnimal", "GestacaoAnimal", "CriaParto", "ExameAnimal", "InterpretacaoReprodutiva", "Pesagem", "AplicacaoProduto", "VinculoPesagemParto", "VinculoPesagemSecagem", "VinculoImportacaoPecuaria", "PerfilBezerreiro", "ParticipacaoBezerreiro", "Raca", "GenitorExterno", "ComposicaoRacial", "ComposicaoGenitorExterno", "Produto", "Propriedade", "TipoExame"]),
  coluna: z.enum(["id", "animalId", "ideagriId", "pesagemId", "lactacaoId", "exameId", "bancoOrigem", "genitorId"]).nullable(),
  valores: z.array(z.string()),
  campos: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)).min(1),
  linhas: z.array(z.record(z.string().nullable())),
}).strict();

const operacoes = z.discriminatedUnion("tipo", [
  z.object({ ...base, tipo: z.literal("GENITOR"), id, dados: criarGenitorSchema }).strict(),
  z.object({ ...base, tipo: z.literal("ANIMAL"), id, dados: cadastrarAnimalSchema }).strict(),
  z.object({ ...fato, ...correcao, tipo: z.literal("CORRIGIR_ANIMAL"), dados: z.object({ brinco: texto.max(40).optional(), nome: texto.max(120).optional() }).strict() }).strict(),
  z.object({ ...fato, tipo: z.literal("PESO"), pesoKg: z.number().positive(), categoria: z.enum(["ROTINA", "NASCIMENTO", "PARTO", "SECAGEM"]), precisao: z.enum(["NAO_INFORMADO", "INFORMADO"]), contexto: z.literal("INTERNO") }).strict(),
  z.object({ ...fato, ...correcao, tipo: z.literal("CORRIGIR_PESO"), pesoKg: z.number().positive(), vinculoAntigoId: id, lactacaoAntigaId: id }).strict(),
  z.object({ ...fato, tipo: z.literal("ASSOCIAR_SECAGEM"), lactacaoId: id, pesoChave: chave }).strict(),
  z.object({ ...fato, tipo: z.literal("PARTO"), id, categoria: z.enum(["NORMAL", "DISTOCICO"]), ocorridoEm: z.string().datetime({ offset: true }).nullable(), assistencia: z.string().nullable(), crias }).strict(),
  z.object({ ...fato, tipo: z.literal("TENTATIVA"), ciclo: z.number().int().nonnegative(), ordem: z.number().int().positive(), quantidade: z.string().regex(/^\d+(\.\d+)?$/).nullable(), reprodutor: fonte.nullable(), genitorChave: chave.optional() }).strict(),
  z.object({ ...fato, tipo: z.literal("DIAGNOSTICO"), resultado: z.enum(["POSITIVO", "NEGATIVO", "INCONCLUSIVO"]), sexoFetal: pessoa.nullable() }).strict(),
  z.object({ ...fato, tipo: z.literal("LACTACAO"), id, partoId: id }).strict(),
  z.object({ ...fato, tipo: z.literal("ENCERRAR_LACTACAO"), id, versaoEsperada: z.number().int().positive(), motivoOrigem: texto, hashOrigemEsperado: hash }).strict(),
  z.object({ ...fato, tipo: z.literal("BAIXA"), motivoOrigem: texto, cienciaSanitaria: z.boolean() }).strict(),
  z.object({ ...fato, tipo: z.literal("APLICACAO"), produtoId: id.nullable(), nomeProduto: texto, aplicadaEm: z.string().datetime({ offset: true }).nullable() }).strict(),
  z.object({ ...base, tipo: z.literal("DOCUMENTO_IATF"), animalId: id.nullable(), propriedadeId: sitio.nullable() }).strict(),
  z.object({ ...fato, tipo: z.literal("VINCULAR_PESO_PARTO"), partoId: id, pesoChave: chave, criaChave: chave.nullable() }).strict(),
]);

export const manifestoSchema = z.object({
  versao: z.literal(1),
  origem: z.literal("IDEAGRI:FAZENDA:777"),
  autorId: z.number().int().positive(),
  fonteSha256: hash,
  backupSha256: hash,
  corte: z.literal("2026-11-02 19:13:30.337"),
  destino: z.object({ host: z.literal("ep-green-recipe-acyjvbqp.sa-east-1.aws.neon.tech"), banco: z.literal("neondb"), ambiente: z.literal("staging"), branch: z.literal("br-proud-wind-ac6m6hq8") }).strict(),
  operacoes: z.array(operacoes).min(1),
  guardas: z.array(guarda).min(1),
  exclusoes: z.array(z.object({ chave: z.string(), motivo: texto }).strict()),
}).strict();

export type Manifesto = z.infer<typeof manifestoSchema>;
export type Operacao = Manifesto["operacoes"][number];
export type Guarda = Manifesto["guardas"][number];

export function chaveVinculo(bancoOrigem: string, op: Operacao) {
  const [tabela, chaveOrigem] = op.chave.split(":");
  const tabelaOrigem = op.tipo === "ENCERRAR_LACTACAO" ? "LACTACAO"
    : op.tipo === "DOCUMENTO_IATF" ? `${tabela}:PENDENTE`
      : op.tipo === "VINCULAR_PESO_PARTO" ? "PESO:VINCULO_PARTO" : tabela;
  return { bancoOrigem, tabelaOrigem, chaveOrigem };
}

export function conferirOrdem(operacoes: ReadonlyArray<Pick<Operacao, "chave" | "dependencias">>) {
  const chaves = new Set<string>();
  for (const { chave, dependencias } of operacoes) {
    if (chaves.has(chave)) throw new Error(`Chave duplicada: ${chave}.`);
    if (dependencias.some(d => !chaves.has(d))) throw new Error(`Dependência ausente ou fora de ordem: ${chave}.`);
    chaves.add(chave);
  }
}

export function conferirSnapshots(tabela: string, esperado: Guarda["linhas"], atual: Guarda["linhas"]) {
  const referencia = new Map(esperado.map(r => [r.id, r]));
  for (const linha of atual) {
    const anterior = referencia.get(linha.id);
    if (!anterior || Object.keys(anterior).length !== Object.keys(linha).length || Object.entries(anterior).some(([k, v]) => linha[k] !== v))
      throw new Error(`Estado mudou em ${tabela} (${linha.id}). Gere uma nova prévia.`);
    referencia.delete(linha.id);
  }
  if (referencia.size) throw new Error(`Registro ausente em ${tabela} (${referencia.keys().next().value}). Gere uma nova prévia.`);
}

export function conferirDestino(databaseUrl: string, ambiente: string) {
  const url = new URL(databaseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const host = "ep-green-recipe-acyjvbqp.sa-east-1.aws.neon.tech";
  const remotoValido = url.host === host && url.pathname === "/neondb" && ambiente === "staging" && url.searchParams.get("sslmode") === "require";
  if ((url.protocol !== "postgresql:" && url.protocol !== "postgres:") ||
    (local ? ambiente !== "dev" || url.pathname !== "/fazendinha_seedatev3" : !remotoValido))
    throw new Error("Destino fora do escopo da reconciliação.");
  return { local, host: url.host, banco: url.pathname.slice(1), ambiente };
}
