import { BracketTreeSkeleton } from "@/components/ui/Loading";

export default function TournamentOverviewLoading() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="h-4 w-40 animate-pulse motion-reduce:animate-none rounded bg-[#243775]/70" />
        <div className="h-8 w-64 animate-pulse motion-reduce:animate-none rounded bg-[#243775]/70" />
        <div className="h-4 w-80 max-w-full animate-pulse motion-reduce:animate-none rounded bg-[#243775]/70" />
      </section>
      <section className="space-y-4 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <div className="h-6 w-40 animate-pulse motion-reduce:animate-none rounded bg-[#243775]/70" />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse motion-reduce:animate-none rounded bg-[#243775]/40"
            />
          ))}
        </div>
      </section>
      <BracketTreeSkeleton />
    </div>
  );
}
