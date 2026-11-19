import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { chaveVinculo, type Manifesto, type Operacao } from "./manifesto.js";
import { mapBaixaIdeagri } from "../../../src/services/pecuaria/rebanho/classificacao-baixa-origem.js";

type Tx = Prisma.TransactionClient;
type Linha = Record<string, unknown>;
type Consulta = { id: string; snapshot: string };
const entidadePorTipo = {
  GENITOR: "GenitorExterno", ANIMAL: "Animal", CORRIGIR_ANIMAL: "Animal", PESO: "Pesagem",
  CORRIGIR_PESO: "Pesagem", ASSOCIAR_SECAGEM: "VinculoPesagemSecagem", PARTO: "PartoAnimal",
  TENTATIVA: "TentativaReprodutiva", DIAGNOSTICO: "ExameAnimal", LACTACAO: "LactacaoAnimal",
  ENCERRAR_LACTACAO: "LactacaoAnimal", BAIXA: "BaixaAnimal", APLICACAO: "AplicacaoProduto",
  DOCUMENTO_IATF: "AuditoriaPecuaria", VINCULAR_PESO_PARTO: "VinculoPesagemParto",
} as const satisfies Record<Operacao["tipo"], string>;
const reciboItem = z.object({ chave: z.string(), entidade: z.string(), id: z.string() }).strict();
const provaItem = z.object({ tabela: z.string(), id: z.string(), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const resultadoSchema = z.object({ recibo: z.array(reciboItem), estadoFinal: z.array(provaItem) }).passthrough();
export type Recibo = z.infer<typeof reciboItem>;
type Prova = z.infer<typeof provaItem>;
type Tabela = (typeof entidadePorTipo)[keyof typeof entidadePorTipo] | "CriaParto" | "LocalizacaoAnimal" | "FinalidadeAnimal" |
  "ComposicaoRacial" | "ComposicaoGenitorExterno" | "AvaliacaoReprodutiva" | "ResultadoExame" |
  "InterpretacaoReprodutiva" | "VinculoImportacaoPecuaria" | "ParticipacaoBezerreiro" | "PerfilBezerreiro";
const digerir = (s: string) => createHash("sha256").update(s).digest("hex");
export const hashFonte = (op: Operacao) => digerir(JSON.stringify(op.fonte));

function verificarCampos(chave: string, atual: Linha | undefined, esperado: Linha) {
  if (!atual) throw new Error(`${chave}: fato ausente ou alterado após o lote.`);
  for (const [campo, valor] of Object.entries(esperado)) {
    if (atual[campo] !== valor) throw new Error(`${chave}: campo ${campo} diverge da origem aprovada ou foi alterado após o lote.`);
  }
}
function verificarHorario(chave: string, obtido: unknown, esperado: string | null, comFuso: boolean) {
  if (esperado === null && obtido === null) return;
  if (esperado && typeof obtido === "string" && new Date(comFuso ? obtido : obtido + "Z").getTime() === new Date(esperado).getTime()) return;
  throw new Error(`${chave}: horário diverge da origem aprovada ou foi alterado após o lote.`);
}
function verificarComposicao(chave: string, atual: Linha[], esperado: { racaId: string; fracao64: number }[]) {
  if (atual.length !== esperado.length || esperado.some(e => !atual.some(a => a.racaId === e.racaId && a.fracao64 === e.fracao64)))
    throw new Error(`${chave}: composição diverge da origem aprovada ou foi alterada após o lote.`);
}

export async function conferirResultadoTx(tx: Tx, m: Manifesto, recibo: Recibo[]) {
  const porChave = new Map(recibo.map(r => [r.chave, r]));
  const resolver = (chave: string) => {
    const item = porChave.get(chave);
    if (!item) throw new Error(`${chave}: recibo incompleto.`);
    return item;
  };
  if (recibo.length !== m.operacoes.length || porChave.size !== recibo.length)
    throw new Error("Recibo diverge das operações aprovadas.");
  const provas = new Map<string, Prova>();
  const registrar = (tabela: Tabela, linha: Consulta) => {
    provas.set(`${tabela}:${linha.id}`, { tabela, id: linha.id, hash: digerir(linha.snapshot) });
    return JSON.parse(linha.snapshot) as Linha;
  };
  const carregar = async (tabela: Tabela, filtro: "id" | "animalId" | "genitorId" | "partoId" | "exameId", ids: string[] | null) => {
    if (ids && !ids.length) return [];
    const t = Prisma.raw(`"${tabela}"`);
    const onde = ids ? Prisma.sql`WHERE ${Prisma.raw(`"${filtro}"`)} = ANY(${ids}::text[])` : Prisma.empty;
    const linhas = await tx.$queryRaw<Consulta[]>`SELECT id, to_jsonb(t)::text AS snapshot FROM pecuaria.${t} AS t ${onde}`;
    return linhas.map(l => registrar(tabela, l));
  };
  const grupos = new Map<Tabela, string[]>();
  for (const op of m.operacoes) {
    const { entidade, id } = resolver(op.chave);
    if (entidade !== entidadePorTipo[op.tipo] || ("id" in op && op.id !== id))
      throw new Error(`${op.chave}: identidade de destino no recibo diverge da decisão.`);
    grupos.set(entidade, [...(grupos.get(entidade) ?? []), id]);
  }
  const ids = <T extends Operacao["tipo"]>(tipo: T) => m.operacoes.filter(op => op.tipo === tipo).map(op => resolver(op.chave).id);
  const novosAnimais = ids("ANIMAL"), novosGenitores = ids("GENITOR"), exames = ids("DIAGNOSTICO");
  const fatos = new Map<string, Linha>();
  for (const [tabela, lista] of grupos) {
    for (const linha of await carregar(tabela, "id", lista)) fatos.set(`${tabela}:${linha.id}`, linha);
  }
  const crias = await carregar("CriaParto", "partoId", ids("PARTO"));
  const composicoes = await carregar("ComposicaoRacial", "animalId", novosAnimais);
  const composicoesGenitores = await carregar("ComposicaoGenitorExterno", "genitorId", novosGenitores);
  const baixas = [...fatos.entries()].filter(([k]) => k.startsWith("BaixaAnimal:")).map(([, b]) => b);
  const idsString = (linhas: Linha[], campo: string) => linhas.flatMap(l => typeof l[campo] === "string" ? [l[campo]] : []);
  const locais = [...await carregar("LocalizacaoAnimal", "animalId", novosAnimais), ...await carregar("LocalizacaoAnimal", "id", idsString(baixas, "localizacaoFechadaId"))];
  const destinos = [...await carregar("FinalidadeAnimal", "animalId", novosAnimais), ...await carregar("FinalidadeAnimal", "id", idsString(baixas, "destinoFechadoId"))];
  const avaliacoes = await carregar("AvaliacaoReprodutiva", "id", exames);
  await carregar("InterpretacaoReprodutiva", "exameId", exames);
  await carregar("ResultadoExame", "exameId", exames);
  const correcoesPeso = m.operacoes.filter(o => o.tipo === "CORRIGIR_PESO");
  const revogacoes = await carregar("VinculoPesagemSecagem", "id", correcoesPeso.map(o => o.vinculoAntigoId));
  const lactacoesAntigas = await carregar("LactacaoAnimal", "id", correcoesPeso.map(o => o.lactacaoAntigaId));
  await carregar("ParticipacaoBezerreiro", "id", null);
  await carregar("PerfilBezerreiro", "id", null);

  const origens = m.operacoes.map(op => chaveVinculo(m.origem, op));
  const operacionaisIatf = m.operacoes.flatMap((op, i) => op.tipo === "DOCUMENTO_IATF"
    ? [{ ...origens[i], tabelaOrigem: op.chave.split(":")[0] }] : []);
  const vinculos = await tx.vinculoImportacaoPecuaria.findMany({ where: { OR: [...origens, ...operacionaisIatf] } });
  await carregar("VinculoImportacaoPecuaria", "id", vinculos.map(v => v.id));
  const mapaVinculos = new Map(vinculos.map(v => [`${v.tabelaOrigem}:${v.chaveOrigem}`, v]));

  for (const [i, op] of m.operacoes.entries()) {
    const r = resolver(op.chave);
    const atual = fatos.get(`${r.entidade}:${r.id}`);
    const esperado = origens[i];
    const chaveOrigem = `${esperado.tabelaOrigem}:${esperado.chaveOrigem}`;
    const vinculo = mapaVinculos.get(chaveOrigem);
    if (!vinculo || vinculo.destinoId !== r.id || vinculo.entidadeDestino !== r.entidade || vinculo.hashOrigem !== hashFonte(op))
      throw new Error(`${op.chave}: vínculo, destino ou hash de origem alterado após o lote.`);
    verificarCampos(op.chave, atual, { id: r.id });
    const checar = (campos: Linha) => verificarCampos(op.chave, atual, campos);
    if ("animalId" in op && !["VINCULAR_PESO_PARTO", "ASSOCIAR_SECAGEM", "CORRIGIR_ANIMAL"].includes(op.tipo)) checar({ animalId: op.animalId });
    if ("propriedadeId" in op && !["BAIXA", "VINCULAR_PESO_PARTO", "CORRIGIR_ANIMAL"].includes(op.tipo)) checar({ propriedadeId: op.propriedadeId });
    if ("data" in op && ["PESO", "CORRIGIR_PESO", "PARTO", "TENTATIVA", "DIAGNOSTICO", "BAIXA", "APLICACAO"].includes(op.tipo)) checar({ data: op.data });
    switch (op.tipo) {
      case "GENITOR":
        checar({ ideagriId: Number(op.chave.split(":")[1]), sexo: op.dados.sexo, nome: op.dados.nome, codigo: op.dados.codigo ?? null, criadoPorId: m.autorId });
        verificarComposicao(op.chave, composicoesGenitores.filter(l => l.genitorId === r.id), op.dados.composicao);
        break;
      case "ANIMAL":
        checar({ ideagriId: Number(op.chave.split(":")[1]), brinco: op.dados.brinco, nome: op.dados.nome ?? null,
          sexo: op.dados.sexo, dataNascimento: op.dados.dataNascimento, dataEntrada: op.dados.dataEntrada,
          maeId: op.dados.maeId ?? null, paiId: op.dados.paiId ?? null, maeExternaId: op.dados.maeExternaId ?? null,
          paiExternoId: op.dados.paiExternoId ?? null, criadoPorId: m.autorId });
        verificarCampos(op.chave, locais.find(l => l.animalId === r.id && l.desde === op.dados.dataEntrada),
          { propriedadeId: op.dados.propriedadeId, loteId: op.dados.loteId ?? null, ate: null });
        verificarCampos(op.chave, destinos.find(l => l.animalId === r.id && l.desde === op.dados.dataEntrada), { aptidao: op.dados.aptidao, ate: null });
        verificarComposicao(op.chave, composicoes.filter(l => l.animalId === r.id), op.dados.composicao);
        break;
      case "CORRIGIR_ANIMAL":
        checar(op.dados);
        break;
      case "PESO":
        checar({ pesoKg: op.pesoKg, tipo: op.categoria, precisao: op.precisao, contextoHistorico: op.contexto, origem: "MANUAL" });
        break;
      case "CORRIGIR_PESO": {
        checar({ pesoKg: op.pesoKg, tipo: "SECAGEM", contextoHistorico: "INTERNO" });
        const revogado = revogacoes.find(l => l.id === op.vinculoAntigoId);
        verificarCampos(op.chave, revogado, { lactacaoId: op.lactacaoAntigaId, pesagemId: r.id, revogadoPorId: m.autorId });
        const evid = revogado?.evidenciaSnapshot as { lactacao?: { encerradaEm?: string } } | undefined;
        const encerramentoAntigo = evid?.lactacao?.encerradaEm;
        if (!revogado?.revogadoEm || !encerramentoAntigo) throw new Error(`${op.chave}: revogação ou encerramento anterior não comprovado.`);
        verificarCampos(op.chave, lactacoesAntigas.find(l => l.id === op.lactacaoAntigaId), { encerradaEm: encerramentoAntigo });
        break;
      }
      case "ASSOCIAR_SECAGEM":
        checar({ lactacaoId: op.lactacaoId, pesagemId: resolver(op.pesoChave).id, revogadoEm: null });
        break;
      case "PARTO": {
        checar({ tipo: op.categoria, desfecho: "NASCIMENTO", status: "VALIDO", assistenciaDescricao: op.assistencia });
        verificarHorario(op.chave, atual?.ocorridoEm, op.ocorridoEm, true);
        const atuais = crias.filter(c => c.partoId === r.id);
        if (atuais.length !== op.crias.length) throw new Error(`${op.chave}: quantidade de crias identificadas alterada após o lote.`);
        for (const c of op.crias) verificarCampos(op.chave, atuais.find(a => a.ordem === c.ordem), { animalId: c.animalId, sexo: c.sexo, viva: true });
        break;
      }
      case "TENTATIVA":
        checar({ tipo: "IA", ciclo: op.ciclo, ordem: op.ordem, quantidade: op.quantidade === null ? null : Number(op.quantidade),
          origemMaterial: "HISTORICO", movimentoEstoqueId: null, touroExternoId: op.genitorChave ? resolver(op.genitorChave).id : null });
        break;
      case "DIAGNOSTICO":
        checar({ status: "VALIDO", anotacaoOriginal: JSON.stringify(op.fonte) });
        verificarCampos(op.chave, avaliacoes.find(a => a.id === r.id), { resultado: op.resultado, sexoFetal: op.sexoFetal, tentativaId: null, gestacaoId: null });
        break;
      case "LACTACAO":
        checar({ partoId: op.partoId, inicio: op.data, encerradaEm: null });
        break;
      case "ENCERRAR_LACTACAO":
        checar({ encerradaEm: op.data, motivoEncerramento: op.motivoOrigem, versao: op.versaoEsperada + 1 });
        break;
      case "BAIXA":
        checar({ tipo: mapBaixaIdeagri(op.motivoOrigem, Number(op.fonte.CDTIPOBAIXA)).tipo, estornadaEm: null });
        verificarCampos(op.chave, locais.find(l => l.id === atual?.localizacaoFechadaId), { animalId: op.animalId, propriedadeId: op.propriedadeId, ate: op.data });
        verificarCampos(op.chave, destinos.find(l => l.id === atual?.destinoFechadoId), { animalId: op.animalId, ate: op.data });
        break;
      case "APLICACAO":
        checar({ produtoId: op.produtoId, nomeProdutoAplicado: op.nomeProduto, origem: "IDEAGRI", origemInsumo: "HISTORICO_IMPORTADO",
          dose: null, estadoCarenciaLeite: "NAO_INFORMADO", estadoCarenciaCarne: "NAO_INFORMADO", movimentoEstoqueId: null });
        verificarHorario(op.chave, atual?.aplicadaEm, op.aplicadaEm, false);
        break;
      case "DOCUMENTO_IATF":
        checar({ entidade: "IatfHistoricoIDEAGRI", entidadeId: `${m.origem}:${op.chave}`, acao: "IMPORTACAO_DOCUMENTAL", usuarioId: m.autorId });
        if (mapaVinculos.has(op.chave)) throw new Error(`${op.chave}: documentação recebeu vínculo operacional após o lote.`);
        break;
      case "VINCULAR_PESO_PARTO":
        checar({ partoId: op.partoId, pesagemId: resolver(op.pesoChave).id, sujeito: op.criaChave ? "CRIA" : "MATRIZ", revogadoEm: null });
        if (op.criaChave) verificarCampos(op.chave, crias.find(c => c.id === atual?.criaId), { animalId: resolver(op.criaChave).id });
        break;
    }
  }
  return [...provas.values()].sort((a, b) => a.tabela.localeCompare(b.tabela) || a.id.localeCompare(b.id));
}

export function conferirEstadoFinal(esperado: Prova[], atual: Prova[]) {
  const porId = new Map(esperado.map(p => [`${p.tabela}:${p.id}`, p.hash]));
  for (const p of atual) {
    const id = `${p.tabela}:${p.id}`;
    if (porId.get(id) !== p.hash) throw new Error(`${id}: registro incluído ou alterado após o lote.`);
    porId.delete(id);
  }
  if (porId.size) throw new Error(`${porId.keys().next().value}: registro ausente após o lote.`);
}
