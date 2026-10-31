import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ImageUpload } from "@/components/ImageUpload";

export default async function AdminGroupsPage() {
  const groups = await prisma.group.findMany({
    orderBy: [{ isCore: "desc" }, { name: "asc" }],
    include: {
      users: {
        orderBy: [{ name: "asc" }, { username: "asc" }],
        select: {
          id: true,
          name: true,
          username: true,
          friendlyMatchParticipationCount: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm text-[#9FB0E6] hover:text-[#EEF2FF]">
          ← All tournaments
        </Link>
        <header className="mb-8 mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
            Admin workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold">Group management</h1>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            Manage the 7DS core group, rival groups, and player assignments.
          </p>
        </header>

        <section className="mb-8 rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
          <h2 className="text-xl font-semibold">Create a rival group</h2>
          <form action="/api/admin/groups" method="POST" className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="action" value="create" />
            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Group name</span>
              <input
                name="name"
                required
                maxLength={80}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>
            <ImageUpload name="logoUrl" label="Group logo (optional)" />
            <button
              type="submit"
              className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] sm:col-span-2 sm:justify-self-start"
            >
              Create group
            </button>
          </form>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((group) => (
            <section
              key={group.id}
              className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5"
            >
              <div className="flex items-center gap-3">
                {group.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={group.logoUrl} alt="" className="size-12 rounded-lg object-cover" />
                )}
                <div>
                  <h2 className="text-xl font-semibold">{group.name}</h2>
                  <p className="text-sm text-[#9FB0E6]">
                    {group.isCore ? "Core group" : "Rival group"} · {group.users.length} members
                  </p>
                </div>
              </div>

              <form action="/api/admin/groups" method="POST" className="mt-5 flex gap-2">
                <input type="hidden" name="action" value="assign" />
                <input type="hidden" name="groupId" value={group.id} />
                <input
                  name="username"
                  required
                  placeholder="Player username"
                  className="min-w-0 flex-1 rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-[#F5C542] px-4 py-2 font-semibold text-[#F5C542]"
                >
                  Assign
                </button>
              </form>

              {group.users.length > 0 ? (
                <ul className="mt-4 divide-y divide-[#243775]">
                  {group.users.map((user) => (
                    <li key={user.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{user.name ?? user.username ?? "Unnamed player"}</p>
                        <p className="text-xs text-[#9FB0E6]">
                          @{user.username ?? "no username"} · {user.friendlyMatchParticipationCount} friendly matches
                        </p>
                      </div>
                      <form action="/api/admin/groups" method="POST" className="flex items-center gap-2">
                        <input type="hidden" name="action" value="adjust-count" />
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          type="number"
                          name="friendlyMatchParticipationCount"
                          min={0}
                          max={2_147_483_647}
                          defaultValue={user.friendlyMatchParticipationCount}
                          aria-label={`Friendly match participation count for ${user.name ?? user.username ?? "player"}`}
                          className="w-24 rounded-lg border border-[#243775] bg-[#070D24] p-2 text-[#EEF2FF]"
                        />
                        <button
                          type="submit"
                          className="text-sm font-semibold text-[#F5C542] hover:text-[#FFE28A]"
                        >
                          Save
                        </button>
                      </form>
                      <form action="/api/admin/groups" method="POST">
                        <input type="hidden" name="action" value="remove" />
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          className="text-sm font-semibold text-red-300 hover:text-red-200"
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[#9FB0E6]">No players assigned yet.</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
