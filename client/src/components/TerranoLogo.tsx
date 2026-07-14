/* Terrano — símbolo da marca (relevo + sol nascente).
 * Fonte única do desenho: usado no cabeçalho (canto sup. esquerdo) e na
 * animação de abertura (TerranoIntro), pra que o "voo" do centro até o canto
 * pouse exatamente sobre o mesmo símbolo. Vindo do handoff "Terrano — Marca".
 *
 * Tons:
 *   - "dark"  → traço creme (sobre fundo escuro do masthead / capa)
 *   - "light" → traço tinta (sobre papel creme)
 *   - "mono"  → sol sem preenchimento (carimbo / um tom só)
 * O sol é sempre latão (#B89A5C) exceto no mono.
 */

export type TerranoTone = "dark" | "light" | "mono";

const LATAO = "#B89A5C";

export function TerranoSymbol({
  size = 34,
  tone = "dark",
  strokeWidth = 4.4,
  className,
}: {
  size?: number;
  tone?: TerranoTone;
  strokeWidth?: number;
  className?: string;
}) {
  const stroke = tone === "light" ? "#14191A" : "#E8DCC4";
  return (
    <svg
      className={"terrano-symbol" + (className ? " " + className : "")}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="Terrano"
    >
      {/* relevo — morro principal + eco em segundo plano */}
      <path d="M12 70 Q34 42 50 60 T90 54" stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
      <path
        d="M12 82 Q40 60 58 74 T90 70"
        stroke={stroke}
        strokeWidth={strokeWidth * 0.86}
        fill="none"
        opacity={0.36}
        strokeLinecap="round"
      />
      {/* sol nascente */}
      {tone === "mono" ? (
        <circle cx="70" cy="32" r="9" fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.9} />
      ) : (
        <circle cx="70" cy="32" r="9" fill={LATAO} />
      )}
    </svg>
  );
}
