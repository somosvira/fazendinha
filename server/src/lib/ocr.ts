// Wrapper de OCR via Tesseract.js (gratuito, roda em Node).
// Quando OCR_ENABLED=false (default em dev), retorna texto nulo — a validação
// assíncrona vai marcar status como ATENCAO em vez de tentar OCR.
//
// Trade-off: Tesseract é mais lento (~30s/doc) e tem qualidade inferior ao
// Textract em fotos de papel amassado. Em PDF nativo e fotos bem iluminadas,
// qualidade é boa o suficiente para a regex de validação (CNPJ, chave NFe, termos).

import { env } from "../env.js";

export type OcrResultado =
  | { texto: string; modo: "tesseract" }
  | { texto: null; modo: "disabled" | "erro"; mensagem?: string };

// Worker singleton — Tesseract carrega ~70MB de language data português na
// primeira chamada e cacheia. Subsequentes ficam rápidas.
let workerPromise: Promise<any> | null = null;

async function getWorker(): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("por");
    })();
    // Se falhar, limpa pra próxima tentativa não cair no mesmo cache quebrado.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

export async function detectText(buffer: Buffer): Promise<OcrResultado> {
  if (!env.OCR_ENABLED) return { texto: null, modo: "disabled" };

  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    return { texto: data?.text ?? "", modo: "tesseract" };
  } catch (e: any) {
    console.error("[ocr] erro:", e?.message ?? e);
    return { texto: null, modo: "erro", mensagem: e?.message ?? String(e) };
  }
}
