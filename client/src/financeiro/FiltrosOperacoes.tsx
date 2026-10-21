import { ListaOpcoesFiltro } from "@/components/ListaOpcoesFiltro";
import { CampoFiltro, GrupoCamposFiltro } from "./PainelFiltros";
import { FiltroFaixaValor } from "./FiltroFaixaValor";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/ui/input";
import { SelectCampo } from "./SelectCampo";
import { TIPO_OPERACAO } from "./financeiro-ui";
import { valorMonetario } from "./lib/validacao";
import type { ParceiroBase } from "./novo-api";

export const IMPACTOS_OPERACAO = {
  TODOS: "Todos os impactos", ESTOQUE: "Movimentou estoque", PAGAMENTO: "Gerou pagamento",
  RECEBIMENTO: "Gerou recebimento", A_PAGAR: "Gerou conta a pagar", A_RECEBER: "Gerou conta a receber",
  TRANSFERENCIA: "Transferiu entre contas", SEM_EFEITOS: "Sem impactos gerados",
};
export type EfeitoFiltro = keyof typeof IMPACTOS_OPERACAO;
export type FiltrosOperacoes = {
  busca: string; inicio: string; fim: string; tipo: string; efeito: EfeitoFiltro;
  status: string; parceiroId: string; minimo: string; maximo: string;
};
export type CampoFiltroOperacoes = "data" | "operacao" | "tipo" | "parceiro" | "efeitos" | "status" | "valor";
export const FILTROS_OPERACOES_VAZIOS: FiltrosOperacoes = {
  busca: "", inicio: "", fim: "", tipo: "TODOS", efeito: "TODOS", status: "TODOS", parceiroId: "TODOS", minimo: "", maximo: "",
};
export const CAMPOS_FILTROS_OPERACOES: CampoFiltroOperacoes[] = ["operacao", "data", "tipo", "status", "parceiro", "efeitos", "valor"];
const TITULOS: Record<CampoFiltroOperacoes, string> = { data: "Data", operacao: "Operação", tipo: "Tipo de operação", parceiro: "Parceiro", efeitos: "Impacto gerado", status: "Status", valor: "Valor" };
const STATUS = { TODOS: "Todos os status", CONFIRMADA: "Confirmada", CANCELADA: "Cancelada" };
const chaves: Record<CampoFiltroOperacoes, (keyof FiltrosOperacoes)[]> = {
  data: ["inicio", "fim"], operacao: ["busca"], tipo: ["tipo"], parceiro: ["parceiroId"], efeitos: ["efeito"], status: ["status"], valor: ["minimo", "maximo"],
};
export function limparCampoOperacoes(filtros: FiltrosOperacoes, campo: CampoFiltroOperacoes): FiltrosOperacoes {
  const novos = { ...filtros };
  for (const chave of chaves[campo]) Object.assign(novos, { [chave]: FILTROS_OPERACOES_VAZIOS[chave] });
  return novos;
}
export function validarFiltrosOperacoes(f: FiltrosOperacoes): string | null {
  if (Boolean(f.inicio) !== Boolean(f.fim) || (f.inicio && f.inicio > f.fim)) return "Informe um período com início igual ou anterior ao fim.";
  for (const valor of [f.minimo, f.maximo]) {
    if (valor.trim() && (!/^\d+(?:[.,]\d+)*$/.test(valor.trim()) || !Number.isFinite(valorMonetario(valor)) || valorMonetario(valor) < 0)) return "Informe valores válidos, iguais ou maiores que zero.";
  }
  if (f.minimo.trim() && f.maximo.trim() && valorMonetario(f.minimo) > valorMonetario(f.maximo)) return "O valor mínimo deve ser igual ou menor que o máximo.";
  return null;
}
export function atendeValorOperacao(valor: string | null, minimo: string, maximo: string): boolean {
  if (!minimo.trim() && !maximo.trim()) return true;
  if (valor == null) return false;
  return (!minimo.trim() || Number(valor) >= valorMonetario(minimo)) && (!maximo.trim() || Number(valor) <= valorMonetario(maximo));
}

function OpcoesFiltro({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: string; opcoes: Record<string, string>; onChange: (valor: string) => void }) {
  return <ListaOpcoesFiltro rotulo={rotulo} valores={[valor]} opcoes={Object.entries(opcoes).map(([chave, texto]) => ({ valor: chave, texto }))} onChange={onChange} />;
}
export function CamposFiltroOperacoes({ campo, valores, editar, parceiros, podeVerValores, limiteValor, compacto = false }: {
  campo: CampoFiltroOperacoes; valores: FiltrosOperacoes;
  editar: <K extends keyof FiltrosOperacoes>(campo: K, valor: FiltrosOperacoes[K]) => void;
  parceiros: ParceiroBase[]; podeVerValores: boolean; limiteValor: number; compacto?: boolean;
}) {
  if (campo === "data") return <GrupoCamposFiltro><CampoFiltro rotulo="Data inicial"><DatePicker aria-label="Data inicial das operações" value={valores.inicio} onChange={valor => editar("inicio", valor)} /></CampoFiltro><CampoFiltro rotulo="Data final"><DatePicker aria-label="Data final das operações" value={valores.fim} onChange={valor => editar("fim", valor)} /></CampoFiltro></GrupoCamposFiltro>;
  if (campo === "operacao") return <CampoFiltro rotulo="Operação" inteiro><Input aria-label="Buscar operações no filtro" placeholder="Descrição, parceiro ou número" value={valores.busca} onChange={e => editar("busca", e.target.value)} /></CampoFiltro>;
  if (campo === "valor") return podeVerValores ? <FiltroFaixaValor minimo={valores.minimo} maximo={valores.maximo} limiteSugerido={limiteValor} onMinimoChange={valor => editar("minimo", valor)} onMaximoChange={valor => editar("maximo", valor)} /> : null;
  const opcoes: Record<string, string> = campo === "tipo" ? { TODOS: "Todos os tipos", ...TIPO_OPERACAO } : campo === "efeitos" ? IMPACTOS_OPERACAO : campo === "status" ? STATUS : { TODOS: "Todos os parceiros", SEM: "Sem parceiro", ...Object.fromEntries(parceiros.map(p => [p.id, p.nome])) };
  const chave = campo === "parceiro" ? "parceiroId" : campo === "efeitos" ? "efeito" : campo;
  const rotulo = TITULOS[campo];
  const mudar = (valor: string) => { if (chave === "efeito") editar(chave, valor as EfeitoFiltro); else editar(chave, valor); };
  return compacto ? <OpcoesFiltro rotulo={rotulo} valor={valores[chave]} opcoes={opcoes} onChange={mudar} /> : <CampoFiltro rotulo={rotulo}><SelectCampo aria-label={`Filtrar por ${rotulo.toLocaleLowerCase("pt-BR")}`} value={valores[chave]} onValueChange={mudar}>{Object.entries(opcoes).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</SelectCampo></CampoFiltro>;
}
export { FiltroColunaConsulta as FiltroColunaOperacoes } from "./FiltroColunaConsulta";
