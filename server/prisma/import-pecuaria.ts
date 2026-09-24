// Importador da carga inicial da Pecuária v1 (domínio Rebanho).
//
// Consome `server/prisma/pecuaria_v1.json` (gerado por `scripts/build-pecuaria-json.mjs`
// a partir do dump do IDEAGRI — ver `scripts/pecuaria-dump.sql` / `scripts/extract-pecuaria.sh`)
// e popula o schema novo `pecuaria` (Animal/Raca/ComposicaoRacial/Lote/LocalizacaoAnimal/
// DestinoAnimal/SaidaAnimal/MotivoSaida/Pesagem), sem tocar no legado.
//
// CARGA ÚNICA (não sincroniza): o IDEAGRI só serve de base para a carga inicial — depois
// disso todo movimento é feito no próprio sistema. Por isso, animal que já existe (por
// `ideagriId`) é ignorado por inteiro: não atualiza dados fixos, não atualiza composição
// racial e não cria localização/destino/saída/pesagem para ele. Só quando o animal não
// existe ainda é que ele (e todo o seu histórico do JSON) é criado. Rodar de novo sobre um
// banco já carregado é seguro — não duplica nada, mas também não traz atualizações do
// IDEAGRI para animais já importados.
//
// Cada animal roda na sua própria transação, dentro de um `try/catch`: se um animal falhar,
// o erro (brinco, ideagriId, mensagem) vai para o relatório final e o script continua para
// os demais. Se houve alguma falha, o processo termina com código de saída 1 — os detalhes
// aparecem no relatório (`Falhas`) impresso antes da saída.
//
// Ordem recomendada:
//   1) `pnpm --filter rionovo-server run seed:pecuaria`   → Raca/MotivoSaida/Propriedade base
//   2) `pnpm --filter rionovo-server run import:pecuaria` → importa server/prisma/pecuaria_v1.json
//   3) `pnpm --filter rionovo-server run validar:pecuaria`
//
// Regra de unicidade de brinco (ativos por sítio) é do app (services/pecuaria/rebanho), não
// do banco: aqui NÃO bloqueamos brinco duplicado — só relatamos, porque é dado histórico do
// IDEAGRI (que não tinha essa regra).

import { readFileSync } from "node:fs";
import { Prisma, type TipoSaidaAnimal } from "@prisma/client";
import { prisma } from "../src/db.js";
import { parseGrauSangue, normalizarComposicao, type FracaoRaca } from "../src/services/pecuaria/rebanho/composicao.calc.js";
import { avaliarCategoria } from "../src/services/pecuaria/rebanho/categoria.calc.js";
import { carregarRegras } from "../src/services/pecuaria/rebanho/categorias.js";

// ---- Contrato do JSON (scripts/build-pecuaria-json.mjs) -------------------

interface ComposicaoJson {
  sigla: string;
  fracao64: number;
}

interface SaidaJson {
  data: string;
  motivoIdeagriId: number | null;
  motivoNome: string | null;
}

interface PesagemJson {
  ideagriId: number;
  data: string;
  pesoKg: number | null;
  tipoIdeagri: string | null;
}

interface AnimalJson {
  ideagriId: number;
  brinco: string;
  nome: string | null;
  sexo: "F" | "M";
  dataNascimento: string;
  nascimentoEstimado: boolean;
  origem: "NASCIDO" | "COMPRADO";
  dataEntrada: string;
  partosAntesDaEntrada: number;
  /** ANIMAL.CDCATEGORIA (1–7); vira categoria manual quando diverge do cálculo */
  ideagriCategoria?: number | null;
  propriedadeNome: string;
  loteNome: string | null;
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA";
  aptidao: "LEITE" | "CORTE";
  composicao: ComposicaoJson[];
  racaTexto?: string | null;
  saida: SaidaJson | null;
  pesagens: PesagemJson[];
}

