// Seletor de animais usado por "Movimentar animais" (ListaLotes), "Trazer animais"
// (DetalheLote) e rodadas sanitárias. A implementação é a seleção completa em
// SelecaoAnimais (filtros de rebanho/reprodução/produção, lista de brincos e
// painel dos selecionados); este nome fica por compatibilidade com quem já usa.
import type { ComponentProps } from "react";
import type { AnimalResumo } from "../types";
import { SelecaoAnimais } from "./SelecaoAnimais";

/** `animaisIniciais` é o nome usado pelas rodadas sanitárias para a seleção já feita (o mesmo que `inicial`). */
export function SeletorAnimais({ animaisIniciais, inicial, ...props }: ComponentProps<typeof SelecaoAnimais> & { animaisIniciais?: AnimalResumo[] }) {
  return <SelecaoAnimais {...props} inicial={inicial ?? animaisIniciais} />;
}
