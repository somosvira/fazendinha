import { insights } from "../mock";
import { Enfase } from "./IaInsight";

const SUGESTOES = [
  "Quais vacas estão com CCS alto e subindo?",
  "Por que a taxa de prenhez caiu?",
  "Quem eu vou secar esse mês?",
  "Produção média por lote",
];

type Msg =
  | { de: "user"; txt: string }
  | { de: "ia"; txt: string; lista?: string[]; rodape?: string };

const CONVERSA: Msg[] = [
  { de: "user", txt: "Quais vacas estão com CCS alto e subindo?" },
  {
    de: "ia",
    txt: "Encontrei 2 vacas com CCS ≥ 400 mil e tendência de alta:",
    lista: [
      "Jurema #1234 — 512 mil, ↑ 3 controles · teve mastite clínica em abril",
      "Cravina #1305 — em alta · vazia atrasada",
    ],
    rodape: "Recomendo cultura no próximo controle da Jurema.",
  },
  { de: "user", txt: "Por que a taxa de prenhez caiu?" },
  {
    de: "ia",
    txt: 'A concepção caiu de 42% → 31% nos últimos 3 lotes de IATF, concentrada no reprodutor "Lance 884". Pode ser a partida de sêmen ou o manejo do protocolo. Quer que eu compare por inseminador e por touro?',
  },
];

export function IaView() {
  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Assistente · Rúmi</div>
      <div className="rb-head"><h1>IA</h1></div>

      <div className="rb-ia-grid">
        <div className="rb-chat">
          <p className="rb-chat-intro">Pergunte qualquer coisa sobre a fazenda — produção, reprodução, sanidade, nutrição. A IA lê o contexto do rebanho e responde com os dados reais.</p>
          <div className="rb-suggest">
            {SUGESTOES.map((s) => <button key={s} className="rb-chip-q">{s}</button>)}
          </div>
          <div className="rb-thread">
            {CONVERSA.map((m, i) =>
              m.de === "user" ? (
                <div key={i} className="rb-msg user">{m.txt}</div>
              ) : (
                <div key={i} className="rb-msg ia">
                  <div className="av">✦</div>
                  <div className="bubble">
                    {m.txt}
                    {m.lista && <ul>{m.lista.map((l, j) => <li key={j}>{l}</li>)}</ul>}
                    {m.rodape && <div className="rodape">{m.rodape}</div>}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="rb-chat-input">
            <input placeholder="Pergunte qualquer coisa sobre a fazenda…" aria-label="Pergunta para a IA" />
            <button>✦ Enviar</button>
          </div>
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
