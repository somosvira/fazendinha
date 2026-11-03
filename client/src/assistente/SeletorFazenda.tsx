import { useEffect, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
export function SeletorFazenda({
  propriedadeId,
  onTrocar,
}: {
  propriedadeId: number | null;
  onTrocar: (id: number | null) => void;
}) {
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vigente = true;
    listarPropriedades()
      .then((lista) => {
        if (vigente) setSitios(lista.filter((s) => s.ativo));
      })
      .catch(() => {
        if (vigente) setErro(true);
      });
    return () => {
      vigente = false;
    };
  }, []);
  const nome =
    sitios.find((s) => s.id === propriedadeId)?.nome ??
    (propriedadeId == null
      ? sitios.length === 1
        ? sitios[0].nome
        : "Todos os sítios"
      : "Fazenda selecionada");
  return (
    <div className="pagina-ia-contexto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Selecionar fazenda">
            <MapPin size={16} aria-hidden />
            <span>{nome}</span>
            <ChevronDown size={14} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {sitios.length > 1 && (
            <DropdownMenuItem onSelect={() => onTrocar(null)}>
              Todos os sítios
            </DropdownMenuItem>
          )}
          {sitios.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => onTrocar(s.id)}>
              {s.nome}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {erro && (
        <p role="alert">
          Não foi possível carregar as fazendas. Reabra a página para tentar
          novamente.
        </p>
      )}
    </div>
  );
}
