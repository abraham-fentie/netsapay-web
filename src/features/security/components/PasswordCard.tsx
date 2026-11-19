"use client";
import { useMemo, useState } from "react";
import { Button, Card, ErrorText, Input, PasswordInput, useToast } from "@/components/ui";
import { NewPasswordFields, passwordsOk } from "@/features/auth";
import { useAction } from "@/hooks/useAction";
import { personalWords } from "@/lib/password";
import { useSession } from "@/providers/SessionProvider";
import { securityApi } from "../api";

/**
 * Change password in two steps:
 *   1. the user TYPES the current password (never pre-filled, never shown);
 *      the API checks it (a wrong one counts towards the account lock);
 *   2. only then the new password and an authenticator code are asked.
 * The current password stays in memory only until the change is sent.
 */
export function PasswordCard() {
  const { me } = useSession();
  const [step, setStep] = useState<"verify" | "change">("verify");
  const [current, setCurrent] = useState("");
  const [unlocked, setUnlocked] = useState(false); // read-only until focused: browsers do not autofill it
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [code, setCode] = useState("");
  const [attempted, setAttempted] = useState(false);
  const verify = useAction();
  const change = useAction();
  const toast = useToast();
  const personal = useMemo(() => personalWords(me?.email?.split("@")[0], me?.name), [me]);

  const reset = () => { setStep("verify"); setCurrent(""); setPw(""); setPw2(""); setCode(""); setAttempted(false); setUnlocked(false); };

  const checkCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) { verify.setError("Enter your current password."); return; }
    const ok = await verify.run(() => securityApi.verifyPassword(current));
    if (ok) setStep("change");
    else setCurrent(""); // never keep a wrong password around
  };

  const ready = passwordsOk(pw, pw2, personal) && code.length === 6;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!ready) return;
    if (pw === current) { change.setError("Choose a password different from the current one."); return; }
    const ok = await change.run(() => securityApi.changePassword({ current_password: current, new_password: pw, totp_code: code }));
    if (ok) { reset(); toast("Password changed. Other sessions were signed out."); }
  };

  if (step === "verify") {
    return (
      <Card title="Password" description="To change it, first confirm your current password. Changing it signs out your other sessions.">
        <form className="stack" onSubmit={checkCurrent} style={{ maxWidth: 520 }} autoComplete="off">
          <PasswordInput label="Current password" reveal={false} required value={current}
            name="confirm-current-secret" autoComplete="off" data-lpignore="true" data-1p-ignore="true"
            readOnly={!unlocked} onFocus={() => setUnlocked(true)}
            onChange={(e) => setCurrent(e.target.value)} />
          <ErrorText error={verify.error} />
          <div><Button type="submit" variant="primary" loading={verify.busy}>Continue</Button></div>
        </form>
      </Card>
    );
  }

  return (
    <Card title="Password" description="Current password confirmed. Choose a new one and enter a code from your authenticator app.">
      <form className="stack" onSubmit={submit} style={{ maxWidth: 520 }}>
        <NewPasswordFields password={pw} confirm={pw2} onPassword={setPw} onConfirm={setPw2} personal={personal} label="New password" showErrors={attempted} />
        <Input label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} required value={code} valid={code.length === 6}
          error={attempted && code.length > 0 && code.length !== 6 ? "Enter the 6-digit code from the app." : undefined}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <ErrorText error={change.error} />
        <div className="cluster">
          <Button type="submit" variant="primary" loading={change.busy}>Change password</Button>
          <Button variant="ghost" onClick={reset}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
