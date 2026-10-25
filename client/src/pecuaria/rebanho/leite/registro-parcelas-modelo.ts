import type { ContextoParcelas, NaturezaParcela, ParcelaInput, ParcelaOrdenha } from "./parcelas-types";

export const nomesNatureza: Record<NaturezaParcela, string> = { COMERCIAL: "Comercial", NAO_COMERCIAL: "Descarte", COLOSTRO: "Colostro" };
export interface RascunhoParcela {
  chave: string; id?: string; versao: number; natureza: NaturezaParcela;
  tanqueId: string; recipiente: string; litros: string; regua: string;
  animais: string[]; responsavel: string; direta: boolean; justificativa: string;
  primeira: boolean | null; motivo: string; produto: string; entradaId: string | null;
  classificacaoPendente?: boolean;
  criterioColostroSnapshot?: unknown;
}
export function novaParcela(natureza: NaturezaParcela, animais: string[] = [], direta = false): RascunhoParcela {
  return { chave: crypto.randomUUID(), versao: 0, natureza, tanqueId: "", recipiente: "", litros: "", regua: "", animais, responsavel: "", direta, justificativa: "", primeira: false, motivo: "", produto: "", entradaId: null };
}
export function parcelaSalva(p: ParcelaOrdenha): RascunhoParcela {
  return { ...novaParcela(p.natureza ?? "COMERCIAL"), classificacaoPendente: p.natureza == null, criterioColostroSnapshot: p.criterioColostroSnapshot, chave: p.id, id: p.id, versao: p.versao, tanqueId: p.tanque?.id ?? "", recipiente: p.recipiente ?? "", litros: String(p.litros), regua: p.reguaMm == null ? "" : String(p.reguaMm), animais: p.animaisOrigem, responsavel: p.responsavel, direta: !!p.declaracaoDireta, justificativa: p.declaracaoDireta?.justificativa ?? "", primeira: p.primeiraOrdenhaColostro, entradaId: p.entradaId };
}
export function reconciliarParcelas(parcelas: RascunhoParcela[], salvas: ParcelaOrdenha[], alterado: boolean) {
  const atuais = new Map(salvas.map(p => [p.id, p]));
  if (!alterado) return { conflitos: [] as string[], parcelas: salvas.map(p => {
    const anterior = parcelas.find(a => a.id === p.id);
    const conservarConferencia = anterior?.versao === p.versao && anterior.entradaId === p.entradaId;
    return { ...parcelaSalva(p), ...(conservarConferencia ? { produto: anterior.produto, motivo: anterior.motivo } : {}) };
  }) };
  const persistidas = parcelas.filter(p => p.id);
  // Um formulário novo já preenchido não incorpora parcelas de outra pessoa.
  if (!persistidas.length) return { parcelas, conflitos: [] as string[] };
  const conflitos = persistidas.flatMap(p => {
    const atual = atuais.get(p.id!);
    if (!atual) return [`A parcela ${p.id} não foi encontrada no servidor. Seus campos foram preservados.`];
    return atual.versao !== p.versao || atual.entradaId !== p.entradaId ? [`A parcela ${p.id} mudou no servidor (versão ${atual.versao}${atual.entradaId ? ", confirmada" : ", sem entrada ativa"}). Seus campos foram preservados.`] : [];
  });
  const idsLocais = new Set(persistidas.map(p => p.id));
  return { conflitos, parcelas: [...parcelas, ...salvas.filter(p => !idsLocais.has(p.id)).map(parcelaSalva)] };
}
export function carenciasSessao(contexto: ContextoParcelas, posicao: string) {
  return contexto.contexto?.carencias.find(c => c.posicaoId === posicao)?.animais ?? [];
}
export function possuiContexto(p: RascunhoParcela, contexto: ContextoParcelas, posicao: string) {
  if (p.natureza === "COMERCIAL") return true;
  if (!p.animais.length) return false;
  const ids = p.natureza === "COLOSTRO" ? contexto.contexto?.origensColostro.map(a => a.animalId) ?? [] : carenciasSessao(contexto, posicao).filter(a => a.estado !== "SEM_RESTRICAO_REGISTRADA").map(a => a.animalId);
  return p.animais.every(id => ids.includes(id) || (p.natureza === "COLOSTRO" && primeiraDeclaradaNaPropriaParcela(p, contexto, posicao, id)));
}
function primeiraDeclaradaNaPropriaParcela(p: RascunhoParcela, contexto: ContextoParcelas, posicao: string, animalId: string) {
  if (!p.id || contexto.contexto?.criterioColostro?.tipo !== "PRIMEIRA_ORDENHA") return false;
  // Só a medição retornada para a data atual comprova sua própria declaração.
  // Snapshot guardado no navegador não cria contexto ao trocar a data.
  const propria = contexto.medicoes.find(m => m.id === p.id && contexto.sessoes.some(s => s.id === m.sessaoId && s.posicaoId === posicao));
  if (!propria || propria.natureza !== "COLOSTRO" || propria.declaracaoDireta || !propria.primeiraOrdenhaColostro || !propria.animaisOrigem.includes(animalId)) return false;
  const snapshot = propria.criterioColostroSnapshot;
  if (!snapshot || typeof snapshot !== "object" || !("configuracaoId" in snapshot) || snapshot.configuracaoId !== contexto.configuracao.id || !("criterio" in snapshot) || !snapshot.criterio || typeof snapshot.criterio !== "object" || !("tipo" in snapshot.criterio) || snapshot.criterio.tipo !== "PRIMEIRA_ORDENHA" || !("primeiraOrdenhaColostro" in snapshot) || snapshot.primeiraOrdenhaColostro !== true || !("partos" in snapshot) || !Array.isArray(snapshot.partos)) return false;
  return snapshot.partos.some((parto: unknown) => parto && typeof parto === "object" && "id" in parto && "versao" in parto && "animalId" in parto && "data" in parto && parto.animalId === animalId && contexto.contexto.partos.some(atual => atual.id === parto.id && atual.versao === parto.versao && atual.animalId === animalId && atual.data === parto.data));
}
function decimal(valor: string, nome: string) {
  if (!/^\d+(?:[.,]\d+)?$/.test(valor.trim())) throw new Error(`Informe ${nome} manualmente, incluindo zero quando medido.`);
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Confira ${nome}.`);
  return n;
}
export function prepararParcelas(parcelas: RascunhoParcela[], contexto: ContextoParcelas, posicao: string, confirmar = false): ParcelaInput[] {
  const preenchidas = parcelas.filter(p => p.id || p.litros.trim() || p.regua.trim());
  if (!preenchidas.length) throw new Error("Informe os litros de pelo menos uma parcela.");
  const fisicas = new Map<string, NaturezaParcela>();
  return preenchidas.filter(p => !p.entradaId && !p.classificacaoPendente).map(p => {
    const litros = decimal(p.litros, "os litros");
    const tanque = contexto.tanques.find(t => t.id === p.tanqueId) ?? contexto.medicoes.find(m => m.tanque?.id === p.tanqueId)?.tanque;
    if (p.tanqueId && !tanque) throw new Error("O tanque selecionado não está disponível nesta data. Confira sua versão.");
    if (!p.tanqueId && !p.recipiente.trim()) throw new Error("Identifique o recipiente segregado da parcela.");
    if (tanque && litros > tanque.capacidadeLitros) throw new Error(`O volume excede a capacidade de ${tanque.nome}: ${tanque.capacidadeLitros} L.`);
    if (!p.responsavel.trim()) throw new Error("Informe o responsável de cada parcela.");
    const direta = p.natureza !== "COMERCIAL" && (p.direta || !possuiContexto(p, contexto, posicao));
    if (direta && p.justificativa.trim().length < 5) throw new Error(`Justifique o registro direto de ${nomesNatureza[p.natureza]}.`);
    if (p.natureza === "COMERCIAL" && p.animais.some(id => carenciasSessao(contexto, posicao).some(a => a.animalId === id && a.estado !== "SEM_RESTRICAO_REGISTRADA"))) throw new Error("Há origem comercial com carência ou contexto sanitário pendente. Confira os animais.");
    if (confirmar && litros > 0) {
      if (!p.animais.length && !direta) throw new Error("Confira os animais de origem antes de confirmar.");
      const fisica = tanque ? `tanque:${tanque.identidadeId}` : `recipiente:${p.recipiente.trim().toLocaleLowerCase("pt-BR")}`;
      if (fisicas.has(fisica) && fisicas.get(fisica) !== p.natureza) throw new Error("Naturezas diferentes exigem origens físicas segregadas.");
      fisicas.set(fisica, p.natureza);
      if (p.natureza === "COLOSTRO" && !direta && contexto.contexto?.criterioColostro?.tipo === "PRIMEIRA_ORDENHA" && !p.primeira) throw new Error("Declare a primeira ordenha após o parto para esta parcela de colostro.");
    }
    return { ...(p.id ? { id: p.id } : {}), tanqueId: p.tanqueId || null, recipiente: p.tanqueId ? null : p.recipiente.trim(), versaoEsperada: p.versao, litros, reguaMm: p.regua.trim() ? decimal(p.regua, "a régua em milímetros") : null, natureza: p.natureza, animaisOrigem: p.animais, responsavel: p.responsavel.trim(), ...(p.id && p.motivo.trim() ? { motivoCorrecao: p.motivo.trim() } : {}), ...(direta ? { declaracaoDireta: { justificativa: p.justificativa.trim() } } : {}), ...(p.natureza === "COLOSTRO" && p.primeira != null ? { primeiraOrdenhaColostro: p.primeira } : {}) };
  });
}

// Motivo e produto pertencem à conferência/correção; isoladamente não mudam a medição.
export function selecionarParcelasAlteradas(inputs: ParcelaInput[], salvas: ParcelaOrdenha[]): ParcelaInput[] {
  const atuais = new Map(salvas.map(p => [p.id, p]));
  return inputs.filter(input => {
    const anterior = input.id ? atuais.get(input.id) : undefined;
    if (!anterior) return true;
    const campos = (p: Pick<ParcelaInput, "tanqueId" | "recipiente" | "litros" | "reguaMm" | "natureza" | "animaisOrigem" | "responsavel" | "declaracaoDireta" | "primeiraOrdenhaColostro">) => ({
      tanqueId: p.tanqueId, recipiente: p.recipiente, litros: p.litros, reguaMm: p.reguaMm,
      natureza: p.natureza, animaisOrigem: [...p.animaisOrigem].sort(), responsavel: p.responsavel,
      declaracaoDireta: p.declaracaoDireta ?? null, primeiraOrdenhaColostro: p.primeiraOrdenhaColostro ?? null,
    });
    if (!anterior.natureza) return true;
    return JSON.stringify(campos(input)) !== JSON.stringify(campos({ ...anterior, natureza: anterior.natureza,
      tanqueId: anterior.tanque?.id ?? null, declaracaoDireta: anterior.declaracaoDireta ?? undefined,
      primeiraOrdenhaColostro: anterior.primeiraOrdenhaColostro ?? undefined }));
  });
}
export function aplicarParcelasSalvas(parcelas: RascunhoParcela[], inputs: ParcelaInput[], salvas: ParcelaOrdenha[]): RascunhoParcela[] {
  const idsEnviados = new Set(inputs.flatMap(p => p.id ? [p.id] : []));
  const porId = new Map(salvas.map(p => [p.id, p]));
  // O serviço retorna as parcelas na ordem do envio. Só novas parcelas recebem novos IDs.
  const novasSalvas = salvas.filter(p => !idsEnviados.has(p.id));
  let indiceNova = 0;
  return parcelas.map(p => {
    if (p.entradaId || p.classificacaoPendente) return p;
    const salva = p.id ? (idsEnviados.has(p.id) ? porId.get(p.id) : undefined)
      : p.litros.trim() || p.regua.trim() ? novasSalvas[indiceNova++] : undefined;
    return salva ? { ...parcelaSalva(salva), chave: p.chave, produto: p.produto, motivo: p.motivo } : p;
  });
}
