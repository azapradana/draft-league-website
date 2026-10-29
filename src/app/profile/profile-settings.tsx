"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ProfileSettings({
  googleEmail,
  googleEnabled,
  googleLinked: initialGoogleLinked,
  canUnlinkGoogle,
  hasPassword,
}: {
  googleEmail: string | null;
  googleEnabled: boolean;
  googleLinked: boolean;
  canUnlinkGoogle: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [googleLinked, setGoogleLinked] = useState(initialGoogleLinked);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [googleMessage, setGoogleMessage] = useState("");
  const [googleError, setGoogleError] = useState("");

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Your new passwords do not match.");
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setPasswordError("Your new password must be no more than 72 UTF-8 bytes.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setPasswordError(result.error ?? "Your password could not be updated.");
        return;
      }

      setPasswordMessage(result.message ?? "Your password has been updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Your password could not be updated. Check your connection and try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function unlinkGoogle() {
    if (!window.confirm("Unlink Google from your Draft League account?")) {
      return;
    }

    setGoogleMessage("");
    setGoogleError("");
    setUnlinkingGoogle(true);

    try {
      const response = await fetch("/api/profile/google", {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setGoogleError(result.error ?? "Your Google account could not be unlinked.");
        return;
      }

      setGoogleLinked(false);
      setGoogleMessage(result.message ?? "Your Google account has been unlinked.");
      router.refresh();
    } catch {
      setGoogleError("Your Google account could not be unlinked. Check your connection and try again.");
    } finally {
      setUnlinkingGoogle(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F5C542]">
            Credentials
          </p>
          <h3 className="mt-1 text-xl font-bold">Change password</h3>
          <p className="mt-2 text-sm leading-6 text-[#9FB0E6]">
            Verify your current password before choosing a new one.
          </p>
        </div>

        {hasPassword ? (
          <form className="space-y-4" onSubmit={changePassword}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
                Current password
              </span>
              <input
                autoComplete="current-password"
                className="w-full rounded-xl border border-[#243775] bg-[#070D24] px-4 py-3 text-sm outline-none transition focus:border-[#F5C542]"
                minLength={1}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">New password</span>
              <input
                autoComplete="new-password"
                className="w-full rounded-xl border border-[#243775] bg-[#070D24] px-4 py-3 text-sm outline-none transition focus:border-[#F5C542]"
                maxLength={72}
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
              <span className="mt-1.5 block text-xs text-[#7181B3]">
                Use at least 8 characters.
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
                Confirm new password
              </span>
              <input
                autoComplete="new-password"
                className="w-full rounded-xl border border-[#243775] bg-[#070D24] px-4 py-3 text-sm outline-none transition focus:border-[#F5C542]"
                maxLength={72}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            {passwordError && (
              <p className="text-sm text-rose-300" role="alert">{passwordError}</p>
            )}
            {passwordMessage && (
              <p className="text-sm text-emerald-300" role="status">{passwordMessage}</p>
            )}
            <button
              className="min-h-11 rounded-xl bg-[#F5C542] px-5 py-3 text-sm font-extrabold text-[#070D24] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={savingPassword}
              type="submit"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <p className="rounded-xl border border-[#243775] bg-[#070D24] p-4 text-sm leading-6 text-[#9FB0E6]">
            This account does not have a password. Sign in with your linked provider to keep
            accessing Draft League.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F5C542]">
            Connected accounts
          </p>
          <h3 className="mt-1 text-xl font-bold">Google</h3>
          <p className="mt-2 text-sm leading-6 text-[#9FB0E6]">
            Use Google as another way to sign in to your account.
          </p>
        </div>

        {googleLinked ? (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4">
            <p className="font-semibold text-emerald-200">Linked to Google</p>
            <p className="mt-1 break-all text-sm text-[#9FB0E6]">
              {googleEmail ?? "Google account connected"}
            </p>
          </div>
        ) : googleEnabled ? (
          <button
            className="min-h-11 rounded-xl border border-[#243775] px-5 py-3 text-sm font-bold transition hover:border-[#F5C542] hover:bg-[#122050]"
            onClick={() => signIn("google", { callbackUrl: "/profile" })}
            type="button"
          >
            Link Google account
          </button>
        ) : (
          <p className="rounded-xl border border-[#243775] bg-[#070D24] p-4 text-sm leading-6 text-[#9FB0E6]">
            Google sign-in is not enabled on this site.
          </p>
        )}

        {googleLinked && googleEnabled && (
          <div className="mt-4">
            {!canUnlinkGoogle && (
              <p className="mb-3 text-sm leading-6 text-[#9FB0E6]">
                Add another sign-in method before unlinking Google.
              </p>
            )}
            <button
              className="min-h-11 rounded-xl border border-rose-300/30 px-5 py-3 text-sm font-bold text-rose-200 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={unlinkingGoogle || !canUnlinkGoogle}
              onClick={unlinkGoogle}
              type="button"
            >
              {unlinkingGoogle ? "Unlinking…" : "Unlink Google"}
            </button>
          </div>
        )}
        {googleError && <p className="mt-4 text-sm text-rose-300" role="alert">{googleError}</p>}
        {googleMessage && (
          <p className="mt-4 text-sm text-emerald-300" role="status">{googleMessage}</p>
        )}
      </section>
    </div>
  );
}
