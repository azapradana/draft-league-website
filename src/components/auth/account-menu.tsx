"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function AccountMenu({
  name,
  email,
  role,
  placement = "bottom",
}: {
  name: string;
  email?: string | null;
  role?: string;
  placement?: "top" | "bottom";
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#EEF2FF] hover:border-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542] [&::-webkit-details-marker]:hidden">
        <span className="grid size-7 place-items-center rounded-full bg-[#F5C542] text-xs font-bold text-[#070D24]">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-40 truncate">{name}</span>
        <span aria-hidden="true" className="text-xs text-[#9FB0E6]">
          ▾
        </span>
      </summary>
      <div
        className={`absolute right-0 z-20 w-64 rounded-xl border border-[#243775] bg-[#0C1638] p-4 shadow-xl ${
          placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9FB0E6]">
          Profile
        </p>
        <p className="mt-2 truncate font-semibold text-[#EEF2FF]">{name}</p>
        {email && <p className="mt-1 truncate text-sm text-[#9FB0E6]">{email}</p>}
        {role && (
          <p className="mt-1 text-xs capitalize text-[#9FB0E6]">
            {role.toLowerCase()}
          </p>
        )}
        <div className="my-4 border-t border-[#243775]" />
        {role === "ADMIN" && (
          <Link
            className="mb-3 block rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#EEF2FF] hover:bg-[#122050] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
            href="/admin"
          >
            Admin dashboard
          </Link>
        )}
        <Link
          className="mb-3 block rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#EEF2FF] hover:bg-[#122050] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
          href="/profile"
        >
          Profile & settings
        </Link>
        <button
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#EEF2FF] hover:bg-[#122050] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
          onClick={() => signOut({ callbackUrl: "/" })}
          type="button"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
