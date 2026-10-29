"use client";

import { useRef, type ReactNode } from "react";

export function AdminDialog({
  buttonLabel,
  title,
  children,
}: {
  buttonLabel: string;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg bg-[#F5C542] px-5 py-3 text-sm font-bold text-[#070D24] transition hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542]"
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        className="m-auto max-h-[90vh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-[#243775] bg-[#0C1638] p-0 text-[#EEF2FF] shadow-2xl backdrop:bg-[#030817]/80"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#243775] bg-[#0C1638] px-5 py-4 sm:px-7">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close dialog"
            className="rounded-lg border border-[#243775] px-3 py-1.5 text-sm text-[#9FB0E6] transition hover:border-[#F5C542] hover:text-[#EEF2FF]"
          >
            Close
          </button>
        </div>
        <div className="p-5 sm:p-7">{children}</div>
      </dialog>
    </>
  );
}
