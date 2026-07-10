/* Terrano — abertura do dashboard.
 *
 * Ao entrar no dashboard, cobre a tela com o fundo desfocado e toca a marca
 * "grande" no centro enquanto a música-piano (musicca-piano-4s.mp3) toca:
 *   1. o relevo se desenha e o sol (latão) rola pela colina e salta na ponta
 *      — é a animação-assinatura da marca, portada do handoff "Terrano — Marca";
 *   2. o lockup (símbolo + "Terrano" + "Fazenda Rio Novo") surge por baixo;
 *   3. quando a música acaba, o lockup dá um zoom pra diminuir e voa até o
 *      canto superior esquerdo, pousando exatamente sobre a logo do cabeçalho
 *      (mesmo <TerranoSymbol/>), e o overlay some.
 *
 * Autoplay de áudio pode ser bloqueado pelo navegador (sem gesto do usuário):
 * nesse caso a parte visual roda igual e o fim é dado por um timer. Respeita
 * prefers-reduced-motion (sem rolagem do sol nem voo — só um fade).
 */

import { useEffect, useRef, useState } from "react";
import { TerranoSymbol } from "./TerranoLogo";

const AUDIO_SRC = "/musicca-piano-4s.mp3";
const HOLD_FALLBACK_MS = 4200; // fim visual quando o áudio não toca / não dispara "ended"
const FLY_MS = 950; // duração do voo até o canto

