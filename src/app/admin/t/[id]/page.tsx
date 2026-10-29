import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImageUpload } from "@/components/ImageUpload";
import { RichTextEditor } from "@/components/rich-text-editor";
import { TournamentFormatFields } from "../../tournament-format-fields";

export default async function AdminTournamentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) notFound();

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-sm text-[#9FB0E6] hover:text-[#EEF2FF]">
          ← All tournaments
        </Link>
        <header className="mb-6 mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
              General settings
            </p>
            <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              tournament.completed
                ? "bg-emerald-950 text-emerald-300"
                : tournament.active
                  ? "bg-[#F5C542] text-[#070D24]"
                  : "bg-[#243775] text-[#9FB0E6]"
            }`}
          >
            {tournament.completed ? "COMPLETED" : tournament.active ? "REGISTRATION" : "DRAFT"}
          </span>
        </header>

        <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Tournament details</h2>
          <form action="/api/admin" method="POST" className="mt-6 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="action" value="updateTournament" />
            <input type="hidden" name="id" value={tournament.id} />

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Name</span>
              <input
                name="name"
                defaultValue={tournament.name}
                required
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <div className="md:col-span-2">
              <RichTextEditor
                name="description"
                label="Tournament description and rules"
                defaultValue={tournament.description}
                placeholder="Share the format, schedule, rules, and anything players should know."
              />
            </div>

            <div className="md:col-span-2">
              <ImageUpload
                name="imageUrl"
                label="Tournament banner / logo"
                initialUrl={tournament.imageUrl}
              />
            </div>
            <div className="md:col-span-2">
              <ImageUpload
                name="cardBackImage"
                label="Card back image"
                initialUrl={tournament.cardBackImage}
              />
            </div>
            <TournamentFormatFields
              initialFormat={tournament.format}
              initialMaxParticipants={tournament.maxParticipants ?? ""}
              initialSwissRounds={tournament.swissRounds}
              initialTopCut={tournament.topCut}
            />

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Starting coins</span>
              <input
                name="startingCoins"
                type="number"
                min={0}
                defaultValue={tournament.startingCoins}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Max copies per player</span>
              <input
                name="maxCopiesPerPlayer"
                type="number"
                min={1}
                defaultValue={tournament.maxCopiesPerPlayer}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Max copies league-wide</span>
              <input
                name="maxCopiesLeague"
                type="number"
                min={0}
                defaultValue={tournament.maxCopiesLeague ?? ""}
                placeholder="Leave blank for no limit"
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="active"
                defaultChecked={tournament.active}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Open registration</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="rostersLocked"
                defaultChecked={tournament.rostersLocked}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Lock roster editing</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="hidden" name="rostersPublic" value="false" />
              <input
                type="checkbox"
                name="rostersPublic"
                value="true"
                defaultChecked={tournament.rostersPublic}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Show rosters to participants</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="hidden" name="checkInOpen" value="false" />
              <input
                type="checkbox"
                name="checkInOpen"
                value="true"
                defaultChecked={tournament.checkInOpen}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Open participant check-in</span>
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B]"
              >
                Save settings
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <h2 className="text-xl font-semibold">Tournament completion</h2>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              {tournament.completed
                ? "Reopening completion does not reopen registration or check-in."
                : "Completing the tournament closes registration and check-in."}
            </p>
          </div>
          <form action="/api/admin" method="POST">
            <input type="hidden" name="action" value="updateTournament" />
            <input type="hidden" name="id" value={tournament.id} />
            <input type="hidden" name="completed" value={tournament.completed ? "false" : "true"} />
            <button
              type="submit"
              className={
                tournament.completed
                  ? "rounded-lg border border-[#243775] px-5 py-3 font-bold text-[#EEF2FF] hover:border-[#F5C542]"
                  : "rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B]"
              }
            >
              {tournament.completed ? "Reopen completion" : "Mark tournament completed"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
