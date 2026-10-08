import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NotaFiscalAnexo({ arquivo, salvo, disabled, onArquivo }: {
  arquivo: File | null; salvo: boolean; disabled: boolean; onArquivo: (arquivo: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const bloqueado = disabled || salvo;
  const selecionar = (arquivos: File[]) => {
    if (bloqueado) return;
    setErro(null);
    if (arquivos.length !== 1) { setErro("Selecione uma nota por vez."); return; }
    const novo = arquivos[0];
    if (!/\.(pdf|xml|jpe?g|png|webp)$/i.test(novo.name)) { setErro("Formato não suportado. Envie PDF, XML, JPG, PNG ou WEBP."); return; }
    if (!novo.size || novo.size > 10 * 1024 * 1024) { setErro("Envie um arquivo não vazio de até 10 MB."); return; }
    onArquivo(novo);
  };
  return <section className="mt-5 space-y-2" aria-label="Nota fiscal">
    <h3 className="text-sm font-medium">Nota fiscal <span className="font-normal text-muted-foreground">(opcional)</span></h3>
    <div onDragOver={event => { event.preventDefault(); if (!bloqueado) setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={event => { event.preventDefault(); setArrastando(false); selecionar(Array.from(event.dataTransfer.files)); }}
      data-arrastando={arrastando} className="fin-dropzone rounded-lg border border-dashed p-4 text-center text-sm">
      <Input ref={input} type="file" aria-label="Anexar nota fiscal" accept=".pdf,.xml,.jpg,.jpeg,.png,.webp" disabled={bloqueado} className="hidden" onChange={event => { selecionar(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      {arquivo ? <div className="flex items-center gap-3 text-left"><FileText className="size-5 shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="break-all font-medium">{arquivo.name}</p><p role="status" className="text-muted-foreground">{salvo ? "Nota salva na operação vinculada." : `${(arquivo.size / 1024 / 1024).toFixed(2)} MB · será enviada ao confirmar`}</p></div>{!salvo && <Button variant="ghost" size="icon" disabled={disabled} aria-label="Remover nota fiscal" onClick={() => onArquivo(null)}><X aria-hidden="true" /></Button>}</div>
        : <><Upload className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden="true" /><p>Arraste a nota fiscal aqui ou</p><Button variant="link" disabled={bloqueado} onClick={() => input.current?.click()}>Selecionar arquivo</Button><p className="text-muted-foreground">PDF, XML, JPG, PNG ou WEBP · até 10 MB</p></>}
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <p className="text-sm text-muted-foreground">O anexo fica nos documentos da operação, inclusive se a liquidação precisar ser tentada novamente.</p>
  </section>;
}
