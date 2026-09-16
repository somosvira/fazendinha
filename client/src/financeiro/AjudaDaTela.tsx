import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import type { AjudaTela } from "./ajuda";
import { Modal } from "./financeiro-ui";

/* Botão "?" ao lado do título: abre um resumo do que a tela faz. */
export function AjudaDaTela({ titulo, ajuda }: { titulo: string; ajuda: AjudaTela }) {
  const [aberta, setAberta] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberta]);

  return <>
    <button type="button" onClick={() => setAberta(true)} aria-label={`Como funciona: ${titulo}`} title="Como funciona esta tela" className="inline-flex shrink-0 rounded-full p-1 align-middle text-ink-3 transition hover:bg-surface-2 hover:text-ink">
      <CircleHelp size={20} />
    </button>
    {aberta && <Modal titulo={titulo} eyebrow="Como funciona" onClose={() => setAberta(false)}>
      <div className="space-y-5 p-5 text-sm leading-6">
        <section><h3 className="font-semibold">Para que serve</h3><p className="mt-1 text-ink-2">{ajuda.paraQueServe}</p></section>
        <section><h3 className="font-semibold">O que você pode fazer aqui</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">{ajuda.acoes.map((acao) => <li key={acao}>{acao}</li>)}</ul></section>
        {ajuda.bomSaber?.length ? <section className="rounded-lg bg-surface-2 p-4"><h3 className="font-semibold">Bom saber</h3><ul className="mt-1 space-y-1 text-ink-2">{ajuda.bomSaber.map((dica) => <li key={dica}>{dica}</li>)}</ul></section> : null}
      </div>
    </Modal>}
  </>;
}
