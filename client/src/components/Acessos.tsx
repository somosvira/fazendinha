/* Rio Novo — Acessos (controle de permissões, admin).
 * Port de src/components/Acessos.jsx. Lê PAPEIS/ABAS/FLAGS de data/acessos.
 */

import { useState } from "react";
import { ABAS, FLAGS, PAPEIS, type User } from "../data/acessos";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";

/* validação simples de email (suficiente p/ feedback antes do envio real) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* status-badge base + tom por status (era .status-badge{.ativo|.pendente|.inativo}) */
const STATUS_BADGE_BASE =
  "whitespace-nowrap border border-current px-[9px] py-[3px] text-[11px] tracking-[0.06em]";
function StatusBadge({ status }: { status: User["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    ativo: { label: "Ativo", cls: "text-[color:var(--pos)]" },
    pendente: { label: "Convite pendente", cls: "text-[color:var(--warn)]" },
    inativo: { label: "Inativo", cls: "text-[color:var(--ink-mute)]" },
  };
  const s = map[status] || map.ativo;
  return <span className={STATUS_BADGE_BASE + " " + s.cls}>{s.label}</span>;
}

/* dono-tag / admin-tag (pequenas etiquetas outline) */
const DONO_TAG =
  "border border-leite px-[6px] py-px text-[9px] uppercase tracking-[0.16em] text-leite";
const ADMIN_TAG =
  "ml-2 inline-block border border-[color:var(--neg)] px-[5px] py-px align-middle text-[9px] uppercase tracking-[0.14em] text-[color:var(--neg)]";

function InviteModal({
  onClose,
  onInvite,
  existingEmails,
}: {
  onClose: () => void;
  onInvite: (v: { nome: string; email: string; papel: string }) => void;
  existingEmails: string[];
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("gestor");
  const [touched, setTouched] = useState(false);

  const emailNorm = email.trim().toLowerCase();
  const emailJaExiste = !!emailNorm && existingEmails.includes(emailNorm);
  const emailInvalido = !!emailNorm && !EMAIL_RE.test(emailNorm);
  const emailErr = touched
    ? emailInvalido
      ? "E-mail inválido."
      : emailJaExiste
        ? "Já existe um acesso com esse e-mail."
        : null
    : null;
  const podeEnviar = !!nome.trim() && !!emailNorm && !emailInvalido && !emailJaExiste;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="invite-ttl">
        <div className="modal-head">
          <span className="ttl" id="invite-ttl">Convidar pessoa</span>
          <button className="close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label" htmlFor="inv-nome">Nome</label>
            <input
              id="inv-nome" className="field-input" value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Sandra Oliveira"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="inv-email">E-mail</label>
            <input
              id="inv-email"
              className={"field-input" + (emailErr ? " is-error" : "")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="pessoa@email.com"
              aria-invalid={!!emailErr}
              aria-describedby={emailErr ? "inv-email-err" : undefined}
            />
            {emailErr && <span id="inv-email-err" className="field-error">{emailErr}</span>}
          </div>
          <div className="field">
            <label className="field-label">Papel inicial</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(PAPEIS)
                .filter(([k]) => k !== "proprietario")
                .map(([k, p]) => (
                  <button
                    key={k}
                    type="button"
                    className={
                      "flex w-full cursor-pointer items-start gap-3 border bg-transparent px-4 py-[13px] text-left hover:border-[color:var(--ink-3)] " +
                      (papel === k
                        ? "border-[color:var(--ink)] bg-[color:var(--bg-card-2)]"
                        : "border-[color:var(--rule)]")
                    }
                    onClick={() => setPapel(k)}
                  >
                    <span className="mt-px text-[14px] text-[color:var(--ink)]">{papel === k ? "●" : "○"}</span>
                    <span className="flex flex-col gap-0.5">
                      <strong className="text-[15px] font-bold text-[color:var(--ink)]">{p.nome}</strong>
                      <small className="text-[12px] leading-[1.4] text-ink-3">{p.desc}</small>
                    </span>
                  </button>
                ))}
            </div>
          </div>
          <div className="caption" style={{ fontStyle: "italic" }}>
            A pessoa recebe um e-mail com link de acesso. Você pode ajustar exatamente o que ela vê depois de convidar.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!podeEnviar}
            onClick={() => { setTouched(true); if (podeEnviar) onInvite({ nome: nome.trim(), email: emailNorm, papel }); }}
          >
            Enviar convite →
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionEditor({
  user,
  onChange,
  onViewAs,
  onResendInvite,
  onRevoke,
}: {
  user: User;
  onChange: (u: User) => void;
  onViewAs: (id: string) => void;
  onResendInvite: (u: User) => void;
  onRevoke: (u: User) => void;
}) {
  const applyPreset = (papelId: string) => {
    const preset = PAPEIS[papelId];
    onChange({ ...user, papel: papelId, abas: [...preset.abas], flags: [...preset.flags] });
  };
  const toggleAba = (id: string) => {
    const has = user.abas.includes(id);
    onChange({ ...user, abas: has ? user.abas.filter((a) => a !== id) : [...user.abas, id], papel: "personalizado" });
  };
  const toggleFlag = (id: string) => {
    const has = user.flags.includes(id);
    onChange({ ...user, flags: has ? user.flags.filter((f) => f !== id) : [...user.flags, id], papel: "personalizado" });
  };

  const papelNome = user.papel === "personalizado" ? "Personalizado" : PAPEIS[user.papel]?.nome || "—";

  /* .perm-row base + estado .on/.admin (transição border+bg 80ms) */
  const permRow =
    "flex cursor-pointer items-start gap-3 border bg-transparent px-[14px] py-[13px] text-left transition-[border-color,background] duration-[80ms] hover:border-[color:var(--ink-3)]";
  const permRowClass = (on: boolean) =>
    permRow + (on ? " border-[color:var(--rule)] bg-[color:var(--bg-card-2)]" : " border-[color:var(--rule-soft)]");
  /* .perm-check base; data-on=true → preenche (ink) ou neg quando linha .admin */
  const permCheck =
    "mt-px grid h-[18px] w-[18px] flex-none place-items-center border-[1.5px] border-[color:var(--rule)] data-[on=true]:border-[color:var(--ink)] data-[on=true]:bg-[color:var(--ink)]";
  const permCheckAdmin =
    permCheck + " data-[on=true]:border-[color:var(--neg)] data-[on=true]:bg-[color:var(--neg)]";

  return (
    <div className="border border-[color:var(--rule)] bg-[color:var(--bg-card)]">
      <div className="flex items-center justify-between border-b border-[color:var(--rule)] bg-[color:var(--bg-card-2)] px-[26px] py-[22px]">
        <div className="flex items-center gap-[14px]">
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-mast font-serif text-[22px] text-mast-ink">{user.inicial}</div>
          <div>
            <div className="flex items-center gap-2.5 font-serif text-[22px] tracking-[-0.01em]">
              {user.nome}
              {user.dono && <span className={DONO_TAG}>dono</span>}
            </div>
            <div className="mt-0.5 text-[13px] text-ink-3">{user.email}</div>
          </div>
        </div>
        <StatusBadge status={user.status} />
      </div>

      {user.dono ? (
        <div className="px-[26px] py-[30px]">
          <span className="font-serif font-medium" style={{ fontSize: 17 }}>
            Acesso total e irrevogável.
          </span>
          <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.6] text-ink-3">Como proprietário, Marco vê tudo e é o único que gerencia acessos. Esse papel não pode ser reduzido.</p>
        </div>
      ) : (
        <>
          <div className="border-b border-[color:var(--rule-soft)] px-[26px] py-[22px]">
            <div className="mb-[14px] flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-3">Papel</span>
              <span className="font-serif text-[15px] italic text-[color:var(--ink)]">{papelNome}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PAPEIS)
                .filter(([k]) => k !== "proprietario")
                .map(([k, p]) => (
                  <button
                    key={k}
                    className={
                      "cursor-pointer border px-[14px] py-2 font-sans text-[13px] tracking-[0.01em] " +
                      (user.papel === k
                        ? "border-[color:var(--mast-bg)] bg-mast text-mast-ink"
                        : "border-[color:var(--rule)] bg-transparent text-ink-2 hover:border-[color:var(--ink-3)] hover:text-[color:var(--ink)]")
                    }
                    onClick={() => applyPreset(k)}
                    title={p.desc}
                  >
                    {p.nome}
                  </button>
                ))}
            </div>
          </div>

          <div className="border-b border-[color:var(--rule-soft)] px-[26px] py-[22px]">
            <div className="mb-[14px] flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-3">Abas que pode ver</span>
              <span className="text-[12px] text-ink-3 tabular-nums">
                {user.abas.length} de {ABAS.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-[1100px]:grid-cols-1">
              {ABAS.map((aba) => {
                const on = user.abas.includes(aba.id);
                return (
                  <button key={aba.id} className={permRowClass(on)} onClick={() => toggleAba(aba.id)}>
                    <span className={permCheck} data-on={on}>
                      {on && <span className="text-[11px] leading-none text-[color:var(--bg-card)]">✓</span>}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="font-sans text-[14px] font-medium text-[color:var(--ink)]">{aba.label}</strong>
                      <small className="text-[12px] leading-[1.4] text-ink-3">{aba.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-b border-[color:var(--rule-soft)] px-[26px] py-[22px]">
            <div className="mb-[14px] flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-3">Permissões sensíveis</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-[1100px]:grid-cols-1">
              {FLAGS.map((flag) => {
                const on = user.flags.includes(flag.id);
                const isAdmin = flag.id === "gerenciarAcessos";
                return (
                  <button key={flag.id} className={permRowClass(on)} onClick={() => toggleFlag(flag.id)}>
                    <span className={isAdmin ? permCheckAdmin : permCheck} data-on={on}>
                      {on && <span className="text-[11px] leading-none text-[color:var(--bg-card)]">✓</span>}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="font-sans text-[14px] font-medium text-[color:var(--ink)]">
                        {flag.label}
                        {isAdmin && <span className={ADMIN_TAG}>admin</span>}
                      </strong>
                      <small className="text-[12px] leading-[1.4] text-ink-3">{flag.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-[26px] py-5">
            <button className="btn-secondary" onClick={() => onViewAs(user.id)}>
              Ver o sistema como {user.nome.split(" ")[0]} →
            </button>
            <div className="flex gap-2.5">
              {user.status === "pendente" && (
                <button className="btn-ghost" onClick={() => onResendInvite(user)}>
                  Reenviar convite
                </button>
              )}
              <button className="btn-ghost danger" onClick={() => onRevoke(user)}>
                Revogar acesso
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Acessos({
  users,
  setUsers,
  onViewAs,
}: {
  users: User[];
  setUsers: (u: User[]) => void;
  onViewAs: (id: string) => void;
}) {
  const toast = useToast();
  const [selId, setSelId] = useState(users[0].id);
  const [showInvite, setShowInvite] = useState(false);
  const [revoking, setRevoking] = useState<User | null>(null);

  const sel = users.find((u) => u.id === selId) || users[0];
  const ativos = users.filter((u) => u.status === "ativo").length;
  const pendentes = users.filter((u) => u.status === "pendente").length;

  const updateUser = (next: User) => setUsers(users.map((u) => (u.id === next.id ? next : u)));
  const invite = ({ nome, email, papel }: { nome: string; email: string; papel: string }) => {
    const preset = PAPEIS[papel];
    const id = "u" + users.length + "-" + nome.trim().toLowerCase().replace(/\s+/g, "");
    const novo: User = {
      id,
      nome,
      email,
      inicial: nome.trim()[0]?.toUpperCase() || "?",
      papel,
      status: "pendente",
      ultimoAcesso: "convite enviado agora",
      abas: [...preset.abas],
      flags: [...preset.flags],
    };
    setUsers([...users, novo]);
    setSelId(id);
    setShowInvite(false);
    toast.success("Convite enviado", `${nome.split(" ")[0]} recebeu o link em ${email}.`);
  };

  const resendInvite = (u: User) => {
    setUsers(users.map((x) => (x.id === u.id ? { ...x, ultimoAcesso: "convite reenviado agora" } : x)));
    toast.info("Convite reenviado", `Novo link foi enviado para ${u.email}.`);
  };

  const confirmRevoke = (u: User) => {
    if (u.dono) {
      toast.error("Não é possível revogar", "O acesso do proprietário é irrevogável.");
      return;
    }
    setRevoking(u);
  };

  const doRevoke = () => {
    if (!revoking) return;
    const u = revoking;
    const sobra = users.filter((x) => x.id !== u.id);
    setUsers(sobra);
    if (selId === u.id) setSelId(sobra[0]?.id || "");
    setRevoking(null);
    toast.success("Acesso revogado", `${u.nome.split(" ")[0]} não tem mais acesso à fazenda.`, {
      action: {
        label: "Desfazer",
        onClick: () => setUsers([...sobra, u]),
      },
    });
  };

  const existingEmails = users.map((u) => u.email.trim().toLowerCase()).filter(Boolean);

  return (
    <div className="shell-wide">
      <div className="mt-[18px] mb-7 grid grid-cols-[repeat(3,1fr)_auto] items-center border border-[color:var(--rule)] bg-[color:var(--bg-card)] max-[1100px]:grid-cols-2">
        <div className="flex flex-col gap-[5px] border-r border-[color:var(--rule-soft)] px-6 py-[18px]">
          <span className="text-[12px] uppercase tracking-[0.14em] text-ink-3">Pessoas com acesso</span>
          <span className="mono-nums font-serif text-[32px] leading-none tracking-[-0.015em]">{ativos}</span>
        </div>
        <div className="flex flex-col gap-[5px] border-r border-[color:var(--rule-soft)] px-6 py-[18px]">
          <span className="text-[12px] uppercase tracking-[0.14em] text-ink-3">Convites pendentes</span>
          <span className="mono-nums font-serif text-[32px] leading-none tracking-[-0.015em]">{pendentes}</span>
        </div>
        <div className="flex flex-col gap-[5px] border-r border-[color:var(--rule-soft)] px-6 py-[18px]">
          <span className="text-[12px] uppercase tracking-[0.14em] text-ink-3">Papéis disponíveis</span>
          <span className="mono-nums font-serif text-[32px] leading-none tracking-[-0.015em]">{Object.keys(PAPEIS).length}</span>
        </div>
        <div className="flex flex-col gap-[5px] px-6 py-[18px]">
          <button className="btn-primary" onClick={() => setShowInvite(true)}>
            + Convidar pessoa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[380px_1fr] items-start gap-8 pb-[60px] max-[1100px]:grid-cols-1">
        <div className="border border-[color:var(--rule)] bg-[color:var(--bg-card)]">
          <div className="border-b border-[color:var(--rule)] bg-[color:var(--bg-card-2)] px-[18px] py-[14px] text-[11px] uppercase tracking-[0.16em] text-ink-3">Equipe & convidados</div>
          {users.map((u) => (
            <button
              key={u.id}
              className={
                "grid w-full cursor-pointer grid-cols-[42px_1fr_auto] items-center gap-[14px] border-0 border-b border-l-[3px] border-b-[color:var(--rule-soft)] bg-transparent px-[18px] py-[14px] pl-[15px] text-left transition-[background] duration-[80ms] last:border-b-0 hover:bg-[color:var(--bg-card-2)] " +
                (selId === u.id ? "border-l-[color:var(--ink)] bg-[color:var(--bg-card-2)]" : "border-l-transparent")
              }
              onClick={() => setSelId(u.id)}
            >
              <div className="grid h-[42px] w-[42px] place-items-center rounded-full bg-mast font-serif text-[18px] text-mast-ink">{u.inicial}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-sans text-[15px] font-medium text-[color:var(--ink)]">
                  {u.nome}
                  {u.dono && <span className={DONO_TAG}>dono</span>}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-3">
                  {u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome} · {u.abas.length} abas
                </div>
              </div>
              <div className="flex flex-col items-end gap-[5px]">
                <StatusBadge status={u.status} />
                <span className="whitespace-nowrap text-[11px] text-[color:var(--ink-mute)]">{u.ultimoAcesso}</span>
              </div>
            </button>
          ))}
        </div>

        <PermissionEditor
          user={sel}
          onChange={updateUser}
          onViewAs={onViewAs}
          onResendInvite={resendInvite}
          onRevoke={confirmRevoke}
        />
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={invite}
          existingEmails={existingEmails}
        />
      )}
      <ConfirmDialog
        open={!!revoking}
        title="Revogar acesso?"
        message={
          revoking ? (
            <>
              <strong>{revoking.nome}</strong> perderá imediatamente o acesso à fazenda.
              Você pode convidar a pessoa novamente a qualquer momento.
            </>
          ) : null
        }
        confirmLabel="Revogar acesso"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={doRevoke}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}
