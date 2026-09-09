export function ActivityPill({ atv, mix }: { atv?: string; mix?: boolean }) {
  if (mix) return <span className="act-pill mix"><span className="dot" />Misto</span>;
  const nomes: Record<string, string> = { leite: "Leite", cafe: "Café", outros: "Outros" };
  return <span className={`act-pill ${atv ?? "outros"}`}><span className="dot" />{nomes[atv ?? "outros"] ?? "Outros"}</span>;
}
