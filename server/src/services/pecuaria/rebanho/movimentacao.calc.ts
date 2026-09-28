// Planejamento de fechar/abrir LocalizacaoAnimal e DestinoAnimal (sem I/O).

export class MovimentacaoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovimentacaoError";
  }
}

export interface LocalizacaoAtual {
  propriedadeId: number;
  loteId: string | null;
  desde: Date | string;
}

export interface LocalizacaoDestino {
  propriedadeId: number;
  loteId: string | null;
}

export type PlanoMovimentacao =
  | { tipo: "SEM_MUDANCA" }
  | {
    tipo: "MOVER";
    fechar: { ate: Date | string } | null;
    abrir: { propriedadeId: number; loteId: string | null; desde: Date | string };
  };

function paraTempo(valor: Date | string): number {
  return (typeof valor === "string" ? new Date(valor) : valor).getTime();
}

export function planejarMovimentacao(input: {
  atual: LocalizacaoAtual | null;
  destino: LocalizacaoDestino;
  data: Date | string;
}): PlanoMovimentacao {
  const { atual, destino, data } = input;

  if (atual && paraTempo(data) < paraTempo(atual.desde)) {
    throw new MovimentacaoError("Data da movimentação não pode ser anterior ao início da localização atual");
  }

  const semMudanca = atual != null && atual.propriedadeId === destino.propriedadeId && atual.loteId === destino.loteId;
  if (semMudanca) return { tipo: "SEM_MUDANCA" };

  return {
    tipo: "MOVER",
    fechar: atual ? { ate: data } : null,
    abrir: { propriedadeId: destino.propriedadeId, loteId: destino.loteId, desde: data },
  };
}

export interface DestinoAtual {
  aptidao: "LEITE" | "CORTE";
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA";
  desde: Date | string;
}

export interface DestinoNovo {
  aptidao: "LEITE" | "CORTE";
  papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA";
}

