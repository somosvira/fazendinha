const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
const MAX_PRINT_BYTES = 2 * 1024 * 1024;

export async function prepararPrint(arquivo: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(arquivo.type) || arquivo.size > MAX_ORIGINAL_BYTES) throw new Error("Escolha um print PNG, JPG ou WebP de até 8 MB.");
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    await new Promise<void>((resolve, reject) => { imagem.onload = () => resolve(); imagem.onerror = () => reject(new Error("Não foi possível abrir esse print.")); imagem.src = url; });
    if (!imagem.naturalWidth || !imagem.naturalHeight || imagem.naturalWidth * imagem.naturalHeight > 40_000_000) throw new Error("Print muito grande. Recorte a área que deseja consultar.");
    const escala = Math.min(1, 1600 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala)); canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar o print neste navegador.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    // Reencodar remove metadados e reduz os pixels/tokens enviados ao modelo.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    if (dataUrl.length > Math.ceil(MAX_PRINT_BYTES / 3) * 4 + 40) throw new Error("Print muito grande. Recorte a área desejada e tente novamente.");
    return dataUrl;
  } finally { URL.revokeObjectURL(url); }
}

/** Normalização canônica, compartilhada pela gravação e pelo upload de áudio. */
export function codificarWav(canais: Float32Array[], taxaOriginal: number, cortar = false): Blob {
  if (!canais.length || !canais[0].length || !Number.isFinite(taxaOriginal) || taxaOriginal < 8000) throw new Error("Áudio inválido.");
  const duracao = canais[0].length / taxaOriginal;
  if (duracao > 60 && !cortar) throw new Error("Escolha um áudio de até 60 segundos.");
  if (duracao < 0.1) throw new Error("O áudio ficou muito curto. Grave novamente.");
  const taxa = 16000;
  const amostras = Math.min(taxa * 60, Math.floor(duracao * taxa));
  const buffer = new ArrayBuffer(44 + amostras * 2);
  const view = new DataView(buffer);
  const texto = (offset: number, valor: string) => { for (let i = 0; i < valor.length; i++) view.setUint8(offset + i, valor.charCodeAt(i)); };
  texto(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); texto(8, "WAVE"); texto(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, taxa, true);
  view.setUint32(28, taxa * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); texto(36, "data"); view.setUint32(40, amostras * 2, true);
  for (let i = 0; i < amostras; i++) {
    const pos = i * taxaOriginal / taxa; const base = Math.floor(pos); const frac = pos - base;
    const valor = canais.reduce((s, canal) => s + (canal[base] ?? 0) * (1 - frac) + (canal[Math.min(base + 1, canal.length - 1)] ?? 0) * frac, 0) / canais.length;
    const normalizado = Math.max(-1, Math.min(1, valor));
    view.setInt16(44 + i * 2, Math.round(normalizado * (normalizado < 0 ? 32768 : 32767)), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
export async function prepararAudio(arquivo: Blob, cortar = false) {
  if (arquivo.size > MAX_ORIGINAL_BYTES) throw new Error("Escolha um áudio de até 8 MB e 60 segundos.");
  if (typeof AudioContext === "undefined") throw new Error("Este navegador não consegue preparar áudio. Digite sua pergunta.");
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await arquivo.arrayBuffer());
    return codificarWav(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i)), audio.sampleRate, cortar);
  } catch (e) {
    if (e instanceof Error && /60 segundos|muito curto/.test(e.message)) throw e;
    throw new Error("Não foi possível abrir esse áudio. Tente outro formato ou grave pelo microfone.");
  } finally { await ctx.close(); }
}
