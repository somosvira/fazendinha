// Importador da carga inicial da Pecuária v1 (domínio Rebanho).
//
// Consome `server/prisma/pecuaria_v1.json` (gerado por `scripts/build-pecuaria-json.mjs`
// a partir do dump do IDEAGRI — ver `scripts/pecuaria-dump.sql` / `scripts/extract-pecuaria.sh`)
// e popula o schema novo `pecuaria` (Animal/Raca/ComposicaoRacial/Lote/LocalizacaoAnimal/
// DestinoAnimal/BaixaAnimal/MotivoBaixa/Pesagem), sem tocar no legado.
//
// CARGA ÚNICA (não sincroniza): o IDEAGRI só serve de base para a carga inicial — depois
// disso todo movimento é feito no próprio sistema. Por isso, animal que já existe (por
// `ideagriId`) é ignorado por inteiro: não atualiza dados fixos, não atualiza composição
// racial e não cria localização/destino/baixa/pesagem para ele. Só quando o animal não
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
//   1) `pnpm --filter rionovo-server run seed:pecuaria`   → Raca/MotivoBaixa (não cria Propriedade)
//   2) `pnpm --filter rionovo-server run import:pecuaria` → importa server/prisma/pecuaria_v1.json
//      (Propriedade é criada aqui mesmo, pelo nome que vem no JSON — ver bloco "Propriedades" abaixo)
//   3) `pnpm --filter rionovo-server run validar:pecuaria`
//
// Regra de unicidade de brinco (ativos por sítio) é do app (services/pecuaria/rebanho), não
// do banco: aqui NÃO bloqueamos brinco duplicado — só relatamos, porque é dado histórico do
// IDEAGRI (que não tinha essa regra).

import { readFileSync } from "node:fs";
import { Prisma, type TipoBaixa, type ClasseMotivoBaixa } from "@prisma/client";
import { prisma } from "../src/db.js";
import { parseGrauSangue, normalizarComposicao, type FracaoRaca } from "../src/services/pecuaria/rebanho/composicao.calc.js";
import { avaliarCategoria } from "../src/services/pecuaria/rebanho/categoria.calc.js";
import { carregarRegras } from "../src/services/pecuaria/rebanho/categorias.js";
import { motivoAceito } from "../src/services/pecuaria/rebanho/baixa.calc.js";
import { normalizarBrinco } from "../src/services/pecuaria/rebanho/brinco.calc.js";

// ---- Contrato do JSON (scripts/build-pecuaria-json.mjs) -------------------

interface ComposicaoJson {
  sigla: string;
  fracao64: number;
}

interface BaixaJson {
  data: string;
  /** ANIMAL.CDTIPOBAIXA (1 Voluntária, 2 Descarte involuntário, 3 Morte); null quando não informado */
  tipoIdeagri: number | null;
  motivoIdeagriId: number | null;
  motivoNome: string | null;
}

interface PesagemJson {
  ideagriId: number;
  data: string;
  pesoKg: number | null;
  tipoIdeagri: string | null;
}

/** ANIMALPERIODO aberto (DATAFIM null) mais recente do animal — só tipo + início, ver periodoAbertoDe() no builder. */
interface PeriodoAbertoJson {
  /** ANIMALPERIODO.TIPO: 1 Doadora, 2 Receptora, 3 Descarte (interpretado por papelDoPeriodo() abaixo). */
  tipo: number | null;
  dataInicio: string;
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
  /** ANIMAL.BRINCOELETRONICO / SISBOV — normalizados (trim, vazio → null) pelo builder; @unique no schema. */
  brincoEletronico: string | null;
  sisbov: string | null;
  partosAntesDaEntrada: number;
  /** ANIMAL.CDCATEGORIA (1–7); vira categoria manual quando diverge do cálculo */
  ideagriCategoria?: number | null;
  propriedadeNome: string;
  loteNome: string | null;
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA";
  /** Reserva (aberto) — só define o papel inicial quando presente; ver papelDoPeriodo(). */
  periodoAberto: PeriodoAbertoJson | null;
  aptidao: "LEITE" | "CORTE";
  composicao: ComposicaoJson[];
  racaTexto?: string | null;
  baixa: BaixaJson | null;
  pesagens: PesagemJson[];
}