export type PlanoDestino =
  | { tipo: "SEM_MUDANCA" }
  | {
    tipo: "MOVER";
    fechar: { ate: Date | string } | null;
    abrir: { aptidao: "LEITE" | "CORTE"; papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA"; desde: Date | string };
  };

// ---------- desfazer (localização ou destino, mesma forma) ----------

export interface LinhaHistorico {
  id: string;
  desde: Date | string;
  ate: Date | string | null;
  /** Desempate quando duas linhas começam no mesmo dia (ex.: cadastro e movimentação no mesmo dia). */
  criadoEm?: Date | string;
}

/** Ordem cronológica decrescente: `desde`, depois `criadoEm` (a mais recente primeiro). */
export function ordenarHistoricoDesc<T extends { desde: Date | string; criadoEm?: Date | string }>(linhas: T[]): T[] {
  return [...linhas].sort((a, b) =>
    paraTempo(b.desde) - paraTempo(a.desde)
    || (b.criadoEm != null && a.criadoEm != null ? paraTempo(b.criadoEm) - paraTempo(a.criadoEm) : 0));
}

export interface PlanoDesfazer {
  remover: { id: string };
  reabrir: { id: string };
}

/**
 * Remove a linha aberta mais recente e reabre a linha imediatamente anterior (por `desde`).
 * Exige ao menos duas linhas e uma delas aberta — quem chama garante o resto (animal ativo,
 * a linha removida não referenciada por uma baixa).
 */
export function planejarDesfazer(linhas: LinhaHistorico[]): PlanoDesfazer {
  if (linhas.length < 2) {
    throw new MovimentacaoError("É preciso ter ao menos duas linhas de histórico para desfazer");
  }

  const ordenadas = ordenarHistoricoDesc(linhas);
  const aberta = ordenadas.find((l) => l.ate == null);
  if (!aberta) throw new MovimentacaoError("Não há linha aberta para desfazer");

  const indice = ordenadas.indexOf(aberta);
  const anterior = ordenadas[indice + 1];
  if (!anterior) throw new MovimentacaoError("Não há linha anterior para reabrir");

  return { remover: { id: aberta.id }, reabrir: { id: anterior.id } };
}

export function planejarDestino(input: {
  atual: DestinoAtual | null;
  novo: DestinoNovo;
  data: Date | string;
}): PlanoDestino {
  const { atual, novo, data } = input;

  if (atual && paraTempo(data) < paraTempo(atual.desde)) {
    throw new MovimentacaoError("Data da mudança de finalidade não pode ser anterior ao início da finalidade atual");
  }

  const semMudanca = atual != null && atual.aptidao === novo.aptidao && atual.papelReprodutivo === novo.papelReprodutivo;
  if (semMudanca) return { tipo: "SEM_MUDANCA" };

  return {
    tipo: "MOVER",
    fechar: atual ? { ate: data } : null,
    abrir: { aptidao: novo.aptidao, papelReprodutivo: novo.papelReprodutivo, desde: data },
  };
}

// ---------- movimentação em massa (planejada inteira antes de gravar) ----------

export interface AnimalParaMover {
  id: string;
  brinco: string;
  dataEntrada: Date | string;
  ativo: boolean;
  /** false quando o animal não pertence ao sítio do escopo do request */
  noEscopo: boolean;
  atual: { id: string; propriedadeId: number; loteId: string | null; desde: Date | string } | null;
}

export interface PlanoMovimentacaoEmMassa {
  erros: Array<{ animalId: string; brinco: string; mensagem: string }>;
  fechar: string[];
  abrir: Array<{ animalId: string; anteriorId: string | null }>;
  semMudanca: string[];
}

/**
 * Planeja a movimentação de N animais para (sítio, lote) numa data, sem I/O.
 * `ativosDestino` são os animais ativos do sítio de destino (brinco normalizado → animalId);
 * o brinco também não pode repetir entre os animais movidos que mudam de sítio.
 */
export function planejarMovimentacaoEmMassa(input: {
  animais: AnimalParaMover[];
  destino: LocalizacaoDestino;
  data: Date | string;
  ativosDestino: Map<string, string>;
  normalizar: (brinco: string) => string;
}): PlanoMovimentacaoEmMassa {
  const { animais, destino, data, ativosDestino, normalizar } = input;
  const plano: PlanoMovimentacaoEmMassa = { erros: [], fechar: [], abrir: [], semMudanca: [] };
  const brincosChegando = new Map<string, string>();

  for (const animal of animais) {
    const erro = (mensagem: string) => plano.erros.push({ animalId: animal.id, brinco: animal.brinco, mensagem });
    if (!animal.noEscopo) { erro("não encontrado nesse sítio"); continue; }
    if (!animal.ativo) { erro("animal inativo (baixa não estornada)"); continue; }
    if (paraTempo(data) < paraTempo(animal.dataEntrada)) { erro("data anterior à entrada do animal"); continue; }
    if (animal.atual && paraTempo(data) < paraTempo(animal.atual.desde)) { erro("data anterior ao início da localização atual"); continue; }

    const mesmoLugar = animal.atual != null && animal.atual.propriedadeId === destino.propriedadeId && animal.atual.loteId === destino.loteId;
    if (mesmoLugar) { plano.semMudanca.push(animal.id); continue; }

    if (!animal.atual || animal.atual.propriedadeId !== destino.propriedadeId) {
      const chave = normalizar(animal.brinco);
      const ocupante = ativosDestino.get(chave);
      if (ocupante && ocupante !== animal.id) { erro(`brinco ${chave} já está ativo no sítio de destino`); continue; }
      const outro = brincosChegando.get(chave);
      if (outro && outro !== animal.id) { erro(`brinco ${chave} repetido entre os animais movidos`); continue; }
      brincosChegando.set(chave, animal.id);
    }

    if (animal.atual) plano.fechar.push(animal.atual.id);
    plano.abrir.push({ animalId: animal.id, anteriorId: animal.atual?.id ?? null });
  }
  return plano;
}

// ---------- desfazer uma movimentação inteira (tudo ou nada) ----------

export interface LinhaDaMovimentacao {
  /** linha de LocalizacaoAnimal aberta pela movimentação */
  id: string;
  animalId: string;
  brinco: string;
}

export interface PlanoDesfazerMovimentacao {
  erros: Array<{ animalId: string; brinco: string; mensagem: string }>;
  passos: Array<{ animalId: string; remover: string; reabrir: string }>;
}

/** Baixa que fechou uma linha de localização (o suficiente para saber se ainda a protege). */
export interface BaixaDaLinha {
  localizacaoFechadaId: string | null;
  estornadaEm: Date | string | null;
}

/**
 * Linhas de localização presas a uma baixa **ativa**. Baixa estornada não prende nada: o
 * estorno já reabriu a linha, e o vínculo cai sozinho se ela for apagada (FK ON DELETE SET NULL).
 */
export function linhasUsadasEmBaixaAtiva(baixas: BaixaDaLinha[]): Set<string> {
  const usadas = new Set<string>();
  for (const b of baixas) if (b.estornadaEm == null && b.localizacaoFechadaId) usadas.add(b.localizacaoFechadaId);
  return usadas;
}

/**
 * Desfazer a movimentação só é seguro se, para cada animal, a linha que ela abriu ainda
 * for a localização atual (nada aconteceu depois), houver uma linha anterior para reabrir,
 * o animal estiver ativo e nenhuma baixa ativa tiver usado essa linha. Um animal bloqueado
 * bloqueia a movimentação inteira — quem chama não grava nada se houver erro.
 */
export function planejarDesfazerMovimentacao(input: {
  linhas: LinhaDaMovimentacao[];
  historicoPorAnimal: Map<string, LinhaHistorico[]>;
  animaisInativos: Set<string>;
  /** baixas que fecharam alguma das linhas (estornadas incluídas; são ignoradas aqui) */
  baixasDasLinhas: BaixaDaLinha[];
}): PlanoDesfazerMovimentacao {
  const plano: PlanoDesfazerMovimentacao = { erros: [], passos: [] };
  const usadasEmBaixa = linhasUsadasEmBaixaAtiva(input.baixasDasLinhas);
  for (const linha of input.linhas) {
    const erro = (mensagem: string) => plano.erros.push({ animalId: linha.animalId, brinco: linha.brinco, mensagem });
    if (input.animaisInativos.has(linha.animalId)) { erro("o animal saiu do rebanho depois"); continue; }
    if (usadasEmBaixa.has(linha.id)) { erro("essa localização já foi usada numa baixa"); continue; }
    let passo: PlanoDesfazer;
    try {
      passo = planejarDesfazer(input.historicoPorAnimal.get(linha.animalId) ?? []);
    } catch (e) {
      if (e instanceof MovimentacaoError) { erro("não há localização anterior para voltar"); continue; }
      throw e;
    }
    if (passo.remover.id !== linha.id) { erro("o animal já foi movimentado de novo"); continue; }
    plano.passos.push({ animalId: linha.animalId, remover: passo.remover.id, reabrir: passo.reabrir.id });
  }
  return plano;
}

// ---------- leitura do histórico a partir dos itens (MovimentacaoAnimal) ----------

export interface ItemParaHistorico {
  origemLoteId: string | null;
  /** rótulo da origem, ex.: "Bezerreiro (Principal)" ou "Principal, sem lote" */
  origemRotulo: string | null;
}

/**
 * Vista de uma movimentação a partir de um lote: ENTRADA quando o destino é o lote (conta todos os
 * animais), SAÍDA quando algum animal saiu dele (conta só esses). Null quando o lote não participa.
 */
export function direcaoNoLote(loteDestinoId: string | null, itens: ItemParaHistorico[], loteId: string): { direcao: "ENTRADA" | "SAIDA"; quantidade: number } | null {
  if (loteDestinoId === loteId) return { direcao: "ENTRADA", quantidade: itens.length };
  const saindo = itens.filter((i) => i.origemLoteId === loteId).length;
  return saindo > 0 ? { direcao: "SAIDA", quantidade: saindo } : null;
}

/** Origens distintas, na ordem em que aparecem, com a contagem quando mais de um animal veio do mesmo lugar. */
export function resumirOrigens(itens: ItemParaHistorico[]): string[] {
  const contagem = new Map<string, number>();
  for (const i of itens) if (i.origemRotulo) contagem.set(i.origemRotulo, (contagem.get(i.origemRotulo) ?? 0) + 1);
  return [...contagem].map(([rotulo, n]) => (n > 1 ? `${rotulo} · ${n} animais` : rotulo));
}