function prefereMenosMovimento(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function TerranoIntro({ onDone }: { onDone: () => void }) {
  const reduzido = useRef(prefereMenosMovimento()).current;
  const [entrou, setEntrou] = useState(false);
  const [saindo, setSaindo] = useState(false);

  // dispara a entrada (fade/subida) no quadro seguinte ao mount, via transição
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntrou(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const hillRef = useRef<SVGPathElement>(null);
  const ballRef = useRef<SVGCircleElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const lockupRef = useRef<HTMLDivElement>(null);
  const symbolRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // ---- animação do sol rolando + saltando (portada do "Terrano — Marca") ----
  useEffect(() => {
    if (reduzido) return;
    const hill = hillRef.current;
    const ball = ballRef.current;
    const shadow = shadowRef.current;
    if (!hill || !ball || !shadow) return;

    const JUMP_H = 30;
    const JUMP_DX = 12;
    const ROLL = 1500;
    const JUMP = 620;
    const BASE_SHADOW_OP = 0.3;

    const len = hill.getTotalLength();
    const endPt = hill.getPointAtLength(len);
    hill.style.strokeDasharray = String(len);
    hill.style.strokeDashoffset = String(len);

    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const place = (pt: { x: number; y: number }, lift = 0) => {
      ball.setAttribute("cx", String(pt.x));
      ball.setAttribute("cy", String(pt.y - lift));
      shadow.setAttribute("cx", String(pt.x));
      const k = Math.max(0, 1 - lift / JUMP_H);
      shadow.setAttribute("rx", String(4 + 4 * k));
      shadow.setAttribute("opacity", String(BASE_SHADOW_OP * 0.3 + BASE_SHADOW_OP * 0.7 * k));
    };

    let raf = 0;
    let t0: number | null = null;
    let phase: "roll" | "jump" | "done" = "roll";

    const frame = (ts: number) => {
      if (t0 === null) t0 = ts;
      const el = ts - t0;
      if (phase === "roll") {
        const t = Math.min(1, el / ROLL);
        const e = easeInOut(t);
        hill.style.strokeDashoffset = String(len * (1 - e));
        place(hill.getPointAtLength(len * e), 0);
        if (t >= 1) {
          phase = "jump";
          t0 = ts;
        }
      } else if (phase === "jump") {
        const t = Math.min(1, el / JUMP);
        place({ x: endPt.x + JUMP_DX * t, y: endPt.y }, JUMP_H * Math.sin(Math.PI * t));
        if (t >= 1) {
          phase = "done";
          place({ x: endPt.x + JUMP_DX, y: endPt.y }, 0);
          return; // uma passada só; segura no fim
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduzido]);

  // ---- áudio + orquestração do fim (voo até o canto) ----
  useEffect(() => {
    let finalizado = false;
    let fallback = window.setTimeout(finalizar, HOLD_FALLBACK_MS);
    let flyTimer = 0;
    const audio = audioRef.current;

    function voarAteOCanto() {
      const lockup = lockupRef.current;
      const symbol = symbolRef.current;
      // alvo: o mesmo símbolo Terrano no cabeçalho (canto sup. esquerdo)
      const alvo = document.querySelector<HTMLElement>(".ah-brand .terrano-symbol");
      if (reduzido || !lockup || !symbol || !alvo) return; // sem voo: só o fade do overlay

      const sRect = symbol.getBoundingClientRect();
      const tRect = alvo.getBoundingClientRect();
      const lRect = lockup.getBoundingClientRect();
      const escala = tRect.width / sRect.width || 0.2;

      // origem = centro do símbolo dentro do lockup, pra escalar "a partir" dele
      const origemX = sRect.left + sRect.width / 2 - lRect.left;
      const origemY = sRect.top + sRect.height / 2 - lRect.top;
      const dx = tRect.left + tRect.width / 2 - (sRect.left + sRect.width / 2);
      const dy = tRect.top + tRect.height / 2 - (sRect.top + sRect.height / 2);

      lockup.style.transformOrigin = `${origemX}px ${origemY}px`;
      lockup.style.transform = `translate(${dx}px, ${dy}px) scale(${escala})`;
    }

    function finalizar() {
      if (finalizado) return;
      finalizado = true;
      window.clearTimeout(fallback);
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* noop */
        }
      }
      setSaindo(true);
      voarAteOCanto();
      flyTimer = window.setTimeout(onDone, (reduzido ? 420 : FLY_MS) + 140);
    }

    if (audio) {
      audio.volume = 0.85;
      const onEnded = () => finalizar();
      audio.addEventListener("ended", onEnded);
      // preferir o fim real da música; se ela tocar, estica a rede de segurança
      const onPlaying = () => {
        window.clearTimeout(fallback);
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : 4000;
        fallback = window.setTimeout(finalizar, dur + 700);
      };
      audio.addEventListener("playing", onPlaying, { once: true });

      // Destrava a música no 1º gesto caso o autoplay seja bloqueado (ex.: boot
      // sem passar pelo login). No fluxo normal — intro logo após o clique de
      // "Entrar" — a sticky activation do documento já libera e isto nem roda.
      const destravar = () => audio.play().catch(() => {});
      const desarmarDestrava = () => {
        window.removeEventListener("pointerdown", destravar);
        window.removeEventListener("keydown", destravar);
      };

      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          /* autoplay bloqueado — tenta de novo no 1º gesto; a parte visual roda igual */
          window.addEventListener("pointerdown", destravar, { once: true });
          window.addEventListener("keydown", destravar, { once: true });
        });
      }
      return () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("playing", onPlaying);
        desarmarDestrava();
        window.clearTimeout(fallback);
        window.clearTimeout(flyTimer);
      };
    }

    return () => {
      window.clearTimeout(fallback);
      window.clearTimeout(flyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={
        "terrano-intro" +
        (entrou ? " is-in" : "") +
        (saindo ? " is-leaving" : "") +
        (reduzido ? " is-reduced" : "")
      }
      role="status"
      aria-live="polite"
      aria-label="Terrano — abrindo a fazenda"
    >
      {/* animação-assinatura: relevo se desenhando + sol rolando/saltando */}
      <div className="ti-stage" aria-hidden>
        <svg viewBox="0 0 220 132" width="100%" fill="none" className="ti-hillsvg">
          <line x1="14" y1="114" x2="206" y2="114" stroke="#E8DCC4" strokeWidth="1" opacity="0.16" />
          <path
            ref={hillRef}
            className="ti-hill"
            d="M16 96 C46 96 52 66 78 74 S118 100 140 78 S180 40 202 50"
            stroke="#E8DCC4"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse ref={shadowRef} className="ti-shadow" cx="16" cy="114" rx="7" ry="2.2" fill="#000" opacity="0.32" />
          <circle ref={ballRef} className="ti-ball" r="7" fill="#B89A5C" cx="16" cy="96" />
        </svg>
      </div>

      {/* lockup que voa pro canto — mesmo símbolo do cabeçalho */}
      <div className="ti-lockup" ref={lockupRef}>
        <span className="ti-sym" ref={symbolRef}>
          <TerranoSymbol size={56} tone="dark" strokeWidth={3.8} />
        </span>
        <span className="ti-words">
          <span className="ti-name">Terrano</span>
          <span className="ti-sub">Fazenda Rio Novo</span>
        </span>
      </div>

      <div className="ti-caption" aria-hidden>
        Reunindo os números
        <span className="ti-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>

      <audio ref={audioRef} src={AUDIO_SRC} preload="auto" />
    </div>
  );
}
