import { useEffect, useRef, useState } from "react";
import { History, Plus } from "lucide-react";
import { AssistenteConsulta } from "../components/AssistenteConsulta";
import { Button } from "../components/ui/button";
import { SubTabs } from "../components/SubTabs";
import { executarComGuardaNavegacao } from "../navegacaoGuardada";
import { navegarPara } from "../router";
import { Radar } from "./Radar";
import { HojeNaFazenda } from "./HojeNaFazenda";
import "./pagina-ia.css";

type Aba = "conversa" | "radar";
function abaAtual(): Aba {
  const valor = new URLSearchParams(window.location.search).get("aba");
  return valor === "radar" ? valor : "conversa";
}
export function PaginaIATerrano({
  propriedadeId,
  onAbrirFonte,
}: {
  propriedadeId: number | null;
  onAbrirFonte: (url: string, sitio: number | null) => void;
}) {
  const [aba, setAba] = useState<Aba>(abaAtual);
  const abaRef = useRef(aba);
  const ultimaUrl = useRef(
    window.location.pathname + window.location.search + window.location.hash,
  );
  const [pergunta, setPergunta] = useState("");
  const [nova, setNova] = useState(0);
  const [historico, setHistorico] = useState(0);
  useEffect(() => {
    const atualizar = () => {
      if (window.location.pathname !== "/assistente") return;
      const proxima = abaAtual();
      if (proxima === abaRef.current) return;
      const destino =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      window.history.replaceState(null, "", ultimaUrl.current);
      void executarComGuardaNavegacao(() => {
        abaRef.current = proxima;
        ultimaUrl.current = destino;
        window.history.replaceState(null, "", destino);
        setAba(proxima);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  function selecionar(valor: Aba, depois?: () => void) {
    void executarComGuardaNavegacao(() => {
      const destino = `/assistente${valor === "conversa" ? "" : `?aba=${valor}`}`;
      abaRef.current = valor;
      ultimaUrl.current = destino;
      setAba(valor);
      navegarPara(destino);
      depois?.();
    });
  }
  function perguntar(texto: string) {
    selecionar("conversa", () => setPergunta(texto));
  }
  return (
    <section className="pagina-ia cooperativa-content">
      <header className="pagina-ia-cabecalho">
        <h1>IA Terrano</h1>
        {aba === "conversa" && <div>
          <Button
            variant="outline"
            onClick={() => {
              selecionar("conversa", () => setHistorico((v) => v + 1));
            }}
          >
            <History size={16} aria-hidden />
            Histórico
          </Button>
          <Button
            onClick={() => {
              selecionar("conversa", () => {
                setPergunta("");
                setNova((v) => v + 1);
              });
            }}
          >
            <Plus size={16} aria-hidden />
            Nova conversa
          </Button>
        </div>}
      </header>
      <SubTabs<Aba>
        tabs={[
          { id: "conversa", label: "Conversa" },
          { id: "radar", label: "Radar" },
        ]}
        active={aba}
        onSelect={selecionar}
        ariaLabel="IA Terrano"
        idDaAba={(id) => `ia-aba-${id}`}
        idDoPainel={(id) => `ia-painel-${id}`}
      />
      <div
        role="tabpanel"
        aria-labelledby="ia-aba-conversa"
        id="ia-painel-conversa"
        hidden={aba !== "conversa"}
        className="pagina-ia-conversa"
      >
        <AssistenteConsulta
          pagina
          ativo={aba === "conversa"}
          perguntaInicial={pergunta}
          novaConversaVersao={nova}
          abrirHistoricoVersao={historico}
          onAbrirFonte={onAbrirFonte}
        />
        {aba === "conversa" && <HojeNaFazenda propriedadeId={propriedadeId} onVerRadar={() => selecionar("radar")} onPerguntar={setPergunta} />}
      </div>
      {aba === "radar" && (
        <div
          role="tabpanel"
          aria-labelledby="ia-aba-radar"
          id="ia-painel-radar"
        >
          <Radar
            propriedadeId={propriedadeId}
            onPerguntar={perguntar}
            onAbrirFonte={(url) => onAbrirFonte(url, propriedadeId)}
          />
        </div>
      )}
    </section>
  );
}
