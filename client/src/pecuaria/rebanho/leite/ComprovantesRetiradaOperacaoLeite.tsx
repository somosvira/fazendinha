import { useEffect, useRef, useState } from "react";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import type { RetiradaOperacaoLeiteDTO } from "./comercial-operacoes-types";
export function ComprovantesRetiradaOperacaoLeite({
  entrega,
  sitio,
  podeLancar,
  onMudou,
}: {
  entrega: RetiradaOperacaoLeiteDTO & { propriedadeId: number };
  sitio: number;
  podeLancar: boolean;
  onMudou: () => void;
}) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const vivo = useRef(true);
  const arquivoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  async function anexar(arquivo: File) {
    if (trava.current) return;
    setErro("");
    if (arquivo.size === 0 || arquivo.size > 10 * 1024 * 1024) {
      setErro("Envie um arquivo não vazio de até 10 MB.");
      return;
    }
    trava.current = true;
    setOcupado(true);
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await arquivo.arrayBuffer(),
      );
      const sha256 = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const caminho = `/comercial/operacoes/retiradas/${entrega.id}/comprovantes`;
      const intencao = await registrarLeite<{
        uploadToken: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>(
        `${caminho}/upload`,
        sitio,
        {
          propriedadeId: entrega.propriedadeId,
          nome: arquivo.name,
          mimeType: arquivo.type,
          tamanhoBytes: arquivo.size,
          sha256,
        },
        false,
      );
      const envio = await fetch(intencao.uploadUrl, {
        method: "PUT",
        headers: intencao.headers,
        body: arquivo,
      });
      if (!envio.ok)
        throw new Error(
          "Não foi possível enviar o comprovante ao armazenamento.",
        );
      await registrarLeite(
        `${caminho}/confirmar`,
        sitio,
        {
          propriedadeId: entrega.propriedadeId,
          uploadToken: intencao.uploadToken,
        },
        false,
      );
      if (vivo.current) {
        if (arquivoRef.current) arquivoRef.current.value = "";
        onMudou();
      }
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível anexar o comprovante.",
        );
    } finally {
      trava.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  async function baixar(id: string) {
    try {
      const { url } = await consultarLeite<{ url: string }>(
        `/comercial/operacoes/retiradas/${entrega.id}/comprovantes/${id}/download`,
        sitio,
      );
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível abrir o comprovante.",
        );
    }
  }
  return (
    <section aria-label={`Comprovantes da entrega ${entrega.referencia}`}>
      <h3>Comprovantes</h3>
      {entrega.comprovantes.length ? (
        <ul>
          {entrega.comprovantes.map((c) => (
            <li key={c.id}>
              <button
                className="leite-secondary"
                type="button"
                onClick={() => void baixar(c.id)}
              >
                Abrir {c.nome}
              </button>{" "}
              · {Math.ceil(c.tamanhoBytes / 1024)} KB
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum comprovante anexado.</p>
      )}
      {podeLancar && (
        <label>
          Anexar comprovante (até 10 MB)
          <input
            ref={arquivoRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,application/xml,text/xml"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void anexar(f);
            }}
          />
        </label>
      )}
      {ocupado && <p role="status">Enviando comprovante…</p>}
      {erro && <p role="alert">{erro}</p>}
    </section>
  );
}
