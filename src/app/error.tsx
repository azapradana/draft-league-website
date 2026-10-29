"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070D24] px-4 text-[#EEF2FF]">
      <section
        role="alert"
        className="w-full max-w-lg rounded-2xl border border-red-500/60 bg-[#0C1638] p-8 text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
          Something went wrong
        </p>
        <h1 className="mt-3 text-2xl font-bold">This page could not be loaded.</h1>
        <p className="mt-3 text-[#9FB0E6]">
          Please try again. If the problem continues, contact a tournament admin.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542]"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
