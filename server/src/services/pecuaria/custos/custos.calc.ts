import { Prisma } from "@prisma/client";

export type TipoFonteCusto = "TENTATIVA" | "APLICACAO" | "EXAME" | "PARTICIPACAO" | "NUTRICAO";
export type FinalidadeCusto = "REPRODUCAO" | "SANIDADE" | "ROTINA";
export type ClassificacaoCusto = {
  finalidade: FinalidadeCusto | null; materialNaoAplicavel: boolean; servicoNaoAplicavel: boolean;
  coberturaServico: "PROCEDIMENTO" | "MATERIAL" | "AMBOS";
  valorMaterialDocumentado: Prisma.Decimal.Value | null;
};
export type FonteCusto = {
  id: string; tipo: TipoFonteCusto; animalId: string; propriedadeId: number; data: string;
  descricao: string; estadoFato: string; participacaoId: string | null;
  origemMaterial: string; movimentoEstoqueId: string | null; operacaoServicoId: string | null;
  valorMaterial: Prisma.Decimal.Value | null; valorServico: Prisma.Decimal.Value | null;
  classificacao: ClassificacaoCusto | null; versaoClassificacao?: number; documentoMaterial?: unknown; componenteId?: string; periodoConsumo?: {inicio:string;fim:string};
};
export type ComponenteCusto = {
  chave: string; fonteId: string; tipoFonte: TipoFonteCusto; animalId: string; data: string;
  descricao: string; estadoFato: string; participacaoId: string | null;
  finalidade: FinalidadeCusto | null; natureza: "MATERIAL" | "SERVICO";
  estado: "CONHECIDO" | "DESCONHECIDO" | "NAO_APLICAVEL" | "INCLUIDO_PACOTE";
  periodoConsumo?: {inicio:string;fim:string}; valor: Prisma.Decimal | null; origemId: string | null;
};
export type ParcelaPreparo = { modo: "INTEGRAL" | "PARCELA"; valorMaterial: Prisma.Decimal.Value | null; valorServico: Prisma.Decimal.Value | null };
const decimal = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
function dinheiro(v: Prisma.Decimal.Value): Prisma.Decimal {
  const d = decimal(v);
  if (!d.isFinite() || d.isNegative() || d.decimalPlaces() > 2 || d.gt("999999999999.99")) throw new Error("Parcela monetária inválida");
  return d;
}
/** O movimento e seu espelho no fato têm a mesma identidade de material. */
export function componentesDaFonte(f: FonteCusto): ComponenteCusto[] {
  const c = f.classificacao;
  const pacoteMaterial = !!f.operacaoServicoId && (c?.coberturaServico === "MATERIAL" || c?.coberturaServico === "AMBOS");
  const pacoteProcedimento = !!f.operacaoServicoId && c?.coberturaServico === "AMBOS";
  const material = f.valorMaterial ?? (f.origemMaterial === "DOCUMENTADA" ? c?.valorMaterialDocumentado ?? null : null);
  if (pacoteMaterial && material != null) throw new Error("Pacote com material não pode sobrepor consumo ou valor material separado");
  const comum = { fonteId: f.id, tipoFonte: f.tipo, animalId: f.animalId, data: f.data, descricao: f.descricao,
    periodoConsumo:f.periodoConsumo, estadoFato: f.estadoFato, participacaoId: f.participacaoId, finalidade: c?.finalidade ?? null };
  const linhas: ComponenteCusto[] = [];
  // Exame e atribuição de participação não presumem consumo de material próprio.
  if (!["EXAME", "PARTICIPACAO"].includes(f.tipo)) linhas.push({ ...comum, natureza: "MATERIAL",
    chave: f.tipo === "NUTRICAO" ? `nutricao:${f.id}:${f.componenteId}` : f.movimentoEstoqueId ? `movimento:${f.movimentoEstoqueId}` : `material:${f.tipo}:${f.id}`,
    origemId: f.movimentoEstoqueId, estado: material != null ? "CONHECIDO" : c?.materialNaoAplicavel ? "NAO_APLICAVEL" : pacoteMaterial ? "INCLUIDO_PACOTE" : "DESCONHECIDO",
    valor: material != null ? dinheiro(material) : null });
  if (f.tipo !== "NUTRICAO") linhas.push({ ...comum, natureza: "SERVICO", chave: `servico:${f.tipo}:${f.id}`,
    origemId: f.operacaoServicoId,
    estado: f.valorServico != null && !!f.operacaoServicoId ? "CONHECIDO" : c?.servicoNaoAplicavel ? "NAO_APLICAVEL" : "DESCONHECIDO",
    valor: f.valorServico != null && !!f.operacaoServicoId ? dinheiro(f.valorServico) : null });
  // Um pacote apenas de material ainda deixa o procedimento pendente.
  if (pacoteMaterial && !pacoteProcedimento && c?.coberturaServico === "MATERIAL" && !c.servicoNaoAplicavel)
    linhas.push({ ...comum, natureza: "SERVICO", chave: `procedimento-pendente:${f.tipo}:${f.id}`, origemId: null, estado: "DESCONHECIDO", valor: null });
  return linhas;
}
export function aplicarParcelaPreparo(componentes: ComponenteCusto[], parcela: ParcelaPreparo): ComponenteCusto[] {
  if (parcela.modo === "INTEGRAL") return componentes;
  return componentes.flatMap(c => {
    const valor = c.natureza === "MATERIAL" ? parcela.valorMaterial : parcela.valorServico;
    // Uma parcela monetária não resolve as outras pendências da origem.
    if (c.estado === "DESCONHECIDO") return [c];
    if (valor == null || c.estado !== "CONHECIDO") return [];
    const q = dinheiro(valor);
    if (c.valor == null || q.gt(c.valor)) throw new Error("A parcela supera o custo conhecido da origem");
    return [{ ...c, valor: q }];
  });
}
/** Contraprova de capacidade: integral exclusivo, parcelas explícitas por natureza. */
export function conferirParcelasPreparo(componentes: ComponenteCusto[], parcelas: ParcelaPreparo[]): void {
  if (parcelas.some(p => p.modo === "INTEGRAL")) {
    if (parcelas.length > 1) throw new Error("Preparatório integral já atribuído; informe parcelas explícitas");
    return;
  }
  for (const natureza of ["MATERIAL", "SERVICO"] as const) {
    const valores = parcelas.map(p => natureza === "MATERIAL" ? p.valorMaterial : p.valorServico).filter((v): v is Prisma.Decimal.Value => v != null);
    if (!valores.length) continue;
    const base = componentes.filter(c => c.natureza === natureza && c.valor != null).reduce((s,c) => s.plus(c.valor!), decimal(0));
    if (!componentes.some(c => c.natureza === natureza && c.valor != null) || valores.reduce<Prisma.Decimal>((s,v) => s.plus(dinheiro(v)), decimal(0)).gt(base)) throw new Error("A soma atribuída supera o custo conhecido da origem");
  }
}
export function consolidarCustos(componentes: ComponenteCusto[], verValores = true) {
  const unicos = new Map<string, ComponenteCusto>();
  for (const c of componentes) {
    const anterior = unicos.get(c.chave);
    if (anterior && (anterior.valor?.toString() !== c.valor?.toString() || anterior.estado !== c.estado)) throw new Error("Componentes com a mesma origem possuem valores divergentes");
    if (!anterior) unicos.set(c.chave, c);
  }
  const linhas = [...unicos.values()];
  const pendentes = linhas.filter(c => c.estado === "DESCONHECIDO").length;
  const conhecidos = linhas.filter(c => c.estado === "CONHECIDO").length;
  const cobertura = !linhas.length ? "DESCONHECIDO" : !pendentes ? "COMPLETO" : conhecidos ? "PARCIAL" : "DESCONHECIDO";
  const total = linhas.reduce((s,c) => s.plus(c.valor ?? 0), decimal(0));
  return { rotulo: "Custo direto registrado", cobertura, situacao: verValores ? cobertura : "OCULTO",
    totalConhecido: verValores && (conhecidos > 0 || !pendentes && linhas.length > 0) ? total.toFixed(2) : null, componentesPendentes: pendentes,
    limitacoes: ["Logística não atribuída; mão de obra própria, instalações e despesas gerais fora deste total"],
    componentes: linhas.map(c => ({ ...c, valor: verValores ? c.valor?.toFixed(2) ?? null : null, origemId: verValores ? c.origemId : null })) };
}
