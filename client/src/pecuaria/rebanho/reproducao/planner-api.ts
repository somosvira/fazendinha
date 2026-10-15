import { reqV4, type ContextoTemporalAnimal } from "./api";
import type { TipoAtividade } from "./visitas-api";
export const camposNumericos = { DEL: "DEL", DIAS_POS_PARTO: "Dias pós-parto", DIAS_TENTATIVA: "Dias desde tentativa", DIAS_CONFIRMACAO: "Dias desde confirmação", IDADE_GESTACIONAL: "Idade gestacional", PARTOS: "Partos", TENTATIVAS_CICLO: "Tentativas no ciclo", DIAS_ATE_RETORNO: "Dias até retorno informado", DIAS_APTIDAO: "Dias desde aptidão", IDADE_DIAS: "Idade em dias", PESO_KG: "Último peso (kg)" };
export const camposValores = { CATEGORIA: "Categoria", LOTE: "Lote", SITUACAO: "Situação reprodutiva", PAPEL_REPRODUTIVO: "Papel reprodutivo", SITUACAO_PRODUTIVA: "Situação produtiva", RP: "RP do último parto", DESCARTE: "Descarte reprodutivo", RETORNO_INFORMADO: "Retorno informado", SEXO: "Sexo", ORIGEM: "Origem de entrada", BUSCA: "Brinco ou nome contém", RACA: "Composição racial contém", PROTOCOLO: "Protocolo ativo", PROTOCOLO_ATIVO: "Participação ativa", NASCIMENTO_ESTIMADO: "Nascimento estimado", HISTORICO_PARTO: "Histórico de parto", APTIDAO: "Aptidão leite/corte" };
export type CampoNumerico = keyof typeof camposNumericos;
export type CampoValor = keyof typeof camposValores;
export type CondicaoSelecao = { tipo: "FAIXA"; campo: CampoNumerico; min?: number; max?: number; incluirMin: boolean; incluirMax: boolean } | { tipo: "VALORES"; campo: CampoValor; valores: string[] } | { tipo: "DESCONHECIDO"; campo: CampoNumerico | CampoValor };
export type CriteriosSelecao = { versao: 1 | 2; todas: CondicaoSelecao[]; qualquer: {id: string; todas: CondicaoSelecao[]}[]; ordenacao: {campo: "BRINCO" | "NOME" | CampoNumerico; direcao: "ASC" | "DESC"}[]; politicaDesconhecidos: "INCLUIR" | "EXCLUIR" };
export type SelecaoVisita = { id: string; nome: string; ativo: boolean; versaoAtual: { id: string; numero: number; criterios: CriteriosSelecao } | null };
export type TipoAtividadeExtra = Extract<TipoAtividade, "AVALIACAO_REPRODUTIVA" | "APLICACAO_SANITARIA" | "EXAME_SANITARIO" | "INICIAR_SANITARIO" | "INICIAR_IATF">;
export type GrupoLivreInput = {origem: "LIVRE"; nome: string; criterios: CriteriosSelecao; tipo: TipoAtividadeExtra; contexto?: Record<string, unknown>; incluidosManualmente: string[]};
export type GrupoPlannerInput = GrupoLivreInput | {origem: "PROTOCOLO" | "RETORNO"; identidade: string} | {origem: "SELECAO"; selecaoVersaoId: string} | {origem: "EXTRA"; nome: string; criterios: CriteriosSelecao; tipo: TipoAtividadeExtra; contexto?: Record<string, unknown>};
export type JanelaPlanner = "DIA" | "ANTERIOR" | "FUTURA" | "SEM_PREVISAO";
export type GrupoPlanner = { contexto?: Record<string,unknown>; grupo: GrupoPlannerInput; nome: string; secao: "REPRODUCAO" | "SANIDADE"; janela: JanelaPlanner | "HABITUAL" | "EXTRA"; tipo: TipoAtividade; protocolo: {id: string; nome: string; versao: number} | null; turma: {id: string; nome: string} | null; etapa: {id: string; nome: string; ordem: number} | null; previstaPara: string | null; precisaoTemporal: "DIA" | "HORA" | null; criterios: CriteriosSelecao | null; totalAnimais: number; totalProcedimentos: number; emVisitaAberta: number };
export type AnimalPlanner = ContextoTemporalAnimal & { sexo?: string; pesoKg?: number | null; pesagemData?: string | null; diasPesagem?: number | null; idadeDias?: number; nascimentoEstimado?: string; diasAptidao?: number | null; animalId: string; tarefaId: string | null; brinco?: string; nome?: string | null; categoria?: {id: string; nome: string} | null; lote?: {id: string; nome: string} | null; situacao?: string; partos?: number; tentativasCiclo?: number; diasTentativa?: number | null; diasParto?: number | null; diasGestacao?: number | null; diasAteRetorno?: number | null; retornoEm?: string | null; retornoInformado?: boolean | null; motivos: string[]; visitasAbertas: {id: string; nome: string}[] };
export type PreviaPlanner = {assinaturaContexto?: string;resumoSelecao?:{porSituacao:{situacao:string;animais:number}[]};grupo: GrupoPlanner; animais: AnimalPlanner[]; total: number; pagina: number; tamanhoPagina: number; fingerprint: string};
export type ConsultaPlanner = {grupos: GrupoPlanner[]; totalGrupos: number; totais: {animaisUnicos: number; procedimentos: number}; pagina: number; tamanhoPagina: number};
export const consultarPlanner = (propriedadeId: number, data: string, pagina = 1) => reqV4<ConsultaPlanner>(`/visitas/planner?${new URLSearchParams({propriedadeId: String(propriedadeId), data, pagina: String(pagina), tamanhoPagina: "200"})}`, undefined, "GET", propriedadeId);
const previaLegada = (propriedadeId: number, data: string, grupo: GrupoPlannerInput, pagina = 1) => reqV4<PreviaPlanner>(`/visitas/planner/previa?${new URLSearchParams({propriedadeId: String(propriedadeId), data, grupo: JSON.stringify(grupo), pagina: String(pagina), tamanhoPagina: "200"})}`, undefined, "GET", propriedadeId);
export const consultarAgenda = (propriedadeId: number, data: string, pagina = 1) => reqV4<ConsultaPlanner>(`/visitas/agenda?${new URLSearchParams({propriedadeId: String(propriedadeId), data, pagina: String(pagina), tamanhoPagina: "200"})}`, undefined, "GET", propriedadeId);
export const previaGrupo: typeof previaLegada = (propriedadeId, data, grupo, pagina = 1) => grupo.origem === "LIVRE"
  ? reqV4<PreviaPlanner>("/visitas/selecoes/previa", {propriedadeId, data, grupo, pagina, tamanhoPagina: 200}, "POST", propriedadeId)
  : previaLegada(propriedadeId, data, grupo, pagina);
