import { useState } from "react";
import { insights } from "../mock";
import { Enfase } from "./IaInsight";
import { perguntarIA } from "../api";

const SUGESTOES = [
  "Quais talhões estão com ferrugem subindo?",
  "Quando começo a colheita?",
  "Quais talhões precisam de adubação?",
  "Qual o custo médio por saca?",
];

type Msg =
  | { de: "user"; txt: string }
  | { de: "ia"; txt: string; lista?: string[]; rodape?: string; modo?: "ia" | "demo" };

/* "Caatinga" — assistente do módulo Plantio, espelho do "Rúmi" do rebanho. */
export function IaView() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(p: string) {
    const pergunta = p.trim();
    if (!pergunta || enviando) return;
    setMsgs((m) => [...m, { de: "user", txt: pergunta }]);
    setTexto("");
    setEnviando(true);
    try {
      const resp = await perguntarIA(pergunta);
      setMsgs((m) => [...m, { de: "ia", txt: resp.resposta, lista: resp.lista, rodape: resp.rodape, modo: resp.modo }]);
    } catch {
      setMsgs((m) => [...m, { de: "ia", txt: "Não consegui responder agora." }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Assistente · Caatinga</div>
      <div className="rb-head"><h1>IA</h1></div>

      <div className="rb-ia-grid">
        <div className="rb-chat">
          <p className="rb-chat-intro">Pergunte qualquer coisa sobre a lavoura — fenologia, fitossanidade, nutrição, colheita, custo. A IA lê o contexto dos talhões e responde com os dados reais.</p>
          <div className="rb-suggest">
            {SUGESTOES.map((s) => (
              <button key={s} className="rb-chip-q" onClick={() => enviar(s)} disabled={enviando}>{s}</button>
            ))}
          </div>
          <div className="rb-thread">
            {msgs.map((m, i) =>
              m.de === "user" ? (
                <div key={i} className="rb-msg user">{m.txt}</div>
              ) : (
                <div key={i} className="rb-msg ia">
                  <div className="av">✦</div>
                  <div className="bubble">
                    <Enfase texto={m.txt} />
                    {m.lista && <ul>{m.lista.map((l, j) => <li key={j}>{l}</li>)}</ul>}
                    {m.rodape && <div className="rodape">{m.rodape}</div>}
                    {m.modo === "demo" && <span className="rb-chip-demo">modo demonstração</span>}
                  </div>
                </div>
              ),
            )}
          </div>
          <form className="rb-chat-input" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pergunte qualquer coisa sobre a lavoura…"
              aria-label="Pergunta para a IA"
              disabled={enviando}
            />
            <button type="submit" disabled={enviando || !texto.trim()}>✦ {enviando ? "Enviando…" : "Enviar"}</button>
          </form>
        </div>

        <aside className="rb-ia-side">
          <h4>Insights da semana</h4>
          {insights.map((ins) => (
            <div key={ins.id} className="rb-ins"><div className="dot">✦</div><p style={{ margin: 0 }}><Enfase texto={ins.texto} /></p></div>
          ))}
        </aside>
      </div>
    </main>
  );
}
