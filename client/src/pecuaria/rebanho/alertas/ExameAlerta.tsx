import { useRef } from "react";
import { FormFatoSanitario } from "../sanidade/FormFatoSanitario";
import { reqSanidade } from "../sanidade/api";

export function ExameAlerta({ alertaId, revisao, animalId, tipoExameId, propriedadeId, titulo, onFechar, onSalvo }: {
  alertaId: string; revisao: number; animalId: string; tipoExameId?: string | null; propriedadeId: number;
  titulo: string; onFechar: () => void; onSalvo: () => void;
}) {
  const recibo = useRef({ entrada: "", chave: crypto.randomUUID() });
  return <FormFatoSanitario tipo="exame" fixo animalInicial={animalId} cadastroInicial={tipoExameId ?? ""} propriedadeId={propriedadeId}
    onFechar={onFechar} onSalvo={onSalvo} conteudoExtra={<p><strong>{titulo}</strong><br />O cuidado só será atendido quando houver um resultado válido.</p>}
    onRegistrar={async input => {
      const entrada = JSON.stringify(input);
      if (recibo.current.entrada !== entrada) recibo.current = { entrada, chave: crypto.randomUUID() };
      await reqSanidade("/exames", { method: "POST", body: JSON.stringify({ ...input, chave: recibo.current.chave, alertaId, alertaRevisao: revisao, confirmarCuidadoAlerta: true }) }, propriedadeId);
    }} />;
}
