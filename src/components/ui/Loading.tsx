function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none rounded-lg bg-[#243775]/70 ${className}`}
    />
  );
}

export function CollectionGridSkeleton() {
  return (
    <div role="status" aria-label="Loading your collection" className="space-y-6">
      <SkeletonBlock className="h-8 w-56" />
      <SkeletonBlock className="h-4 w-80 max-w-full" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <li
            key={index}
            className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-[#243775] bg-[#0C1638] p-4"
          >
            <SkeletonBlock className="h-20 w-20 rounded-full" />
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-3 w-12" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading collection…</span>
    </div>
  );
}

export function ShopPackGridSkeleton() {
  return (
    <div role="status" aria-label="Loading available shop packs" className="space-y-6">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-72 max-w-full" />
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <article
            key={index}
            className="space-y-5 rounded-2xl border border-[#243775] bg-[#0C1638] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <SkeletonBlock className="h-6 w-40" />
                <SkeletonBlock className="h-4 w-48" />
              </div>
              <SkeletonBlock className="h-10 w-24" />
            </div>
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-20 w-full" />
            <SkeletonBlock className="h-12 w-full" />
          </article>
        ))}
      </div>
      <span className="sr-only">Loading shop packs…</span>
    </div>
  );
}

export function BracketTreeSkeleton() {
  return (
    <section
      role="status"
      aria-label="Loading tournament bracket"
      className="space-y-5 rounded-2xl border border-[#243775] bg-[#0C1638] p-6"
    >
      <div className="space-y-2">
        <SkeletonBlock className="h-6 w-48" />
        <SkeletonBlock className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, round) => (
          <div key={round} className="space-y-3">
            <SkeletonBlock className="h-5 w-28" />
            {Array.from({ length: 2 }, (_, match) => (
              <div
                key={match}
                className="space-y-3 rounded-xl border border-[#243775] bg-[#070D24] p-4"
              >
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-4 w-40 max-w-full" />
                <SkeletonBlock className="h-4 w-36 max-w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading tournament bracket…</span>
    </section>
  );
}

export function MatchRoomSkeleton() {
  return (
    <div role="status" aria-label="Loading match room" className="space-y-6">
      <SkeletonBlock className="h-5 w-48" />
      <section className="space-y-4 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-8 w-64 max-w-full" />
        <SkeletonBlock className="h-4 w-72 max-w-full" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, player) => (
          <section
            key={player}
            className="space-y-4 rounded-2xl border border-[#243775] bg-[#0C1638] p-5"
          >
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-6 w-40" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, pokemon) => (
                <div
                  key={pokemon}
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#243775] bg-[#070D24] p-3"
                >
                  <SkeletonBlock className="h-16 w-16 rounded-full" />
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-3 w-12" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="space-y-4 rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
        <SkeletonBlock className="h-6 w-32" />
        <SkeletonBlock className="h-40 w-full" />
        <SkeletonBlock className="h-20 w-full" />
      </section>
      <span className="sr-only">Loading match room…</span>
    </div>
  );
}
