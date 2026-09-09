/* Sistema de loading do Rio Novo — um único dialeto, coerente com o design.
 *
 * Três peças:
 *   - <Loader>            → estado inline/seção (substitui LoadingShell / .rb-sub / .caption)
 *   - <BootSplash>        → splash de abertura do app (trator temático, tela cheia)
 *   - <Skeleton> + <DashboardSkeleton> → placeholders com shimmer para áreas de dados
 *
 * O trator é SVG inline desenhado à mão (mesma linguagem dos gráficos em charts.tsx)
 * e usa só tokens da paleta (--leite / --cafe / --outros …) via classes em base.css.
 * Animações respeitam prefers-reduced-motion (zerado globalmente em base.css).
 */

/** Trator lateral em SVG — rodas giram e o corpo balança quando `.tractor--spin`. */
function Tractor({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 132 100" width="100%" height="100%" role="img" aria-hidden="true">
      {/* fumaça do escapamento */}
      <g>
        <circle className="puff puff-1" cx="69" cy="14" r="3.5" />
        <circle className="puff puff-2" cx="69" cy="14" r="3" />
        <circle className="puff puff-3" cx="69" cy="14" r="2.5" />
      </g>
      {/* escapamento */}
      <rect className="t-exhaust" x="66" y="16" width="5" height="30" rx="2" />
      {/* chassis */}
      <rect className="t-chassis" x="28" y="58" width="80" height="11" rx="3" />
      {/* capô / motor */}
      <rect className="t-hood" x="64" y="42" width="46" height="20" rx="4" />
      <circle className="t-light" cx="105" cy="48" r="3.2" />
      {/* cabine */}
      <rect className="t-roof" x="24" y="19" width="44" height="7" rx="3" />
      <rect className="t-cabin" x="29" y="24" width="34" height="36" rx="4" />
      <rect className="t-glass" x="34" y="30" width="23" height="17" rx="2" />
      {/* roda traseira */}
      <g className="tw tw-rear">
        <circle className="t-tire" cx="40" cy="70" r="24" />
        <circle className="t-rim" cx="40" cy="70" r="18" />
        <g className="t-spokes">
          <line className="t-spoke" x1="40" y1="52" x2="40" y2="88" />
          <line className="t-spoke" x1="22" y1="70" x2="58" y2="70" />
          <line className="t-spoke" x1="27" y1="57" x2="53" y2="83" />
          <line className="t-spoke" x1="53" y1="57" x2="27" y2="83" />
        </g>
        <circle className="t-hub" cx="40" cy="70" r="7" />
      </g>
      {/* roda dianteira */}
      <g className="tw tw-front">
        <circle className="t-tire" cx="101" cy="76" r="15" />
        <circle className="t-rim" cx="101" cy="76" r="10" />
        <g className="t-spokes">
          <line className="t-spoke" x1="101" y1="64" x2="101" y2="88" />
          <line className="t-spoke" x1="89" y1="76" x2="113" y2="76" />
          <line className="t-spoke" x1="93" y1="68" x2="109" y2="84" />
          <line className="t-spoke" x1="109" y1="68" x2="93" y2="84" />
        </g>
        <circle className="t-hub" cx="101" cy="76" r="4.5" />
      </g>
    </svg>
  );
}

/** Colheita crescendo — hastes brotam do solo (scaleY) escalonadas e reiniciam em loop. */
function Crop({ className }: { className?: string }) {
  const ground = 86;
  const stalks = [
    { x: 38, h: 52, delay: "0s" },
    { x: 58, h: 64, delay: "0.35s" },
    { x: 78, h: 56, delay: "0.7s" },
    { x: 97, h: 46, delay: "1.05s" },
  ];
  return (
    <svg className={className} viewBox="0 0 132 100" width="100%" height="100%" role="img" aria-hidden="true">
      {/* solo */}
      <line className="crop-ground" x1="16" y1={ground} x2="116" y2={ground} />
      {stalks.map((s, i) => {
        const topY = ground - s.h;
        return (
          <g className="crop-stalk" key={i} style={{ animationDelay: s.delay }}>
            {/* haste */}
            <path
              className="crop-stem"
              d={`M${s.x} ${ground} C ${s.x - 4} ${ground - s.h * 0.5}, ${s.x + 4} ${ground - s.h * 0.72}, ${s.x} ${topY}`}
            />
            {/* folhas */}
            <path className="crop-leaf" d={`M${s.x} ${ground - s.h * 0.42} q -13 -3 -17 -12 q 13 0 17 12 z`} />
            <path className="crop-leaf" d={`M${s.x} ${ground - s.h * 0.58} q 13 -3 17 -12 q -13 0 -17 12 z`} />
            {/* espiga */}
            <ellipse className="crop-head" cx={s.x} cy={topY + 4} rx="4" ry="9" />
            <line className="crop-awn" x1={s.x} y1={topY - 3} x2={s.x} y2={topY - 12} />
            <line className="crop-awn" x1={s.x} y1={topY - 1} x2={s.x - 5} y2={topY - 9} />
            <line className="crop-awn" x1={s.x} y1={topY - 1} x2={s.x + 5} y2={topY - 9} />
          </g>
        );
      })}
    </svg>
  );
}

