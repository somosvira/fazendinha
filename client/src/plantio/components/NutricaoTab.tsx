import { Loader } from "../../components/Loading";
import { useTalhoes, useLavouras, usePlanosAdubacao } from "../api";
import { LavouraDomainView, RB_TBL_LAVOURA } from "./LavouraDomainView";
import { RebHeader } from "@/components/rb/RebHeader";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebEmpty, RebAnm, REB_SEC_SUB } from "@/components/rb/RebPrimitives";
import { DOMAINS } from "../domains";
import { insightDaLavoura } from "../mock";
import type { ResumoTalhao, Talhao, Lavoura, PlanoAdubacao } from "../types";

export function NutricaoTab({ onRegistrarOperacao }: { onRegistrarOperacao: (talhao: Talhao) => void }) {
  const { data, loading, erro } = useTalhoes({ estado: "ATIVO" });
  const { data: lavouras } = useLavouras();
  const { data: planos } = usePlanosAdubacao();

  if (loading) return <RebMain><RebHeader eyebrow="Lavoura" title="Nutrição & Solo" /><Loader /></RebMain>;
  if (erro) return <RebMain><RebHeader title="Nutrição & Solo" /><p className="text-sm text-prejuizo">Erro: {erro}</p></RebMain>;
  // Resumo real embutido em cada talhão (.resumo); filtra nulos (talhão sem resumo).
  const resumos: ResumoTalhao[] = data.map((t) => t.resumo).filter(Boolean) as ResumoTalhao[];
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));
  const abrir = (id: string) => { const t = data.find((x) => x.id === id); if (t) onRegistrarOperacao(t); };

  return (
    <>
      <LavouraDomainView
        key="nutricao"
        config={DOMAINS.nutricao}
        resumos={resumos}
        insight={insightDaLavoura("nutricao")}
        nomes={nomes}
        onAbrirTalhao={abrir}
        dicaLinha="clique numa linha pra registrar adubação ou amostragem"
      />
      <RebMain className="pt-0">
        <SecaoLavouras lavouras={lavouras} />
        <SecaoPlanos planos={planos} />
      </RebMain>
    </>
  );
}

function SecaoLavouras({ lavouras }: { lavouras: Lavoura[] }) {
  return (
    <section className="mb-9 mt-2">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Lavouras</h3>
        <span className="text-sm text-ink-3">{lavouras.length} {lavouras.length === 1 ? "agrupamento" : "agrupamentos"} de talhões</span>
      </div>
      <p className={REB_SEC_SUB}>Cada lavoura agrupa talhões da mesma variedade ou plano de manejo. Crie uma lavoura, escolha o plano de adubação e adicione os talhões.</p>
      {lavouras.length === 0 ? (
        <RebEmpty>Nenhuma lavoura cadastrada ainda.</RebEmpty>
      ) : (
        <RebTable className={RB_TBL_LAVOURA}>
          <thead><tr><th>Lavoura</th><th>Talhões</th><th>Área</th><th>Variedade dominante</th><th>Produtividade</th><th>Plano de adubação</th></tr></thead>
          <tbody>{lavouras.map((l) => (
            <tr key={l.id}>
              <td><RebAnm>{l.nome}</RebAnm></td>
              <td>{l.numTalhoes}</td>
              <td>{l.areaHa} ha</td>
              <td>{l.variedade ?? "—"}</td>
              <td>{l.produtividadeMedia ? `${l.produtividadeMedia} sc/ha` : <span className="text-ink-3">—</span>}</td>
              <td>{l.planoAdubacaoNome ?? <span className="text-ink-3">—</span>}</td>
            </tr>
          ))}</tbody>
        </RebTable>
      )}
    </section>
  );
}

function SecaoPlanos({ planos }: { planos: PlanoAdubacao[] }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Planos de adubação</h3>
        <span className="text-sm text-ink-3">{planos.length} {planos.length === 1 ? "receita" : "receitas"}</span>
      </div>
      <p className={REB_SEC_SUB}>Receitas de NPK que podem ser atribuídas a uma lavoura inteira. Valores em kg/ha/safra distribuídos nas parcelas indicadas.</p>
      {planos.length === 0 ? (
        <RebEmpty>Nenhum plano cadastrado.</RebEmpty>
      ) : (
        <div className="grid grid-cols-2 content-start gap-3 max-[900px]:grid-cols-1">{planos.map((d) => (
          <div className="cursor-default rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans" key={d.id}>
            <h4 className="mb-[9px] mt-0 flex items-baseline justify-between font-serif text-[17px] font-medium">{d.nome}</h4>
            <ul className="m-0 list-none p-0">
              {d.descricao && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0">{d.descricao}</li>}
              {d.nKgHa != null && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0"><b>N</b>: {d.nKgHa} kg/ha · {d.parcelas ?? 4} parcelas</li>}
              {d.p2o5KgHa != null && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0"><b>P₂O₅</b>: {d.p2o5KgHa} kg/ha</li>}
              {d.k2oKgHa != null && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0"><b>K₂O</b>: {d.k2oKgHa} kg/ha</li>}
            </ul>
          </div>
        ))}</div>
      )}
    </section>
  );
}
