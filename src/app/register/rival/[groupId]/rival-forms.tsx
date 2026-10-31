"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { claimRivalInvitation, registerRivalUser } from "./actions";

const inputClass =
  "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white focus:border-amber-400 focus:outline-none";
const buttonClass =
  "w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60";

export function RivalSignupForm({ groupId, invite }: { groupId: string; invite: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await registerRivalUser(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const signInResult = await signIn("credentials", {
        identifier: String(formData.get("username")),
        password: String(formData.get("password")),
        redirect: false,
      });
      router.push(signInResult?.ok ? "/" : "/login");
      router.refresh();
    } catch {
      setError("Registration could not be completed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="invite" value={invite} />
      <label className="block space-y-2 text-sm">
        <span>Username</span>
        <input
          name="username"
          autoComplete="username"
          className={inputClass}
          maxLength={20}
          minLength={3}
          pattern="[a-z0-9_]{3,20}"
          required
          title="Use 3-20 lowercase letters, numbers, or underscores."
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          minLength={8}
          required
        />
      </label>
      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account & join"}
      </button>
    </form>
  );
}

export function ClaimInvitationButton({
  groupId,
  invite,
  groupName,
}: {
  groupId: string;
  invite: string;
  groupName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setError("");
    setPending(true);
    const formData = new FormData();
    formData.set("groupId", groupId);
    formData.set("invite", invite);
    try {
      const result = await claimRivalInvitation(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button className={buttonClass} disabled={pending} onClick={onClick} type="button">
        {pending ? "Joining…" : `Join ${groupName}`}
      </button>
      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
