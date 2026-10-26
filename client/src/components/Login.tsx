import { useRef, useState } from "react";
import { useSignIn } from "@clerk/react/legacy";
import { TerranoSymbol } from "./TerranoLogo";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.52h3.15c1.84-1.7 2.9-4.2 2.9-7.29Z" />
      <path fill="#34A853" d="M12 21.75c2.62 0 4.82-.87 6.43-2.35L15.28 17c-.87.58-1.98.92-3.28.92-2.52 0-4.66-1.7-5.42-4v2.6H3.33A9.72 9.72 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.58 13.92A5.85 5.85 0 0 1 6.28 12c0-.67.12-1.32.3-1.92V7.48H3.33A9.72 9.72 0 0 0 2.25 12c0 1.57.38 3.05 1.08 4.52l3.25-2.6Z" />
      <path fill="#EA4335" d="M12 6.08c1.42 0 2.69.49 3.69 1.44l2.76-2.76C16.81 3.23 14.62 2.25 12 2.25a9.72 9.72 0 0 0-8.67 5.23l3.25 2.6c.76-2.3 2.9-4 5.42-4Z" />
    </svg>
  );
}

export function Login() {
  const { isLoaded, signIn } = useSignIn();
  const [erro, setErro] = useState<string | null>(null);
  const emCurso = useRef(false);

  const entrar = async () => {
    if (!isLoaded || !signIn || emCurso.current) return;
    emCurso.current = true;
    setErro(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch {
      emCurso.current = false;
      setErro("Não foi possível iniciar o acesso com Google. Tente novamente.");
    }
  };

  return (
    <main className="login-cooperativa min-h-[100dvh] bg-[#edf2ed] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-[1240px] overflow-hidden rounded-2xl border border-[#d8e2da] bg-white shadow-[0_18px_48px_rgba(34,53,44,.10)] lg:grid-cols-[.9fr_1.1fr]">
        <aside className="hidden bg-[#24493b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3"><TerranoSymbol size={30} tone="dark" strokeWidth={4} /><b>Terrano</b></div>
          <div>
            <p className="text-sm font-bold tracking-[.14em] text-[#c8dacb]">GESTÃO DA FAZENDA</p>
            <h1 className="mt-5 max-w-md text-5xl font-semibold leading-tight">O trabalho da fazenda, no mesmo lugar.</h1>
            <p className="mt-5 max-w-md text-lg text-[#d9e6dc]">Financeiro, estoque e pecuária organizados para a rotina da operação.</p>
          </div>
          <small className="text-[#c8dacb]">Acesso protegido para pessoas autorizadas.</small>
        </aside>
        <section className="flex items-center justify-center px-7 py-12 sm:px-14">
          <div className="w-full max-w-[408px]">
            <div className="mb-12 flex items-center gap-3 lg:hidden"><TerranoSymbol size={28} tone="light" strokeWidth={4} /><b className="text-xl">Terrano</b></div>
            <p className="text-sm font-bold text-[#006f68]">Acesso ao Terrano</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[#203c39]">Entre com sua conta Google</h2>
            <p className="mt-4 leading-6 text-[#526863]">Use o e-mail que a gestão cadastrou para você. Seus acessos continuam definidos dentro do Terrano.</p>
            <button type="button" disabled={!isLoaded} onClick={() => void entrar()} className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#7a928d] bg-white font-semibold text-[#203c39] hover:bg-[#f1f5f4] disabled:opacity-60">
              <GoogleMark />
              Continuar com Google
            </button>
            {erro && <p role="alert" className="mt-4 text-sm text-[#8d3931]">{erro}</p>}
            <div className="mt-7 border-t pt-5 text-sm leading-5 text-[#526863]">
              Não encontrou acesso? Peça à gestão para cadastrar seu e-mail antes de entrar.
              <a className="mt-3 block font-semibold text-[#006f68] hover:underline" href="https://wa.me/5532984043943?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20acessar%20o%20Terrano." target="_blank" rel="noreferrer">
                Entrar em contato com a gestão
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
