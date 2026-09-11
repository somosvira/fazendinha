import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = Omit<ComponentProps<typeof Input>, "type">;

export function CampoSenha({ className = "", ...props }: Props) {
  const [visivel, setVisivel] = useState(false);
  const rotulo = visivel ? "Ocultar senha" : "Mostrar senha";

  return (
    <div className="relative flex items-center">
      <Input {...props} type={visivel ? "text" : "password"} className={`${className} pr-[42px]`} />
      <button
        type="button"
        aria-label={rotulo}
        title={rotulo}
        aria-pressed={visivel}
        onClick={() => setVisivel((valor) => !valor)}
        className={`absolute right-[13px] flex h-5 w-5 items-center justify-center transition-colors ${visivel ? "text-[color:var(--cafe)]" : "text-[color:var(--ink-mute)]"} hover:text-[color:var(--ink-2)]`}
      >
        {visivel ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
      </button>
    </div>
  );
}