interface PecuariaJson {
  geradoEm: string;
  propriedades: { nome: string }[];
  lotes: { nome: string; propriedadeNome: string; ideagriGrupo?: string | null }[];
  racas: { ideagriId: number; sigla: string; nome: string }[];
  motivosSaida: { ideagriId: number; nome: string }[];
  animais: AnimalJson[];
}

// tipo de pesagem: mapeamento simples do texto livre do IDEAGRI
function mapTipoPesagem(tipoIdeagri: string | null): "NASCIMENTO" | "ENTRADA" | "DESMAMA" | "ROTINA" | "SAIDA" {
  const t = (tipoIdeagri ?? "").trim().toUpperCase();
  if (t.includes("NASC")) return "NASCIMENTO";
  if (t.includes("ENTRA")) return "ENTRADA";
  if (t.includes("DESMAM")) return "DESMAMA";
  if (t.includes("SAID") || t.includes("BAIXA")) return "SAIDA";
  return "ROTINA";
}

// tipo de saída a partir do nome do motivo (fallback quando não há ideagriId batendo em MotivoSaida)
function mapTipoSaida(motivoNome: string | null): TipoSaidaAnimal {
  const n = (motivoNome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (n.includes("venda")) return "VENDA";
  if (n.includes("abate")) return "ABATE";
  if (n.includes("doacao") || n.includes("doação")) return "DOACAO";
  if (n.includes("desconhecida") || n.includes("indefinida")) return "OUTRO";
  if (n.includes("cadastro indevido")) return "CADASTRO_INDEVIDO";
  return "MORTE";
}

const d = (s: string): Date => new Date(`${s}T00:00:00Z`);

interface Contadores {
  criadas: number;
  atualizadas: number;
  ignoradas: number;
}
const novoContador = (): Contadores => ({ criadas: 0, atualizadas: 0, ignoradas: 0 });

async function main() {
  const dados: PecuariaJson = JSON.parse(readFileSync(new URL("./pecuaria_v1.json", import.meta.url), "utf-8"));
  console.log(`Lendo carga da pecuária (geradoEm ${dados.geradoEm}): ${dados.animais.length} animais.`);

  const avisos: string[] = [];
  const brincosDuplicados: string[] = [];

  // ---- Propriedades: por nome, cria se faltar -----------------------------
  const propriedadeIdPorNome = new Map<string, number>();
  const cProp = novoContador();
  for (const p of dados.propriedades) {
    const existente = await prisma.propriedade.findUnique({ where: { nome: p.nome } });
    if (existente) {
      propriedadeIdPorNome.set(p.nome, existente.id);
      cProp.ignoradas++;
    } else {
      const criada = await prisma.propriedade.create({ data: { nome: p.nome, apelido: p.nome, ativo: true } });
      propriedadeIdPorNome.set(p.nome, criada.id);
      cProp.criadas++;
    }
  }
  // animais podem referenciar propriedades que não vieram na lista `propriedades` (defensivo)
  for (const a of dados.animais) {
    if (!propriedadeIdPorNome.has(a.propriedadeNome)) {
      const existente = await prisma.propriedade.findUnique({ where: { nome: a.propriedadeNome } });
      if (existente) {
        propriedadeIdPorNome.set(a.propriedadeNome, existente.id);
      } else {
        const criada = await prisma.propriedade.create({ data: { nome: a.propriedadeNome, apelido: a.propriedadeNome, ativo: true } });
        propriedadeIdPorNome.set(a.propriedadeNome, criada.id);
        cProp.criadas++;
      }
    }
  }

  // ---- Lotes: por (propriedade, nome) -------------------------------------
  const loteIdPorChave = new Map<string, string>(); // `${propriedadeId}\u0000${nome}` -> id
  const cLote = novoContador();
  for (const l of dados.lotes) {
    const propriedadeId = propriedadeIdPorNome.get(l.propriedadeNome);
    if (propriedadeId == null) {
      avisos.push(`Lote "${l.nome}": propriedade "${l.propriedadeNome}" não resolvida — ignorado`);
      continue;
    }
    const chave = `${propriedadeId}\u0000${l.nome}`;
    const existente = await prisma.lote.findUnique({ where: { propriedadeId_nome: { propriedadeId, nome: l.nome } } });
    if (existente) {
      loteIdPorChave.set(chave, existente.id);
      cLote.ignoradas++;
    } else {
      const criado = await prisma.lote.create({ data: { nome: l.nome, propriedadeId, ativo: true } });
      loteIdPorChave.set(chave, criado.id);
      cLote.criadas++;
    }
  }

  // ---- Raças: por sigla; cria as que faltarem como base:true (exceto GL) --
  const racaIdPorSigla = new Map<string, string>();
  const cRaca = novoContador();
  const racasExistentes = await prisma.raca.findMany();
  for (const r of racasExistentes) racaIdPorSigla.set(r.sigla, r.id);

  const siglasNecessarias = new Set<string>();
  for (const a of dados.animais) for (const c of a.composicao) siglasNecessarias.add(c.sigla);
  for (const sigla of siglasNecessarias) {
    if (racaIdPorSigla.has(sigla)) {
      cRaca.ignoradas++;
      continue;
    }
    if (sigla === "GL") {
      avisos.push(`Raça GL (Girolando) referenciada na composição mas não semeada — ignorada nessa carga`);
      continue;
    }
    const criada = await prisma.raca.create({ data: { nome: sigla, sigla, base: true, ativo: true } });
    racaIdPorSigla.set(sigla, criada.id);
    cRaca.criadas++;
    avisos.push(`Raça desconhecida criada automaticamente: sigla "${sigla}"`);
  }

  // ---- Motivos de saída: por ideagriId, fallback por nome -----------------
  const motivoIdPorIdeagriId = new Map<number, string>();
  const motivoIdPorNome = new Map<string, string>();
  const cMotivo = novoContador();
  const motivosExistentes = await prisma.motivoSaida.findMany();
  const motivoTipoPorId = new Map<string, TipoSaidaAnimal>(motivosExistentes.map((m) => [m.id, m.tipo]));
  for (const m of motivosExistentes) {
    if (m.ideagriId != null) motivoIdPorIdeagriId.set(m.ideagriId, m.id);
    motivoIdPorNome.set(m.nome.trim().toLowerCase(), m.id);
  }
  for (const m of dados.motivosSaida) {
    if (motivoIdPorIdeagriId.has(m.ideagriId)) {
      cMotivo.ignoradas++;
      continue;
    }
    const porNome = m.nome ? motivoIdPorNome.get(m.nome.trim().toLowerCase()) : undefined;
    if (porNome) {
      // já existe por nome (seed) — só linka o ideagriId
      const salvo = await prisma.motivoSaida.update({ where: { id: porNome }, data: { ideagriId: m.ideagriId } });
      motivoIdPorIdeagriId.set(m.ideagriId, salvo.id);
      cMotivo.ignoradas++;
      continue;
    }
    const tipo = mapTipoSaida(m.nome);
    const criado = await prisma.motivoSaida.create({ data: { ideagriId: m.ideagriId, nome: m.nome ?? `Motivo ${m.ideagriId}`, tipo, ativo: true } });
    motivoIdPorIdeagriId.set(m.ideagriId, criado.id);
    motivoTipoPorId.set(criado.id, criado.tipo);
    motivoIdPorNome.set(criado.nome.trim().toLowerCase(), criado.id);
    cMotivo.criadas++;
  }

  function resolverMotivoId(saida: SaidaJson): string | null {
    if (saida.motivoIdeagriId != null && motivoIdPorIdeagriId.has(saida.motivoIdeagriId)) {
      return motivoIdPorIdeagriId.get(saida.motivoIdeagriId)!;
    }
    if (saida.motivoNome) {
      const id = motivoIdPorNome.get(saida.motivoNome.trim().toLowerCase());
      if (id) return id;
    }
    return null;
  }

  // ---- Animais ---------------------------------------------------------------
  // Carga única: animal que já existe (por `ideagriId`) é ignorado por inteiro —
  // não atualiza dados fixos/composição e não cria localização/destino/saída/pesagem.
  // Cada animal roda na própria transação; falha em um não impede os demais.
  const cAnimal = novoContador();
  const cLocalizacao = novoContador();
  const cDestino = novoContador();
  const cSaida = novoContador();
  const cPesagem = novoContador();
  const cComposicao = novoContador();
  let semComposicao = 0;

  interface Falha { brinco: string; ideagriId: number; mensagem: string }
  const falhas: Falha[] = [];

  type ResultadoAnimal =
    | { tipo: "ignorado" }
    | { tipo: "propriedade-nao-resolvida" }
    | { tipo: "criado"; temComposicao: boolean; saidaCriada: boolean; pesagensCriadas: number };

  // brinco duplicado entre ativos do mesmo sítio: calculado no fim, sobre o estado final do banco.

  // categorias configuráveis: regras para o cálculo e mapa CDCATEGORIA → categoria (itens de fábrica)
  const regrasCategoria = await carregarRegras();
  const categoriaPorIdeagri = new Map(
    (await prisma.categoriaAnimal.findMany({ where: { ideagriId: { not: null } }, select: { id: true, nome: true, sexo: true, ideagriId: true } }))
      .map((c) => [c.ideagriId!, c]),
  );
  let categoriasManuaisCriadas = 0;

  for (const a of dados.animais) {
    try {
      const resultado = await prisma.$transaction<ResultadoAnimal>(async (tx) => {
        const propriedadeId = propriedadeIdPorNome.get(a.propriedadeNome);
        if (propriedadeId == null) {
          avisos.push(`Animal ${a.brinco} (ideagriId ${a.ideagriId}): propriedade "${a.propriedadeNome}" não resolvida — ignorado`);
          return { tipo: "propriedade-nao-resolvida" };
        }
        const loteId = a.loteNome ? loteIdPorChave.get(`${propriedadeId}\u0000${a.loteNome}`) ?? null : null;

        const jaExiste = await tx.animal.findUnique({ where: { ideagriId: a.ideagriId } });
        if (jaExiste) return { tipo: "ignorado" };

        const dadosFixos = {
          brinco: a.brinco,
          nome: a.nome ?? null,
          sexo: a.sexo,
          dataNascimento: d(a.dataNascimento),
          nascimentoEstimado: a.nascimentoEstimado,
          origem: a.origem,
          dataEntrada: d(a.dataEntrada),
          partosAntesDaEntrada: a.partosAntesDaEntrada,
        };
        const animal = await tx.animal.create({ data: { ideagriId: a.ideagriId, ...dadosFixos } });

        // ---- Composição racial (só existe porque o animal é novo) -----------
        let compositoDesejado: FracaoRaca[] = a.composicao.map((c) => ({ sigla: c.sigla, fracao64: c.fracao64 }));
        if (compositoDesejado.length === 0 && a.racaTexto) {
          compositoDesejado = normalizarComposicao(parseGrauSangue(a.racaTexto));
        }
        if (compositoDesejado.length === 0 && (a.racaTexto ?? "").toLowerCase().includes("girolando")) {
          compositoDesejado = [{ sigla: "GL", fracao64: 64 }];
        }
        // filtra raças não resolvidas (ex.: GL não semeada)
        compositoDesejado = compositoDesejado.filter((c) => racaIdPorSigla.has(c.sigla));
        const temComposicao = compositoDesejado.length > 0;
        if (temComposicao) {
          await tx.composicaoRacial.createMany({
            data: compositoDesejado.map((c) => ({
              animalId: animal.id,
              racaId: racaIdPorSigla.get(c.sigla)!,
              fracao64: c.fracao64,
              origem: a.composicao.length ? ("INFORMADA" as const) : ("CALCULADA" as const),
            })),
          });
        }

        // ---- Localização e destino iniciais (propriedade/lote/aptidão, desde = dataEntrada) ----
        const localizacaoInicial = await tx.localizacaoAnimal.create({
          data: { animalId: animal.id, propriedadeId, loteId, desde: d(a.dataEntrada) },
        });
        const destinoInicial = await tx.destinoAnimal.create({
          data: { animalId: animal.id, aptidao: a.aptidao, papelReprodutivo: a.papelReprodutivo, desde: d(a.dataEntrada) },
        });

        // ---- Saída (fecha a localização/destino recém-criados) ---------------
        let saidaCriada = false;
        if (a.saida) {
          const motivoId = resolverMotivoId(a.saida);
          // o tipo segue o do motivo resolvido (MotivoSaida é por tipo); sem motivo, deduz pelo texto
          const tipo = (motivoId ? motivoTipoPorId.get(motivoId) : undefined) ?? mapTipoSaida(a.saida.motivoNome);

          await tx.localizacaoAnimal.update({ where: { id: localizacaoInicial.id }, data: { ate: d(a.saida.data) } });
          await tx.destinoAnimal.update({ where: { id: destinoInicial.id }, data: { ate: d(a.saida.data) } });

          await tx.saidaAnimal.create({
            data: {
              animalId: animal.id,
              data: d(a.saida.data),
              tipo,
              motivoId,
              observacao: a.saida.motivoNome ? `IDEAGRI: ${a.saida.motivoNome}` : null,
              // o estorno reabre exatamente estas linhas
              localizacaoFechadaId: localizacaoInicial.id,
              destinoFechadoId: destinoInicial.id,
            },
          });
          saidaCriada = true;
        }

        // ---- Pesagens ----------------------------------------------------------
        let pesagensCriadas = 0;
        for (const p of a.pesagens) {
          if (p.pesoKg == null) continue;
          await tx.pesagem.create({
            data: {
              ideagriId: p.ideagriId,
              animalId: animal.id,
              data: d(p.data),
              pesoKg: new Prisma.Decimal(p.pesoKg),
              tipo: mapTipoPesagem(p.tipoIdeagri),
              origem: "MANUAL",
            },
          });
          pesagensCriadas++;
        }

        // ---- Categoria do IDEAGRI: manual quando diverge do cálculo pelas regras da fazenda ----
        const categoriaIdeagri = a.ideagriCategoria != null ? categoriaPorIdeagri.get(a.ideagriCategoria) : undefined;
        if (categoriaIdeagri && categoriaIdeagri.sexo === a.sexo) {
          const calculada = avaliarCategoria({ sexo: a.sexo, dataNascimento: d(a.dataNascimento), partos: a.partosAntesDaEntrada }, regrasCategoria, null, new Date()).calculada;
          if (calculada?.id !== categoriaIdeagri.id) {
            await tx.categoriaManualAnimal.create({
              data: { animalId: animal.id, categoriaId: categoriaIdeagri.id, desde: d(a.dataEntrada), motivo: "Categoria do IDEAGRI na carga" },
            });
            categoriasManuaisCriadas++;
          }
        }

        await tx.auditoriaPecuaria.create({
          data: { entidade: "Animal", entidadeId: animal.id, animalId: animal.id, acao: "IMPORTACAO", depois: JSON.parse(JSON.stringify(animal)) },
        });

        return { tipo: "criado", temComposicao, saidaCriada, pesagensCriadas };
      });

      if (resultado.tipo === "criado") {
        cAnimal.criadas++;
        cLocalizacao.criadas++;
        cDestino.criadas++;
        if (resultado.temComposicao) cComposicao.criadas++;
        else { cComposicao.ignoradas++; semComposicao++; }
        if (resultado.saidaCriada) cSaida.criadas++;
        cPesagem.criadas += resultado.pesagensCriadas;
      } else {
        // "ignorado" (já existia) e "propriedade-nao-resolvida" contam como ignorado
        cAnimal.ignoradas++;
      }
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      falhas.push({ brinco: a.brinco, ideagriId: a.ideagriId, mensagem });
      console.error(`Animal ${a.brinco} (ideagriId ${a.ideagriId}): falhou — ${mensagem}`);
    }
  }

  // ---- Brinco duplicado entre ativos do mesmo sítio (relatório, não bloqueia) ----
  const localizacoesAbertas = await prisma.localizacaoAnimal.findMany({
    where: { ate: null },
    select: { propriedadeId: true, animal: { select: { id: true, brinco: true } } },
  });
  const saidasAbertas = new Set(
    (await prisma.saidaAnimal.findMany({ where: { estornadaEm: null }, select: { animalId: true } })).map((s) => s.animalId),
  );
  const porSitioBrinco = new Map<string, number>();
  for (const l of localizacoesAbertas) {
    if (saidasAbertas.has(l.animal.id)) continue;
    const chave = `${l.propriedadeId}\u0000${l.animal.brinco.trim().toUpperCase()}`;
    porSitioBrinco.set(chave, (porSitioBrinco.get(chave) ?? 0) + 1);
  }
  for (const [chave, count] of porSitioBrinco) {
    if (count > 1) {
      const [propriedadeId, brinco] = chave.split("\u0000");
      brincosDuplicados.push(`sítio ${propriedadeId}: brinco "${brinco}" (${count} animais ativos)`);
    }
  }

  // ---- Relatório -----------------------------------------------------------
  console.log("\n=== Relatório da importação ===");
  console.log(`Propriedades  — criadas: ${cProp.criadas}, ignoradas: ${cProp.ignoradas}`);
  console.log(`Lotes         — criados: ${cLote.criadas}, ignorados: ${cLote.ignoradas}`);
  console.log(`Raças         — criadas: ${cRaca.criadas}, ignoradas: ${cRaca.ignoradas}`);
  console.log(`Motivos saída — criados: ${cMotivo.criadas}, ignorados: ${cMotivo.ignoradas}`);
  console.log(`Animais       — criados: ${cAnimal.criadas}, ignorados (já existiam): ${cAnimal.ignoradas}`);
  console.log(`Composição    — criada: ${cComposicao.criadas}, sem composição: ${cComposicao.ignoradas}`);
  console.log(`Localização   — criadas: ${cLocalizacao.criadas}, ignoradas: ${cLocalizacao.ignoradas}`);
  console.log(`Destino       — criados: ${cDestino.criadas}, ignorados: ${cDestino.ignoradas}`);
  console.log(`Saídas        — criadas: ${cSaida.criadas}, ignoradas: ${cSaida.ignoradas}`);
  console.log(`Pesagens      — criadas: ${cPesagem.criadas}, ignoradas: ${cPesagem.ignoradas}`);
  console.log(`Animais sem composição racial: ${semComposicao}`);
  console.log(`Categorias manuais (categoria do IDEAGRI diferente da calculada): ${categoriasManuaisCriadas}`);

  if (avisos.length) {
    console.log(`\nAvisos (${avisos.length}):`);
    for (const av of avisos) console.log(`  - ${av}`);
  }
  if (brincosDuplicados.length) {
    console.log(`\nBrincos duplicados entre ativos do mesmo sítio (${brincosDuplicados.length}) — importado mesmo assim (dado histórico; unicidade é regra do app):`);
    for (const b of brincosDuplicados) console.log(`  - ${b}`);
  }
  if (falhas.length) {
    console.log(`\nFalhas (${falhas.length}) — animal não foi importado, script continuou para os demais:`);
    for (const f of falhas) console.log(`  - brinco "${f.brinco}" (ideagriId ${f.ideagriId}): ${f.mensagem}`);
  }

  await prisma.$disconnect();

  if (falhas.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
