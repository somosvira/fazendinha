import { useEffect, useState } from "react";
import { Button, ErrorBox, hoje, dataBR } from "../financeiro/financeiro-ui";
import { classeInput } from "../financeiro/PainelCadastro";
import { listarPartidasNutricionais, type PartidaNutricional } from "../pecuaria/rebanho/nutricao/api";
import { previaLoteProduto } from "./api";
export type DistribuicaoPartida = { partidaId?: string; codigo?: string; nome?: string; validade?: string | null; cienciaValidadeDesconhecida?: boolean; quantidade: string };
export const nomeLoteProduto = (p: Pick<PartidaNutricional, "nome" | "codigo" | "origemRastreio">) => p.nome || (p.origemRastreio === "LEGADO_NAO_IDENTIFICADO" ? "Estoque sem validade informada" : p.codigo);
export function conferirDistribuicaoPartidas(valor: DistribuicaoPartida[], quantidade: number, saida: boolean) {
  if (!valor.length || valor.some((p) => !(Number(p.quantidade) > 0))) throw new Error("Informe a quantidade de cada lote.");
  if (Math.round(valor.reduce((s, p) => s + Number(p.quantidade), 0) * 1000) !== Math.round(Math.abs(quantidade) * 1000)) throw new Error("A soma dos lotes deve conferir com a quantidade do movimento.");
  if (saida && valor.some((p) => !p.partidaId)) throw new Error("Selecione o lote de cada quantidade.");
  if (!saida && valor.some((p) => !p.partidaId && (p.validade === undefined || p.validade === ""))) throw new Error("Informe a validade ou escolha explicitamente Não informada.");
  if (saida && valor.some((p) => p.validade === null && !p.cienciaValidadeDesconhecida)) throw new Error("Confirme a ciência da validade não informada antes de continuar.");
}
export function SelecaoPartidas({ produtoId, propriedadeId, dataFato, quantidade, unidade, saida, valor, onChange }: { produtoId: string; propriedadeId?: number; dataFato?: string; quantidade?: string; unidade?: string; saida: boolean; valor: DistribuicaoPartida[]; onChange: (p: DistribuicaoPartida[]) => void }) {
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [previas, setPrevias] = useState<Record<string, PartidaNutricional | null>>({});
  const validades = [...new Set(valor.filter((v) => v.validade === null || !!v.validade).map((v) => v.validade ?? "nao-informada"))].sort().join(",");
  useEffect(() => {
    let vivo = true; setPrevias({});
    if (saida || !validades) return;
    Promise.all(validades.split(",").map(async (v) => [v, (await previaLoteProduto(produtoId, v === "nao-informada" ? null : v)).existente] as const))
      .then((r) => { if (vivo) setPrevias(Object.fromEntries(r)); })
      .catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [produtoId, saida, validades, revisao]);
  useEffect(() => { let vivo = true; setPartidas([]); setCarregando(true); listarPartidasNutricionais(produtoId, saida ? propriedadeId : null).then((p) => { if (vivo) { setPartidas(p); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [produtoId, propriedadeId, saida, revisao]);
  useEffect(() => {
    if (!valor.length) onChange([{ quantidade: quantidade ?? "" }]);
    else if (valor.length === 1 && quantidade != null && valor[0].quantidade !== quantidade) onChange([{ ...valor[0], quantidade }]);
  }, [valor, quantidade, onChange]);
  const sugerida = partidas.filter((p) => Number(p.saldo) > 0 && p.validade && p.validade.slice(0, 10) >= (dataFato || hoje())).sort((a, b) => (a.validade ?? "").localeCompare(b.validade ?? ""))[0];
  function alterar(i: number, patch: Partial<DistribuicaoPartida>) { onChange(valor.map((v, j) => i === j ? { ...v, ...patch } : v)); }
  function selecionar(i: number, id: string) {
    const p = partidas.find((l) => l.id === id);
    alterar(i, { partidaId: id || undefined, validade: p?.validade?.slice(0, 10) ?? null, cienciaValidadeDesconhecida: false });
  }
  return <fieldset className="mt-3 grid gap-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">Lotes por validade</legend><ErrorBox erro={erro} />{carregando && <p className="text-sm">Carregando lotes…</p>}
    {erro && <Button secondary onClick={() => setRevisao((r) => r + 1)}>Tentar novamente</Button>}
    {saida && !carregando && !erro && !partidas.length && <p className="text-sm">Sem lotes disponíveis. Confira as entradas do produto no Estoque.</p>}
    <p className="text-sm text-ink-3">O mesmo produto e a mesma validade compartilham o lote, independentemente do fornecedor.</p>
    {saida && sugerida && <p className="text-sm">Vencimento conhecido mais próximo: <strong>{nomeLoteProduto(sugerida)}</strong> · {dataBR(sugerida.validade!)}. Confirme a escolha abaixo.</p>}
    {valor.map((v, i) => {
      const existente = v.validade !== undefined ? previas[v.validade ?? "nao-informada"] : undefined;
      return <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
        {saida ? <><label className="text-sm">Lote<select aria-label={`Lote ${i + 1}`} required className={classeInput} value={v.partidaId ?? ""} onChange={(e) => selecionar(i, e.target.value)}><option value="">Selecione um lote</option>{partidas.map((p) => <option key={p.id} value={p.id}>{nomeLoteProduto(p)} · saldo {Number(p.saldo).toLocaleString("pt-BR")} {unidade ?? ""} · validade {p.validade ? dataBR(p.validade) : "não informada"}</option>)}</select></label>
          {v.partidaId && v.validade === null && <label className="flex items-start gap-2 text-sm"><input required type="checkbox" checked={v.cienciaValidadeDesconhecida ?? false} onChange={(e) => alterar(i, { cienciaValidadeDesconhecida: e.target.checked })} />Estou ciente de que a validade deste lote não foi informada.</label>}</>
          : <><label className="text-sm">Validade<select aria-label={`Situação da validade ${i + 1}`} required className={classeInput} value={v.validade === undefined ? "" : v.validade === null ? "NAO_INFORMADA" : "INFORMADA"} onChange={(e) => alterar(i, { partidaId: undefined, validade: e.target.value === "NAO_INFORMADA" ? null : e.target.value === "INFORMADA" ? "" : undefined })}><option value="">Selecione</option><option value="INFORMADA">Informada</option><option value="NAO_INFORMADA">Não informada</option></select></label>
            {typeof v.validade === "string" && <label className="text-sm">Data de validade<input aria-label={`Validade do lote ${i + 1}`} required type="date" value={v.validade} onChange={(e) => alterar(i, { validade: e.target.value })} className={classeInput} /></label>}
            {v.validade !== undefined && v.validade !== "" && <p className="text-sm">{existente === undefined ? "Conferindo o lote desta validade…" : existente ? `Esta entrada será somada ao lote ${nomeLoteProduto(existente)}.` : "Esta entrada criará um lote para esta validade."}</p>}
            {!existente && <label className="text-sm">Nome do lote (opcional)<input aria-label={`Nome do lote ${i + 1}`} maxLength={160} value={v.nome ?? ""} onChange={(e) => alterar(i, { nome: e.target.value.trim() ? e.target.value : undefined })} className={classeInput} /></label>}
          </>}
        <label className="text-sm">Quantidade {unidade && `(${unidade})`}<input aria-label={`Quantidade do lote ${i + 1}`} required type="number" min="0.001" step="0.001" readOnly={valor.length === 1 && quantidade != null} value={v.quantidade} onChange={(e) => alterar(i, { quantidade: e.target.value })} className={classeInput} /></label>
        {valor.length > 1 && <Button secondary onClick={() => onChange(valor.filter((_, j) => i !== j))}>Remover lote</Button>}
      </div>;
    })}
    <Button secondary onClick={() => onChange([...valor, { quantidade: "" }])}>{valor.length <= 1 ? saida ? "Dividir entre lotes" : "Recebimento com validades diferentes" : "Adicionar outro lote"}</Button>{valor.length > 1 && <p className="text-sm text-ink-3">A soma deve conferir com {quantidade ?? "a quantidade do movimento"} {unidade ?? ""}. Linhas com a mesma validade serão somadas.</p>}
  </fieldset>;
}
