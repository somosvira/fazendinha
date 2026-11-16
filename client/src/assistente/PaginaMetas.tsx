import Metas from "./Metas";
import "./pagina-ia.css";
export function PaginaMetas({
  propriedadeId,
  onAbrirFonte,
}: {
  propriedadeId: number | null;
  onAbrirFonte: (url: string, sitio: number) => void;
}) {
  return (
    <section className="pagina-ia pagina-metas cooperativa-content">
      <Metas propriedadeId={propriedadeId} onAbrirFonte={onAbrirFonte} />
    </section>
  );
}
