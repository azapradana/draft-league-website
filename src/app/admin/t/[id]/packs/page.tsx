import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImageUpload } from "@/components/ImageUpload";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AdminDialog } from "@/app/admin/admin-dialog";
import { DeletePackButton } from "./delete-pack-button";

export default async function AdminTournamentPacksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      packs: {
        orderBy: { name: "asc" },
        include: { _count: { select: { purchases: true, tiers: true, entries: true } } },
      },
    },
  });
  if (!tournament) notFound();

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
              Packs / Gacha
            </p>
            <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              Configure pack pricing, artwork, tiers, and contents.
            </p>
          </div>
          <AdminDialog buttonLabel="Create new" title="Create pack">
            <form action="/api/admin" method="POST" className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="action" value="createPack" />
              <input type="hidden" name="tournamentId" value={tournament.id} />
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
                  placeholder="Describe the pack contents, theme, or what makes it special."
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
                <span className="mb-2 block text-sm text-[#9FB0E6]">Price (coins)</span>
                <input name="price" type="number" min={0} required defaultValue={0} className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-[#9FB0E6]">Pokémon per pack</span>
                <input name="pullCount" type="number" min={1} required defaultValue={1} className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-[#9FB0E6]">Per-player purchase limit</span>
                <input name="purchaseLimit" type="number" min={1} placeholder="Unlimited" className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]" />
              </label>
              <label className="flex items-center gap-3">
                <input type="hidden" name="active" value="false" />
                <input type="checkbox" name="active" value="true" defaultChecked className="h-4 w-4 accent-[#F5C542]" />
                <span className="text-sm text-[#9FB0E6]">Put on sale</span>
              </label>
              <div className="md:col-span-2">
                <button type="submit" className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B]">
                  Create pack
                </button>
              </div>
            </form>
          </AdminDialog>
        </header>

        {tournament.packs.length === 0 ? (
          <section className="rounded-2xl border border-[#243775] bg-[#0C1638] px-5 py-12 text-center">
            <h2 className="text-lg font-semibold">No packs created</h2>
            <p className="mt-2 text-sm text-[#9FB0E6]">Create a pack to configure its artwork and drop tiers.</p>
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tournament.packs.map((pack) => (
              <li key={pack.id} className="overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638]">
                <div className="flex min-h-40">
                  <div className="w-36 shrink-0 bg-[#070D24] sm:w-44">
                    {pack.packImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pack.packImage} alt={`${pack.name} pack artwork`} className="h-full min-h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-[#9FB0E6]">
                        No pack artwork
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-start justify-between gap-4 p-4 sm:p-5">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{pack.name}</h2>
                      <p className="mt-2 text-sm text-[#9FB0E6]">{pack.price} coins</p>
                      <p className="mt-1 text-sm text-[#9FB0E6]">
                        {pack.pullCount} Pokémon per pack
                      </p>
                    </div>
                    <AdminDialog buttonLabel="Manage" title={`Manage ${pack.name}`}>
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-[#9FB0E6]">
                          {pack._count.purchases} purchases · {pack._count.tiers} tiers · {pack._count.entries} Pokémon
                        </p>
                        <Link href={`/admin/t/${tournament.id}/packs/${pack.id}`} className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#EEF2FF] hover:border-[#F5C542]">
                          Configure tiers and drops
                        </Link>
                      </div>
                      <form action="/api/admin" method="POST" className="grid gap-4 md:grid-cols-2">
                        <input type="hidden" name="action" value="updatePack" />
                        <input type="hidden" name="id" value={pack.id} />
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm text-[#9FB0E6]">Pack name</span>
                          <input name="name" required maxLength={80} defaultValue={pack.name} className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]" />
                        </label>
                        <div className="md:col-span-2">
                          <RichTextEditor name="description" label="Pack description" defaultValue={pack.description} placeholder="Describe the pack contents, theme, or what makes it special." />
                        </div>
                        <div className="md:col-span-2">
                          <ImageUpload
                            name="packImage"
                            label="Pack artwork"
                            initialUrl={pack.packImage}
                            recommendedDimensions="600 x 900 px (portrait, 2:3)"
                          />
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-sm text-[#9FB0E6]">Price (coins)</span>
                          <input name="price" type="number" min={0} required defaultValue={pack.price} className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]" />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-[#9FB0E6]">Pokémon per pack</span>
                          <input name="pullCount" type="number" min={1} required defaultValue={pack.pullCount} className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]" />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-[#9FB0E6]">Per-player purchase limit</span>
                          <input name="purchaseLimit" type="number" min={1} defaultValue={pack.purchaseLimit ?? ""} placeholder="Unlimited" className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]" />
                        </label>
                        <label className="flex items-center gap-3">
                          <input type="hidden" name="active" value="false" />
                          <input type="checkbox" name="active" value="true" defaultChecked={pack.active} className="h-4 w-4 accent-[#F5C542]" />
                          <span className="text-sm text-[#9FB0E6]">On sale</span>
                        </label>
                        <div className="md:col-span-2">
                          <button type="submit" className="rounded-lg bg-[#F5C542] px-4 py-2 font-bold text-[#070D24] hover:bg-[#D9A21B]">Save pack</button>
                        </div>
                      </form>
                      {pack._count.purchases === 0 ? (
                        <DeletePackButton
                          packId={pack.id}
                          tournamentId={tournament.id}
                          packName={pack.name}
                        />
                      ) : (
                        <p className="mt-3 text-sm text-[#9FB0E6]">Packs with purchases cannot be deleted.</p>
                      )}
                    </AdminDialog>
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
