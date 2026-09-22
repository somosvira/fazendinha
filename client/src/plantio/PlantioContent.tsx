import { useEffect, useRef, useState } from "react";
import { Loader } from "../components/Loading";
import { TalhaoCockpit } from "./components/TalhaoCockpit";
import { TalhaoTab } from "./components/TalhaoTab";
import { FenologiaTab } from "./components/FenologiaTab";
import { FitossanidadeTab } from "./components/FitossanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { ColheitaTab } from "./components/ColheitaTab";
import { PlanejamentoTab } from "./components/PlanejamentoTab";
import { EstoqueContent } from "../estoque/EstoqueContent";
import { obterCentrosAtividade } from "../estoque/api";
import { CustoTab } from "./components/CustoTab";
import { DashboardView } from "./components/DashboardView";
import { TalhaoForm } from "./components/TalhaoForm";
import { OperacaoForm } from "./components/OperacaoForm";
import type { Talhao } from "./types";

export type PlaSub = "dashboard" | "talhao" | "fenologia" | "fitossanidade" | "nutricao" | "colheita" | "planejamento" | "estoque" | "custo";

/* Espelho do RebanhoContent: roteia entre as sub-abas do módulo Plantio
 * e gerencia os modais (novo talhão, operação inline). Quando o usuário
 * clica numa linha em Fito/Nutrição, abrimos a modal de operação com o
 * domínio travado; no Talhão e Fenologia, abrimos o cockpit. */
export function PlantioContent({ aba, onNavPla, abrirId, onAbriuEntidade }: { aba: PlaSub; onNavPla?: (aba: PlaSub) => void; abrirId?: string; onAbriuEntidade?: () => void }) {
  const [talhaoId, setTalhaoId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; talhao?: Talhao } | null>(null);
  const [registroInline, setRegistroInline] = useState<{ talhao: Talhao; dominio: "fitossanidade" | "nutricao" } | null>(null);
  // Contador de recarga: bump força o remount (e o refetch) da tab/cockpit após salvar.
  const [recarga, setRecarga] = useState(0);
  // `undefined` = ainda resolvendo o centro de atividade (mostra Loader em vez
  // de montar o EstoqueContent, evitando a busca de saldos sem filtro); `null`
  // = resolvido, mas sem centro cadastrado. O `key` no EstoqueContent remonta o
  // componente quando o centro muda, então ele já nasce com o filtro certo.
  const [centroCustoEstoque, setCentroCustoEstoque] = useState<number | null | undefined>(undefined);
  const [avisoEstoque, setAvisoEstoque] = useState<string | undefined>(undefined);
  // Filtro inicial da tela de Estoque: resolve o centro "Plantio Café" (mesma constante
  // usada em services/plantio/custo.ts, via /estoque/centros-atividade), uma vez,
  // quando a aba Estoque é aberta.
  useEffect(() => {
    if (aba !== "estoque") return;
    let cancelado = false;
    obterCentrosAtividade().then((centros) => {
      if (cancelado) return;
      setCentroCustoEstoque(centros.cafe);
      setAvisoEstoque(centros.cafe == null ? "Centro da atividade não cadastrado — mostrando todos os produtos." : undefined);
    }).catch((e) => {
      if (cancelado) return;
      setCentroCustoEstoque(null);
      setAvisoEstoque(`Não foi possível resolver o centro do plantio de café: ${e instanceof Error ? e.message : String(e)}`);
    });
    return () => { cancelado = true; };
  }, [aba]);

  // Guarda o talhão a abrir após uma troca de aba (deep-link ⌘K), para o efeito
  // [aba] abaixo não limpar o cockpit recém-aberto. Espelha o proximoAnimalRef.
  const proximoTalhaoRef = useRef<string | null>(null);

  // Trocar de sub-aba fecha qualquer cockpit de talhão aberto — exceto quando há
  // um talhão marcado para abrir (deep-link), aí abrimos ele.
  useEffect(() => {
    if (proximoTalhaoRef.current) {
      setTalhaoId(proximoTalhaoRef.current);
      proximoTalhaoRef.current = null;
    } else {
      setTalhaoId(null);
    }
  }, [aba]);

  // Deep-link do ⌘K: abre o cockpit do talhão por id usando a ref (o efeito
  // [aba] pode disparar junto quando a aba também muda; a ref preserva o id).
  useEffect(() => {
    if (!abrirId) return;
    proximoTalhaoRef.current = abrirId;
    setTalhaoId(abrirId);
    onAbriuEntidade?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);

  return (
    <div className="rb">
      {talhaoId
        ? <TalhaoCockpit key={recarga} talhaoId={talhaoId} onVoltar={() => setTalhaoId(null)} />
        : aba === "talhao"
          ? <TalhaoTab key={recarga} onAbrirTalhao={setTalhaoId} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "fenologia"
            ? <FenologiaTab onAbrirTalhao={setTalhaoId} />
            : aba === "fitossanidade"
              ? <FitossanidadeTab onRegistrarOperacao={(talhao) => setRegistroInline({ talhao, dominio: "fitossanidade" })} />
              : aba === "nutricao"
                ? <NutricaoTab onRegistrarOperacao={(talhao) => setRegistroInline({ talhao, dominio: "nutricao" })} />
                : aba === "colheita"
                  ? <ColheitaTab onAbrirTalhao={setTalhaoId} />
                  : aba === "planejamento"
                    ? <PlanejamentoTab />
                    : aba === "estoque"
                      ? (centroCustoEstoque === undefined
                          ? <Loader />
                          : <EstoqueContent key={String(centroCustoEstoque)} centroCustoIdInicial={centroCustoEstoque} titulo="Estoque" avisoFiltro={avisoEstoque} />)
                      : aba === "custo"
                        ? <CustoTab />
                        : <DashboardView onNav={(t) => onNavPla?.(t as PlaSub)} />}
      {form && <TalhaoForm modo={form.modo} talhao={form.talhao} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
      {registroInline && (
        <OperacaoForm
          talhaoId={registroInline.talhao.id}
          talhao={registroInline.talhao}
          dominioFixo={registroInline.dominio}
          onFechar={() => setRegistroInline(null)}
          onSalvo={() => setRegistroInline(null)}
        />
      )}
    </div>
  );
}
