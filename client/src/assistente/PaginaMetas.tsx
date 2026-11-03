import Metas from "./Metas";
import { SeletorFazenda } from "./SeletorFazenda";
import "./pagina-ia.css";
export function PaginaMetas({
  propriedadeId,
  onTrocarPropriedade,
  onAbrirFonte,
}: {
  propriedadeId: number | null;
  onTrocarPropriedade: (id: number | null) => void;
  onAbrirFonte: (url: string, sitio: number) => void;
}) {
  return (
    <section className="pagina-ia pagina-metas cooperativa-content">
      <SeletorFazenda
        propriedadeId={propriedadeId}
        onTrocar={onTrocarPropriedade}
      />
      <Metas propriedadeId={propriedadeId} onAbrirFonte={onAbrirFonte} />
    </section>
  );
}
