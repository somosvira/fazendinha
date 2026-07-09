import { Loader } from "../../components/Loading";
import { useAnimais, useParametros, useTaxaConcepcao, type TaxaConcepcaoMetodo } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { DOMAINS, worklistDesmame } from "../domains";
import { aDesmamar, criterioDesmame } from "../lib/worklists";
import { HOJE } from "../HOJE";
import { insightDoRebanho } from "../mock";
import type { Animal, ResumoAnimal } from "../types";

// KPI "Taxa de concepção": IA × TE. Baseline citado pela administração ~35%.
const METODO_LABEL: Record<TaxaConcepcaoMetodo["metodo"], string> = { IA: "Inseminação (IA)", TE: "Transferência de embrião (TE)" };
function TaxaConcepcaoStrip() {
  const { data, loading } = useTaxaConcepcao();
  if (loading) return null;
  return (
    <div className="rb-kstrip" style={{ ["--cols" as any]: 2, marginBottom: 18 }}>
      {data.map((m) => {
        const pct = m.taxa == null ? null : Math.round(m.taxa * 100);
        const tom = pct == null ? "" : pct >= 35 ? " rb-ok" : pct >= 25 ? "" : " rb-up";
        return (
          <div className="rb-k" key={m.metodo}>
            <div className="lab">Taxa de concepção · {METODO_LABEL[m.metodo]}</div>
            <div className="val">{pct == null ? "—" : pct}{pct != null && <small style={{ fontSize: 13 }}>%</small>}</div>
            <div className={"d" + tom}>
              {m.coberturas === 0 ? "sem coberturas registradas" : `${m.prenhes}/${m.coberturas} coberturas · meta 35%`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReproducaoTab({ onRegistrarEvento }: { onRegistrarEvento: (animal: Animal) => void }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  const params = useParametros(); // critério do desmame (DESMAME_MODO/DIAS/PESO_KG); enquanto carrega, usa o default Embrapa
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Reprodução</h1></div><Loader /></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Reprodução</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  // Enriquece o resumo com categoria/nascimento/último peso do Animal — insumos
  // da work-list "A desmamar" (não vêm no read-model ResumoAnimal do servidor).
  const resumos: ResumoAnimal[] = data.map((a) => ({
    ...(a.resumo ?? { statusReprodutivo: "VAZIA" }),
    animalId: a.id,
    categoria: a.categoria,
    dataNascimento: a.dataNascimento,
    ultimoPesoKg: a.ultimoPesoKg ?? null,
  }) as ResumoAnimal);
  const nomes = Object.fromEntries(data.map((a) => [a.id, { nome: a.nome, numero: a.numero }]));
  const criterio = criterioDesmame(params.data);
  const config = {
    ...DOMAINS.reproducao,
    worklists: [...DOMAINS.reproducao.worklists, worklistDesmame(criterio, aDesmamar(resumos, criterio, HOJE).semPeso)],
  };
  // Clicar no animal abre direto a modal de registro travada em "reprodução" —
  // o cockpit completo só aparece depois que o evento for salvo (fluxo definido em RebanhoContent).
  const abrirRegistro = (id: string) => {
    const animal = data.find((a) => a.id === id);
    if (animal) onRegistrarEvento(animal);
  };
  return <HerdDomainView key="reproducao" config={config} resumos={resumos} insight={insightDoRebanho("reproducao")} nomes={nomes} onAbrirAnimal={abrirRegistro} dicaLinha="clique numa linha pra registrar evento de reprodução" topo={<TaxaConcepcaoStrip />} />;
}
