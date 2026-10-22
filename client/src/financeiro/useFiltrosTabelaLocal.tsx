import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/DatePicker";
import { CampoFiltro, GrupoCamposFiltro } from "./PainelFiltros";
import { SelectCampo } from "./SelectCampo";
import { FiltroFaixaValor } from "./FiltroFaixaValor";
import { filtrosDasColunas, type CampoConsulta } from "./FiltroColunaConsulta";
import { valorMonetario } from "./lib/validacao";

type ValorFiltro = { texto: string; minimo: string; maximo: string };
export type DefinicaoFiltroLocal<T> = {
  chave: string; rotulo: string; colunas?: string[]; naBarra?: boolean;
  tipo: "texto" | "opcoes" | "valor" | "data";
  obter: (item: T) => string | number | string[] | null | undefined;
  opcoes?: Array<{ valor: string; texto: string }>;
  limiteSugerido?: number;
};
const vazio = (): ValorFiltro => ({ texto: "", minimo: "", maximo: "" });
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** Somente coleções completas. Consultas paginadas pelo servidor usam seus próprios handlers. */
export function useFiltrosTabelaLocal<T>(definicoes: DefinicaoFiltroLocal<T>[], onAplicar?: () => void) {
  const [aplicados, setAplicados] = useState<Record<string, ValorFiltro>>({});
  const [rascunho, setRascunho] = useState<Record<string, ValorFiltro>>({});
  const editar = (chave: string, patch: Partial<ValorFiltro>) => setRascunho(v => ({ ...v, [chave]: { ...vazio(), ...v[chave], ...patch } }));
  const ativo = (v?: ValorFiltro) => !!v && !!(v.texto.trim() || v.minimo.trim() || v.maximo.trim());
  const erro = definicoes.some(d => {
    const v = rascunho[d.chave];
    if (!v || (d.tipo !== "valor" && d.tipo !== "data")) return false;
    if (d.tipo === "data") return !!v.minimo && !!v.maximo && v.minimo > v.maximo;
    const numeros = [v.minimo, v.maximo];
    return numeros.some(n => n.trim() && (!/^\d+(?:[.,]\d+)*$/.test(n.trim()) || !Number.isFinite(valorMonetario(n)) || valorMonetario(n) < 0)) || (!!v.minimo && !!v.maximo && valorMonetario(v.minimo) > valorMonetario(v.maximo));
  }) ? "Confira os limites: o mínimo deve ser igual ou menor que o máximo." : null;
  const edicao = {
    iniciar: () => setRascunho(aplicados),
    limpar: () => setRascunho({}),
    aplicar: () => { if (!erro) { setAplicados(rascunho); onAplicar?.(); } },
  };
  const campos: CampoConsulta[] = definicoes.map(d => {
    const v = rascunho[d.chave] ?? vazio();
    const conteudo = d.tipo === "valor" ? <FiltroFaixaValor rotulo={d.rotulo} minimo={v.minimo} maximo={v.maximo} limiteSugerido={d.limiteSugerido ?? 1} onMinimoChange={minimo => editar(d.chave, { minimo })} onMaximoChange={maximo => editar(d.chave, { maximo })} />
      : d.tipo === "data" ? <GrupoCamposFiltro titulo={d.rotulo}><CampoFiltro rotulo="De"><DatePicker aria-label={`${d.rotulo}: de`} value={v.minimo} onChange={minimo => editar(d.chave, { minimo })} /></CampoFiltro><CampoFiltro rotulo="Até"><DatePicker aria-label={`${d.rotulo}: até`} value={v.maximo} onChange={maximo => editar(d.chave, { maximo })} /></CampoFiltro></GrupoCamposFiltro>
      : <CampoFiltro rotulo={d.rotulo}>{d.tipo === "opcoes" ? <SelectCampo aria-label={`Filtrar por ${d.rotulo.toLocaleLowerCase("pt-BR")}`} value={v.texto} onValueChange={texto => editar(d.chave, { texto })}><option value="">Todas as opções</option>{d.opcoes?.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</SelectCampo> : <Input aria-label={`Filtrar por ${d.rotulo.toLocaleLowerCase("pt-BR")}`} placeholder={`Buscar ${d.rotulo.toLocaleLowerCase("pt-BR")}…`} value={v.texto} onChange={e => editar(d.chave, { texto: e.target.value })} />}</CampoFiltro>;
    return { chave: d.chave, colunas: d.colunas, naBarra: d.naBarra, ativo: ativo(aplicados[d.chave]), conteudo, limpar: () => editar(d.chave, vazio()) };
  });
  const remover = (chave: string) => { setAplicados(v => ({ ...v, [chave]: vazio() })); onAplicar?.(); };
  return {
    campos, edicao, erro,
    colunas: filtrosDasColunas(campos, edicao, erro),
    criterios: definicoes.filter(d => ativo(aplicados[d.chave])).map(d => {
      const v = aplicados[d.chave];
      const resumo = d.tipo === "opcoes" ? d.opcoes?.find(o => o.valor === v.texto)?.texto ?? v.texto : d.tipo === "texto" ? v.texto : `${v.minimo || "Sem mínimo"} – ${v.maximo || "Sem máximo"}`;
      return { id: d.chave, rotulo: `${d.rotulo}: ${resumo}`, limpar: () => remover(d.chave) };
    }),
    limpar: () => { setAplicados({}); onAplicar?.(); },
    filtrar: (itens: T[]) => itens.filter(item => definicoes.every(d => {
      const v = aplicados[d.chave]; if (!ativo(v)) return true;
      const valor = d.obter(item);
      if (d.tipo === "texto") return normalizar(String(valor ?? "")).includes(normalizar(v.texto.trim()));
      if (d.tipo === "opcoes") return Array.isArray(valor) ? valor.includes(v.texto) : String(valor ?? "") === v.texto;
      if (valor == null) return false;
      if (d.tipo === "data") { const dia = String(valor).slice(0, 10); return (!v.minimo || dia >= v.minimo) && (!v.maximo || dia <= v.maximo); }
      const numero = Number(valor);
      return Number.isFinite(numero) && (!v.minimo.trim() || numero >= valorMonetario(v.minimo)) && (!v.maximo.trim() || numero <= valorMonetario(v.maximo));
    })),
  };
}