export type OpcoesSelecao = { lotes: {id: string; nome: string}[]; categorias: {id: string; nome: string}[]; racas: {id: string; nome: string}[]; protocolos: {id: string; nome: string; tipo: "SANITARIO" | "REPRODUTIVO"; publicadoEm: string | null; ativo: boolean}[]; tiposExame: {id: string; nome: string; contexto: string}[] };
export const obterOpcoesSelecao = (propriedadeId: number, data: string) => reqV4<OpcoesSelecao>(`/visitas/selecoes/opcoes?${new URLSearchParams({propriedadeId: String(propriedadeId), data})}`, undefined, "GET", propriedadeId);
export const incluirGrupo = (visitaId: string, input: {chave: string; propriedadeId: number; fingerprint: string; grupo: GrupoPlannerInput; excluidos: string[]}) => reqV4(`/visitas/${visitaId}/grupos`, input);
export const listarSelecoes = (propriedadeId: number) => reqV4<{selecoes: SelecaoVisita[]}>(`/visitas/selecoes?propriedadeId=${propriedadeId}&incluirInativas=true`, undefined, "GET", propriedadeId);
export const salvarSelecao = (propriedadeId: number, nome: string, criterios: CriteriosSelecao, selecao?: SelecaoVisita, ativo = true) => reqV4<SelecaoVisita>(`/visitas/selecoes${selecao ? `/${selecao.id}` : ""}`, {propriedadeId, nome, criterios, ...(selecao ? {versaoAtualId: selecao.versaoAtual?.id, ativo} : {})}, selecao ? "PUT" : "POST");
/** Chave curta apenas para navegação; a assinatura de segurança continua sendo a do servidor. */
function chaveLivre(grupo: GrupoLivreInput): string {
  const ordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenar) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,ordenar(x)])) : v;
  let hash = 14695981039346656037n;
  for (const caractere of JSON.stringify(ordenar(grupo))) hash = BigInt.asUintN(64,(hash ^ BigInt(caractere.codePointAt(0)!)) * 1099511628211n);
  return `livre-${hash.toString(16).padStart(16,"0")}`;
}
export const chaveGrupo = (g: GrupoPlannerInput) => g.origem === "LIVRE" ? chaveLivre(g) : g.origem === "SELECAO" ? g.selecaoVersaoId : g.origem === "EXTRA" ? JSON.stringify(g) : g.identidade;

export type GrupoRevisado = { previa: PreviaPlanner; excluidos: string[]; chave: string };
export function resumoRevisao(grupos: GrupoRevisado[]) {
  const ids = new Set<string>(); let procedimentos = 0;
  for (const {previa, excluidos} of grupos) {
    const exclusoes = new Set(excluidos);
    for (const animal of previa.animais) if (!exclusoes.has(animal.animalId)) { ids.add(animal.animalId); procedimentos++; }
  }
  return {animais: ids.size, procedimentos};
}
/** Percorre todas as páginas; a revisão não transforma o tamanho da página em limite do grupo. */
export async function carregarPreviaCompleta(propriedadeId: number, data: string, grupo: GrupoPlannerInput, carregar = previaGrupo): Promise<PreviaPlanner> {
  const primeira = await carregar(propriedadeId, data, grupo, 1);
  const animais = [...primeira.animais];
  for (let pagina = 2; animais.length < primeira.total; pagina++) {
    const proxima = await carregar(propriedadeId, data, grupo, pagina);
    if (proxima.fingerprint !== primeira.fingerprint || !proxima.animais.length || proxima.total !== primeira.total) throw new Error("O grupo mudou durante a revisão. Recarregue o planner e revise os animais.");
    animais.push(...proxima.animais);
  }
  return {...primeira, animais};
}
