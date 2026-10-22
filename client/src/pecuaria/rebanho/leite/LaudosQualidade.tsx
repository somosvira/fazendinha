import { useRef, useState } from "react";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import type { AmostraQualidade } from "./qualidade-types";
export function LaudosQualidade({
  amostra,
  sitio,
  podeLancar,
}: {
  amostra: AmostraQualidade;
  sitio: number | null;
  podeLancar: boolean;
}) {
  const [laudos, setLaudos] = useState(amostra.laudos),
    [erro, setErro] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  async function anexar(arquivo: File) {
    if (trava.current) return;
    setErro("");
    setAviso("");
    if (arquivo.size > 10 * 1024 * 1024 || arquivo.size === 0) {
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
      const caminho = `/qualidade/amostras/${amostra.id}/laudos`;
      const intencao = await registrarLeite<{
        uploadToken: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>(
        `${caminho}/upload`,
        sitio,
        {
          propriedadeId: amostra.propriedadeId,
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
        throw new Error("Não foi possível enviar o laudo ao armazenamento.");
      await registrarLeite(
        `${caminho}/confirmar`,
        sitio,
        { propriedadeId: amostra.propriedadeId, uploadToken: intencao.uploadToken },
        false,
      );
      const atualizada = await consultarLeite<AmostraQualidade>(
        `/qualidade/amostras/${amostra.id}`,
        sitio,
      );
      setLaudos(atualizada.laudos);
      setAviso("Laudo anexado.");
      if (arquivoRef.current) arquivoRef.current.value = "";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio do laudo");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  async function baixar(id: string) {
    setErro("");
    try {
      const { url } = await consultarLeite<{ url: string }>(
        `/qualidade/amostras/${amostra.id}/laudos/${id}/download`,
        sitio,
      );
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      link.click();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na abertura do laudo");
    }
  }
  return (
    <section aria-label="Arquivos do laudo">
      <h3>Arquivos do laudo</h3>
      {laudos.length ? (
        <ul>
          {laudos.map((l) => (
            <li key={l.id}>
              <button
                className="leite-secondary"
                type="button"
                onClick={() => void baixar(l.id)}
              >
                Abrir {l.nome}
              </button>{" "}
              · {Math.ceil(l.tamanhoBytes / 1024)} KB
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum arquivo anexado.</p>
      )}
      {podeLancar && (
        <label>
          Anexar laudo (até 10 MB)
          <input
            type="file"
            ref={arquivoRef}
            disabled={ocupado}
            accept="application/pdf,image/jpeg,image/png,image/webp,application/xml,text/xml"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void anexar(arquivo);
            }}
          />
        </label>
      )}
      {ocupado && <p role="status">Enviando laudo…</p>}
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
