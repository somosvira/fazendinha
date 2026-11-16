import { EsqueletoCartoes, EsqueletoFicha, EsqueletoTabela } from "../../../components/Esqueleto";

type EstruturaSkeletonSanitario = "lista" | "ciclos" | "detalhe";

export function SkeletonSanitario({ estrutura = "lista", label }: { estrutura?: EstruturaSkeletonSanitario; label: string }) {
  if (estrutura === "detalhe") return <EsqueletoFicha label={label} className="p-4" />;
  if (estrutura === "ciclos") return <EsqueletoCartoes label={label} quantidade={4} className="p-4" />;
  return <EsqueletoTabela label={label} className="p-4" />;
}
