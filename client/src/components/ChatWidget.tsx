import { Button } from "./ui/button";

const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)]+\))/g;
const LINK = /^\[([^\]]+)\]\((\/[^)]+)\)$/;

export function Formatado({ texto, onNavegar }: { texto: string; onNavegar?: (url: string) => void }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => (
        <span key={i} className="block min-h-px">
          {linha.split(TOKEN).map((parte, j) => {
            if (parte.startsWith("**") && parte.endsWith("**")) {
              return <strong key={j}>{parte.slice(2, -2)}</strong>;
            }
            const link = LINK.exec(parte);
            if (link) {
              const [, rotulo, url] = link;
              return onNavegar ? (
                <button key={j} type="button" className="cursor-pointer bg-transparent p-0 text-primary underline" onClick={() => onNavegar(url)}>
                  {rotulo}
                </button>
              ) : (
                <span key={j}>{rotulo}</span>
              );
            }
            return <span key={j}>{parte}</span>;
          })}
        </span>
      ))}
    </>
  );
}

// Um único chat, com contexto e áudio, na tela do assistente.
export function ChatWidget({ onNavegar }: { onNavegar?: (url: string) => void }) {
  return <Button type="button" className="fixed bottom-5 right-5 z-30 min-h-12 rounded-full px-5 shadow-lg print:hidden" onClick={() => onNavegar?.("/ia")} aria-label="Abrir assistente financeiro">Perguntar ao financeiro</Button>;
}
