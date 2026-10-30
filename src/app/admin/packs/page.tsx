import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ImageUpload } from "@/components/ImageUpload";
import { RichTextEditor } from "@/components/rich-text-editor";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminDialog } from "../admin-dialog";
import { DeleteGlobalPackButton } from "./delete-pack-button";
import { PackCsvImporter } from "./pack-csv-importer";

export default async function GlobalPacksAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { imported } = await searchParams;
  const packs = await prisma.pack.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          tiers: true,
          entries: true,
          purchases: true,
          tournaments: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {imported === "1" && (
          <div
            role="status"
            className="fixed right-4 top-4 z-50 rounded-xl border border-emerald-400/50 bg-emerald-950 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-xl"
          >
            Pack imported successfully.{" "}
            <a href="/admin/packs" className="ml-2 underline" aria-label="Dismiss import notification">
              Dismiss
            </a>
          </div>
        )}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
              Global catalog
            </p>
            <h1 className="mt-2 text-3xl font-bold">Master packs</h1>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              Create reusable pack definitions. Tournament organizers set event-specific prices and availability when attaching them.
            </p>
          </div>
          <AdminDialog buttonLabel="Create global pack" title="Create global pack">
            <form action="/api/admin" method="POST" className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="action" value="createPack" />
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm text-[#9FB0E6]">Pack name</span>
                <input
                  name="name"
                  required
                  maxLength={80}
                  className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                />
              </label>
              <div className="md:col-span-2">
                <RichTextEditor
                  name="description"
                  label="Pack description"
                  placeholder="Describe this pack's theme and contents."
                />
              </div>
              <div className="md:col-span-2">
                <ImageUpload
                  name="packImage"
                  label="Pack artwork"
                  recommendedDimensions="600 x 900 px (portrait, 2:3)"
                />
              </div>
              <label className="block">
                <span className="mb-2 block text-sm text-[#9FB0E6]">Pokémon per pack</span>
                <input
                  name="pullCount"
                  type="number"
                  min={1}
                  required
                  defaultValue={1}
                  className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                />
              </label>
              <label className="flex items-start gap-3 md:col-span-2">
                <input
                  type="hidden"
                  name="showInPractice"
                  value="false"
                />
                <input
                  type="checkbox"
                  name="showInPractice"
                  value="true"
                  defaultChecked
                  className="mt-1 h-4 w-4 accent-[#F5C542]"
                />
                <span>
                  <span className="block text-sm font-semibold text-[#EEF2FF]">
                    Show in Practice Tear
                  </span>
                  <span className="mt-1 block text-sm text-[#9FB0E6]">
                    List this pack on the practice page when its tournament pack is active.
                  </span>
                </span>
              </label>
              <div className="self-end">
                <button
                  type="submit"
                  className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B]"
                >
                  Create pack
                </button>
              </div>
            </form>
          </AdminDialog>
        </header>

        <PackCsvImporter />

        {packs.length === 0 ? (
          <section className="rounded-2xl border border-[#243775] bg-[#0C1638] px-5 py-12 text-center">
            <h2 className="text-lg font-semibold">No global packs yet</h2>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              Create a master pack, then configure its rarity tiers and Pokémon pool.
            </p>
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => (
              <li
                key={pack.id}
                className="overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638]"
              >
                <div className="flex min-h-40">
                  <div className="w-36 shrink-0 bg-[#070D24] sm:w-44">
                    {pack.packImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pack.packImage}
                        alt={`${pack.name} pack artwork`}
                        className="h-full min-h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-[#9FB0E6]">
                        No pack artwork
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-start justify-between gap-4 p-4 sm:p-5">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{pack.name}</h2>
                      <p className="mt-2 text-sm text-[#9FB0E6]">
                        {pack.pullCount} Pokémon · {pack._count.tiers} tiers · {pack._count.entries} Pokémon in pool
                      </p>
                      <p className="mt-1 text-xs text-[#9FB0E6]">
                        Attached to {pack._count.tournaments} {pack._count.tournaments === 1 ? "tournament" : "tournaments"}
                      </p>
                      <p className="mt-1 text-xs text-[#9FB0E6]">
                        Practice Tear: {pack.showInPractice ? "shown" : "hidden"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/packs/${pack.id}`}
                        className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#EEF2FF] hover:border-[#F5C542]"
                      >
                        Configure drops
                      </Link>
                      <AdminDialog buttonLabel="Edit details" title={`Edit ${pack.name}`}>
                        <form action="/api/admin" method="POST" className="grid gap-4">
                          <input type="hidden" name="action" value="updatePack" />
                          <input type="hidden" name="id" value={pack.id} />
                          <label className="block">
                            <span className="mb-2 block text-sm text-[#9FB0E6]">Pack name</span>
                            <input
                              name="name"
                              required
                              maxLength={80}
                              defaultValue={pack.name}
                              className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                            />
                          </label>
                          <RichTextEditor
                            name="description"
                            label="Pack description"
                            defaultValue={pack.description}
                            placeholder="Describe this pack's theme and contents."
                          />
                          <ImageUpload
                            name="packImage"
                            label="Pack artwork"
                            initialUrl={pack.packImage}
                            recommendedDimensions="600 x 900 px (portrait, 2:3)"
                          />
                          <label className="block">
                            <span className="mb-2 block text-sm text-[#9FB0E6]">Pokémon per pack</span>
                            <input
                              name="pullCount"
                              type="number"
                              min={1}
                              required
                              defaultValue={pack.pullCount}
                              className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                            />
                          </label>
                          <label className="flex items-start gap-3">
                            <input
                              type="hidden"
                              name="showInPractice"
                              value="false"
                            />
                            <input
                              type="checkbox"
                              name="showInPractice"
                              value="true"
                              defaultChecked={pack.showInPractice}
                              className="mt-1 h-4 w-4 accent-[#F5C542]"
                            />
                            <span>
                              <span className="block text-sm font-semibold text-[#EEF2FF]">
                                Show in Practice Tear
                              </span>
                              <span className="mt-1 block text-sm text-[#9FB0E6]">
                                List this pack on the practice page when its tournament pack is active.
                              </span>
                            </span>
                          </label>
                          <button
                            type="submit"
                            className="justify-self-start rounded-lg bg-[#F5C542] px-4 py-2 font-bold text-[#070D24] hover:bg-[#D9A21B]"
                          >
                            Save global pack
                          </button>
                        </form>
                      </AdminDialog>
                    </div>
                    {pack._count.purchases === 0 ? (
                      <DeleteGlobalPackButton packId={pack.id} packName={pack.name} />
                    ) : (
                      <p className="text-xs text-[#9FB0E6]">
                        Packs with purchase history cannot be deleted.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
