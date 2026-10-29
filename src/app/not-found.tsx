import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070D24] px-4 text-[#EEF2FF]">
      <section className="w-full max-w-lg rounded-2xl border border-[#243775] bg-[#0C1638] p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          Page not found
        </p>
        <h1 className="mt-3 text-2xl font-bold">This page does not exist.</h1>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542]"
          href="/"
        >
          Go home
        </Link>
      </section>
    </main>
  );
}
