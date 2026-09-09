import { Loader } from "../../components/Loading";
import { useAnimais, useParametros, type ChaveWorklistRebanho, type WorklistRebanho } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { WorklistCanonica, type AcaoItemWorklist } from "./WorklistCanonica";
import { ProtocolosIatf } from "./ProtocolosIatf";
import { ProgramacaoIatfLote } from "./ProgramacaoIatfLote";
import { ReprodutoresSection } from "./ReprodutoresSection";
import { RelatorioReproducaoSection } from "./RelatorioReproducaoSection";
import { RebHeader } from "./RebHeader";
import { RebMain } from "@/components/rb/RebPrimitives";
import { DOMAINS, worklistDesmame } from "../domains";
import { aDesmamar, criterioDesmame } from "../lib/worklists";
import { HOJE } from "../HOJE";
import { insightDoRebanho } from "../mock";
import type { Animal, ResumoAnimal } from "../types";

export function ReproducaoTab({ onRegistrarEvento, onRegistrarWorklist, onAbrirFicha, worklistChave, worklistSnapshot }: { onRegistrarEvento: (animal: Animal) => void; onRegistrarWorklist: (acao: AcaoItemWorklist) => void; onAbrirFicha: (id: string) => void; worklistChave?: ChaveWorklistRebanho; worklistSnapshot?: WorklistRebanho }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  const params = useParametros(); // critério do desmame (DESMAME_MODO/DIAS/PESO_KG); enquanto carrega, usa o default Embrapa
  if (worklistChave && worklistChave !== "ccs-alta") return <WorklistCanonica chave={worklistChave} snapshot={worklistSnapshot} onAcao={onRegistrarWorklist} onAbrirFicha={onAbrirFicha} />;
  if (loading) return <RebMain><RebHeader eyebrow="Rebanho" title="Reprodução" /><Loader /></RebMain>;
  if (erro) return <RebMain><RebHeader title="Reprodução" /><p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p></RebMain>;
  // Enriquece o resumo com categoria/nascimento/último peso do Animal — insumos
  // da work-list "A desmamar" (não vêm no read-model ResumoAnimal do servidor).
  const resumos: ResumoAnimal[] = data.map((a) => ({
    ...(a.resumo ?? { statusReprodutivo: "VAZIA" }),
    animalId: a.id,
    categoria: a.categoria,
    grupoNome: a.grupoNome ?? a.grupoAtual ?? null,
    setor: a.setor ?? null,
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
  return <HerdDomainView key="reproducao" config={config} resumos={resumos} insight={insightDoRebanho("reproducao")} nomes={nomes} onAbrirAnimal={abrirRegistro} dicaLinha="clique numa linha pra registrar evento de reprodução" topo={<><RelatorioReproducaoSection /><ProtocolosIatf /><ProgramacaoIatfLote /><ReprodutoresSection /></>} />;
}
