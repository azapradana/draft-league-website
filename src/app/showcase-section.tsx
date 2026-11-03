import { prisma } from "@/lib/prisma";
import { ShowcaseSlider } from "./showcase-slider";

const containerClass = "mx-auto max-w-7xl px-5 pt-10 sm:px-8 sm:pt-14";

function Header({ accentColor }: { accentColor: string }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: accentColor }}>
        7DS Section
      </p>
      <h2 className="display-font mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Member showcase
      </h2>
    </div>
  );
}

export function ShowcaseSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <section className={containerClass} aria-busy="true" aria-label="Loading member showcase">
      <Header accentColor={accentColor} />
      <div className="aspect-[6/1] animate-pulse rounded-2xl border border-[#243775] bg-[#0C1638]" />
    </section>
  );
}

export async function ShowcaseSection({ accentColor }: { accentColor: string }) {
  const slides = await prisma.showcaseSlide
    .findMany({
      where: { visible: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, imageUrl: true, linkUrl: true },
    })
    .catch(() => []);

  if (slides.length === 0) return null;

  return (
    <section className={containerClass}>
      <Header accentColor={accentColor} />
      <ShowcaseSlider slides={slides} accentColor={accentColor} />
    </section>
  );
}
