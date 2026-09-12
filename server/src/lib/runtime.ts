/**
 * Detecta se o código está rodando dentro de um Cloudflare Worker (workerd),
 * em produção ou sob `wrangler dev` — mesmo truque documentado pela própria
 * Cloudflare: `navigator.userAgent` só tem esse valor lá. Em Node (dev local,
 * testes, o processo tradicional) dá `false`.
 *
 * Usado por `db.ts` (escolha do driver adapter do Prisma) e `storage.ts`
 * (travar STORAGE_DRIVER=local, que precisa de filesystem, dentro do Worker).
 */
export function isCloudflareWorkers(): boolean {
  const runtime = globalThis as { navigator?: { userAgent?: string } };
  return runtime.navigator?.userAgent === "Cloudflare-Workers";
}