interface PecuariaJson {
  geradoEm: string;
  propriedades: { nome: string }[];
  lotes: { nome: string; propriedadeNome: string; ideagriGrupo?: string | null }[];
  racas: { ideagriId: number; sigla: string; nome: string }[];
  motivosBaixa: { ideagriId: number; nome: string }[];
  /** catálogo TIPOBAIXA (1 Voluntária, 2 Descarte involuntário, 3 Morte) — só referência, não consumido diretamente */
  tiposBaixa: { ideagriId: number; nome: string }[];
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

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Nomes de MOTIVOBAIXA que só repetem o tipo da baixa (não informam causa/destino além do óbvio) —
// não viram MotivoBaixa no catálogo e nunca são linkados a uma baixa (mapBaixaIdeagri já cobre o tipo).
function tipoRepetidoPeloNome(motivoNome: string | null): TipoBaixa | null {
  const n = semAcento(motivoNome ?? "");
  if (n.includes("venda")) return "VENDA";
  if (n.includes("abate")) return "ABATE";
  if (n.includes("doacao")) return "DOACAO";
  if (n.includes("cadastro indevido")) return "CADASTRO_INDEVIDO";
  return null;
}

/**
 * Deriva o `TipoBaixa` e se o motivo do catálogo deve ser usado, a partir do nome do motivo
 * (ANIMAL.CDMOTIVOBAIXA → MOTIVOBAIXA.DESCRICAO) e do tipo do IDEAGRI (ANIMAL.CDTIPOBAIXA,
 * independente do motivo). Quando o nome já repete o tipo (venda/abate/doação/cadastro indevido),
 * o motivo não agrega nada — `usarMotivo: false`. Nos demais casos o tipo vem do CDTIPOBAIXA:
 * 3 = morte, 1 ou 2 = descarte (tratado como venda), null = sem informação (catálogo do IDEAGRI
 * é majoritariamente causas de morte) — e o motivo é usado como causa/observação.
 */
export function mapBaixaIdeagri(motivoNome: string | null, tipoIdeagri: number | null): { tipo: TipoBaixa; usarMotivo: boolean } {
  const repetido = tipoRepetidoPeloNome(motivoNome);
  if (repetido) return { tipo: repetido, usarMotivo: false };
  if (tipoIdeagri === 3) return { tipo: "MORTE", usarMotivo: true };
  if (tipoIdeagri === 1 || tipoIdeagri === 2) return { tipo: "VENDA", usarMotivo: true };
  return { tipo: "MORTE", usarMotivo: true };
}

const d = (s: string): Date => new Date(`${s}T00:00:00Z`);

/**
 * ANIMALPERIODO.TIPO → papelReprodutivo inicial do DestinoAnimal (C5): 1 Doadora, 2 Receptora.
 * 3 (Descarte) ainda não tem representação no schema v1 — vira NENHUM por ora (Descarte entra na v4).
 * Tipo desconhecido ou período ausente devolve `null`: quem chama cai no fallback do setor (heurística do builder).
 */
function papelDoPeriodo(periodo: PeriodoAbertoJson | null): "NENHUM" | "RECEPTORA" | "DOADORA" | null {
  if (!periodo) return null;
  if (periodo.tipo === 1) return "DOADORA";
  if (periodo.tipo === 2) return "RECEPTORA";
  if (periodo.tipo === 3) return "NENHUM"; // Descarte entra na v4
  return null;
}

interface Contadores {
  criadas: number;
  atualizadas: number;
  ignoradas: number;
}
const novoContador = (): Contadores => ({ criadas: 0, atualizadas: 0, ignoradas: 0 });

async function main() {
  const dados: PecuariaJson = JSON.parse(readFileSync(new URL("./pecuaria_v1.json", import.meta.url), "utf-8"));
  console.log(`Lendo carga da pecuária (geradoEm ${dados.geradoEm}): ${dados.animais.length} animais.`);
  // categoria calculada na carga usa a data da extração, não a data de hoje (senão animais perto
  // de uma borda de idade — ex. 12 meses — ganhariam categoria manual errada por causa do atraso
  // entre a extração e a rodada do importador).
  const geradoEmData = d(dados.geradoEm);

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

  // ---- Motivos de baixa: por ideagriId, fallback por nome ------------------
  // Nomes que só repetem o tipo (venda/abate/doação/cadastro indevido) não viram MotivoBaixa —
  // mapBaixaIdeagri já resolve o tipo por eles; o catálogo fica só com causas/descartes de fato.
  const motivoIdPorIdeagriId = new Map<number, string>();
  const motivoIdPorNome = new Map<string, string>();
  const motivoClassePorId = new Map<string, ClasseMotivoBaixa>();
  const cMotivo = novoContador();
  let motivosPuladosPorTipo = 0;
  const motivosExistentes = await prisma.motivoBaixa.findMany();
  for (const m of motivosExistentes) {
    if (m.ideagriId != null) motivoIdPorIdeagriId.set(m.ideagriId, m.id);
    motivoIdPorNome.set(m.nome.trim().toLowerCase(), m.id);
    motivoClassePorId.set(m.id, m.classe);
  }

  // classe do motivo novo = tipoIdeagri mais comum entre os animais do JSON que o usam
  // (1→DESCARTE_VOLUNTARIO, 2→DESCARTE_INVOLUNTARIO, 3→MORTE; empate prefere o menor código; sem uso → MORTE)
  const contagemTipoPorMotivoIdeagri = new Map<number, Partial<Record<1 | 2 | 3, number>>>();
  for (const a of dados.animais) {
    if (!a.baixa || a.baixa.motivoIdeagriId == null || a.baixa.tipoIdeagri == null) continue;
    const t = a.baixa.tipoIdeagri;
    if (t !== 1 && t !== 2 && t !== 3) continue;
    const mapa = contagemTipoPorMotivoIdeagri.get(a.baixa.motivoIdeagriId) ?? {};
    mapa[t] = (mapa[t] ?? 0) + 1;
    contagemTipoPorMotivoIdeagri.set(a.baixa.motivoIdeagriId, mapa);
  }
  function classeMajoritaria(motivoIdeagriId: number): ClasseMotivoBaixa {
    const contagem = contagemTipoPorMotivoIdeagri.get(motivoIdeagriId) ?? {};
    const ordem: Array<[1 | 2 | 3, ClasseMotivoBaixa]> = [
      [1, "DESCARTE_VOLUNTARIO"],
      [2, "DESCARTE_INVOLUNTARIO"],
      [3, "MORTE"],
    ];
    let melhor: ClasseMotivoBaixa = "MORTE";
    let melhorCount = 0;
    for (const [tipoIdeagri, classe] of ordem) {
      const c = contagem[tipoIdeagri] ?? 0;
      if (c > melhorCount) {
        melhorCount = c;
        melhor = classe;
      }
    }
    return melhorCount > 0 ? melhor : "MORTE";
  }

  for (const m of dados.motivosBaixa) {
    if (tipoRepetidoPeloNome(m.nome)) {
      motivosPuladosPorTipo++;
      continue;
    }
    if (motivoIdPorIdeagriId.has(m.ideagriId)) {
      cMotivo.ignoradas++;
      continue;
    }
    const porNome = m.nome ? motivoIdPorNome.get(m.nome.trim().toLowerCase()) : undefined;
    if (porNome) {
      // já existe por nome (seed) — só linka o ideagriId; classe existente não muda
      const salvo = await prisma.motivoBaixa.update({ where: { id: porNome }, data: { ideagriId: m.ideagriId } });
      motivoIdPorIdeagriId.set(m.ideagriId, salvo.id);
      motivoClassePorId.set(salvo.id, salvo.classe);
      cMotivo.ignoradas++;
      continue;
    }
    const classe = classeMajoritaria(m.ideagriId);
    const criado = await prisma.motivoBaixa.create({ data: { ideagriId: m.ideagriId, nome: m.nome ?? `Motivo ${m.ideagriId}`, classe, ativo: true } });
    motivoIdPorIdeagriId.set(m.ideagriId, criado.id);
    motivoClassePorId.set(criado.id, criado.classe);
    motivoIdPorNome.set(criado.nome.trim().toLowerCase(), criado.id);
    cMotivo.criadas++;
  }

  function resolverMotivoId(baixa: BaixaJson): string | null {
    if (baixa.motivoIdeagriId != null && motivoIdPorIdeagriId.has(baixa.motivoIdeagriId)) {
      return motivoIdPorIdeagriId.get(baixa.motivoIdeagriId)!;
    }
    if (baixa.motivoNome) {
      const id = motivoIdPorNome.get(baixa.motivoNome.trim().toLowerCase());
      if (id) return id;
    }
    return null;
  }

  // ---- Animais ---------------------------------------------------------------
  // Carga única: animal que já existe (por `ideagriId`) é ignorado por inteiro —
  // não atualiza dados fixos/composição e não cria localização/destino/baixa/pesagem.
  // Cada animal roda na própria transação; falha em um não impede os demais.
  const cAnimal = novoContador();
  const cLocalizacao = novoContador();
  const cDestino = novoContador();
  const cBaixa = novoContador();
  const cPesagem = novoContador();
  const cComposicao = novoContador();
  let semComposicao = 0;
  let baixasSemMotivo = 0;
  let fracoesRacaPerdidas = 0; // itens de composição com sigla não resolvida (raça não semeada nem no JSON)
  let papelPorPeriodo = 0; // DestinoAnimal.papelReprodutivo inicial veio do ANIMALPERIODO aberto, não do setor

  interface Falha { brinco: string; ideagriId: number; mensagem: string }
  const falhas: Falha[] = [];

  type ResultadoAnimal =
    | { tipo: "ignorado" }
    | { tipo: "propriedade-nao-resolvida" }
    | { tipo: "criado"; temComposicao: boolean; baixaCriada: boolean; pesagensCriadas: number };

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

        // ---- Brinco eletrônico / SISBOV: @unique no schema — conflito não aborta o animal,
        // ele entra sem o dado conflitante e o conflito vira aviso (dado histórico do IDEAGRI,
        // que não tinha essa restrição). Processado em ordem, então um conflito entre dois
        // animais do próprio JSON também é pego aqui (o primeiro já foi commitado).
        let brincoEletronico = a.brincoEletronico;
        if (brincoEletronico) {
          const conflito = await tx.animal.findFirst({ where: { brincoEletronico }, select: { brinco: true } });
          if (conflito) {
            avisos.push(`Animal ${a.brinco} (ideagriId ${a.ideagriId}): brincoEletronico "${brincoEletronico}" já usado pelo animal "${conflito.brinco}" — importado sem esse dado`);
            brincoEletronico = null;
          }
        }
        let sisbov = a.sisbov;
        if (sisbov) {
          const conflito = await tx.animal.findFirst({ where: { sisbov }, select: { brinco: true } });
          if (conflito) {
            avisos.push(`Animal ${a.brinco} (ideagriId ${a.ideagriId}): SISBOV "${sisbov}" já usado pelo animal "${conflito.brinco}" — importado sem esse dado`);
            sisbov = null;
          }
        }

        const dadosFixos = {
          brinco: a.brinco,
          nome: a.nome ?? null,
          sexo: a.sexo,
          dataNascimento: d(a.dataNascimento),
          nascimentoEstimado: a.nascimentoEstimado,
          origem: a.origem,
          dataEntrada: d(a.dataEntrada),
          brincoEletronico,
          sisbov,
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
        // raça referenciada na composição mas sem Raca correspondente (nem semeada, nem criada
        // automaticamente acima) — não trunca em silêncio: avisa por animal e conta no relatório.
        const racaNaoResolvida = compositoDesejado.filter((c) => !racaIdPorSigla.has(c.sigla));
        for (const c of racaNaoResolvida) {
          avisos.push(`Animal ${a.brinco} (ideagriId ${a.ideagriId}): raça "${c.sigla}" não resolvida — fração ${c.fracao64}/64 perdida da composição`);
        }
        fracoesRacaPerdidas += racaNaoResolvida.length;
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
        // papelReprodutivo: prefere o ANIMALPERIODO aberto (fonte melhor que o nome do setor);
        // sem período resolvido, cai na heurística do builder (papelReprodutivoDe, pelo SETOR).
        const papelPeriodo = papelDoPeriodo(a.periodoAberto);
        if (papelPeriodo != null) papelPorPeriodo++;
        const papelReprodutivo = papelPeriodo ?? a.papelReprodutivo;
        const localizacaoInicial = await tx.localizacaoAnimal.create({
          data: { animalId: animal.id, propriedadeId, loteId, desde: d(a.dataEntrada) },
        });
        const destinoInicial = await tx.destinoAnimal.create({
          data: { animalId: animal.id, aptidao: a.aptidao, papelReprodutivo, desde: d(a.dataEntrada) },
        });

        // ---- Baixa (fecha a localização/destino recém-criados) ---------------
        let baixaCriada = false;
        if (a.baixa) {
          const { tipo, usarMotivo } = mapBaixaIdeagri(a.baixa.motivoNome, a.baixa.tipoIdeagri);
          let motivoId = usarMotivo ? resolverMotivoId(a.baixa) : null;
          // motivo resolvido mas de classe incompatível com o tipo (ex.: causa de morte numa baixa por venda) — não usa
          if (motivoId) {
            const classe = motivoClassePorId.get(motivoId);
            if (!classe || !motivoAceito(tipo, classe)) motivoId = null;
          }
          if (!motivoId) baixasSemMotivo++;

          await tx.localizacaoAnimal.update({ where: { id: localizacaoInicial.id }, data: { ate: d(a.baixa.data) } });
          await tx.destinoAnimal.update({ where: { id: destinoInicial.id }, data: { ate: d(a.baixa.data) } });

          await tx.baixaAnimal.create({
            data: {
              animalId: animal.id,
              data: d(a.baixa.data),
              tipo,
              motivoId,
              observacao: a.baixa.motivoNome ? `IDEAGRI: ${a.baixa.motivoNome}` : null,
              // o estorno reabre exatamente estas linhas
              localizacaoFechadaId: localizacaoInicial.id,
              destinoFechadoId: destinoInicial.id,
            },
          });
          baixaCriada = true;
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
          const calculada = avaliarCategoria({ sexo: a.sexo, dataNascimento: d(a.dataNascimento), partos: a.partosAntesDaEntrada }, regrasCategoria, null, geradoEmData).calculada;
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

        return { tipo: "criado", temComposicao, baixaCriada, pesagensCriadas };
      });

      if (resultado.tipo === "criado") {
        cAnimal.criadas++;
        cLocalizacao.criadas++;
        cDestino.criadas++;
        if (resultado.temComposicao) cComposicao.criadas++;
        else { cComposicao.ignoradas++; semComposicao++; }
        if (resultado.baixaCriada) cBaixa.criadas++;
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
  const baixasAbertas = new Set(
    (await prisma.baixaAnimal.findMany({ where: { estornadaEm: null }, select: { animalId: true } })).map((s) => s.animalId),
  );
  const porSitioBrinco = new Map<string, number>();
  for (const l of localizacoesAbertas) {
    if (baixasAbertas.has(l.animal.id)) continue;
    const chave = `${l.propriedadeId}\u0000${normalizarBrinco(l.animal.brinco)}`;
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
  console.log(`Motivos baixa — criados: ${cMotivo.criadas}, ignorados: ${cMotivo.ignoradas}, pulados (só repetem o tipo): ${motivosPuladosPorTipo}`);
  console.log(`Animais       — criados: ${cAnimal.criadas}, ignorados (já existiam): ${cAnimal.ignoradas}`);
  console.log(`Composição    — criada: ${cComposicao.criadas}, sem composição: ${cComposicao.ignoradas}`);
  console.log(`Localização   — criadas: ${cLocalizacao.criadas}, ignoradas: ${cLocalizacao.ignoradas}`);
  console.log(`Destino       — criados: ${cDestino.criadas}, ignorados: ${cDestino.ignoradas}`);
  console.log(`Baixas        — criadas: ${cBaixa.criadas}, ignoradas: ${cBaixa.ignoradas}, sem motivo resolvido: ${baixasSemMotivo}`);
  console.log(`Pesagens      — criadas: ${cPesagem.criadas}, ignoradas: ${cPesagem.ignoradas}`);
  console.log(`Animais sem composição racial: ${semComposicao}`);
  console.log(`Frações de composição perdidas (raça não resolvida): ${fracoesRacaPerdidas}`);
  console.log(`Papel reprodutivo inicial vindo do ANIMALPERIODO aberto: ${papelPorPeriodo}`);
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