/** Grãos de café pulando — quicam escalonados, com sombra que acompanha. */
function Coffee({ className }: { className?: string }) {
  const baseY = 50;
  const groundY = 74;
  const beans = [
    { x: 46, delay: "0s" },
    { x: 66, delay: "0.15s" },
    { x: 86, delay: "0.3s" },
  ];
  return (
    <svg className={className} viewBox="0 0 132 100" width="100%" height="100%" role="img" aria-hidden="true">
      {beans.map((b, i) => (
        <ellipse key={`sh-${i}`} className="bean-shadow" cx={b.x} cy={groundY} rx="9" ry="3" style={{ animationDelay: b.delay }} />
      ))}
      {beans.map((b, i) => (
        <g key={`bn-${i}`} transform={`translate(${b.x} ${baseY})`}>
          <g className="bean-jump" style={{ animationDelay: b.delay }}>
            <g transform="rotate(20)">
              <ellipse className="bean-body" cx="0" cy="0" rx="10" ry="13" />
              <path className="bean-crease" d="M0 -10 C 4 -4, -4 4, 0 10" />
            </g>
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Motivo do loader: trator (movimento), colheita crescendo ou café pulando. */
export type LoadingMotif = "tractor" | "crop" | "coffee";

function Figure({ motif }: { motif: LoadingMotif }) {
  if (motif === "crop") return <Crop className="crop crop--anim" />;
  if (motif === "coffee") return <Coffee className="coffee coffee--anim" />;
  return <Tractor className="tractor tractor--spin" />;
}

/** Loader de seção/inline. Troca os "Carregando…" ad-hoc por um único componente.
 *  `full` promove o loader a estado de PÁGINA: ocupa a altura da área de conteúdo
 *  e centraliza nos dois eixos (`.loader--pagina` em base.css). Como ele vive
 *  dentro do `.app-main` — que já desconta a sidebar via margin-left — o centro
 *  é o da região de conteúdo, e acompanha a sidebar aberta ou recolhida. */
export function Loader({
  label = "Carregando…",
  size = "md",
  motif = "coffee",
  full = false,
  className,
}: {
  label?: string;
  size?: "sm" | "md";
  motif?: LoadingMotif;
  full?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`loader loader--${size}${full ? " loader--pagina" : ""}${className ? " " + className : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loader-figure">
        <Figure motif={motif} />
      </div>
      {label && <span className="loader-label">{label}</span>}
    </div>
  );
}

/** Splash de abertura — tela cheia, figura cruzando a lavoura. `leaving` inicia o fade-out. */
export function BootSplash({ leaving = false, motif = "coffee" }: { leaving?: boolean; motif?: LoadingMotif }) {
  return (
    <div className={`boot-splash${leaving ? " is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="boot-header">
        <span className="boot-eyebrow">Gestão da Fazenda</span>
        <span className="boot-brand">Terrano</span>
      </div>
      <div className="boot-field">
        {motif === "tractor" && <div className="boot-ground" />}
        <div className={`boot-drive${motif !== "tractor" ? " boot-drive--static" : ""}`}>
          <Figure motif={motif} />
        </div>
      </div>
      <p className="boot-msg">Preparando a fazenda…</p>
      <div className="boot-track">
        <span className="boot-bar" />
      </div>
    </div>
  );
}

/** Bloco base do skeleton — cor + shimmer vêm da classe .skeleton (base.css). */
export function Skeleton({
  w,
  h,
  r = 6,
  className,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`skeleton${className ? " " + className : ""}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/** Placeholder do Dashboard enquanto o fetch resolve — imita a silhueta real da tela. */
export function DashboardSkeleton() {
  return (
    <div className="shell-wide dash-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="loader-sr">Carregando dashboard…</span>
      <div className="dash-skeleton-head">
        <Skeleton w={140} h={12} r={4} />
        <Skeleton w="min(360px, 70%)" h={30} r={6} />
      </div>
      <div className="dash-skeleton-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-skeleton-card">
            <Skeleton w="55%" h={11} r={4} />
            <Skeleton w="80%" h={26} r={6} />
            <Skeleton w="40%" h={10} r={4} />
          </div>
        ))}
      </div>
      <div className="dash-skeleton-chart">
        <Skeleton w="30%" h={13} r={4} />
        <Skeleton w="100%" h={220} r={10} />
      </div>
      <div className="dash-skeleton-rows">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="dash-skeleton-row">
            <Skeleton w="60%" h={12} r={4} />
            <Skeleton w="14%" h={12} r={4} />
          </div>
        ))}
      </div>
    </div>
  );
}
