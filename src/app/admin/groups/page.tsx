import Link from "next/link";
import { headers } from "next/headers";
import { ensureCoreGroup } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { ImageUpload } from "@/components/ImageUpload";
import { ActionForm } from "./action-form";
import {
  assignUserToGroup,
  createGroup,
  deleteGroup,
  generateInvitation,
  revokeInvitation,
  updateGroup,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-[#243775] bg-[#070D24] px-3 py-2 text-sm text-[#EEF2FF] outline-none focus:border-[#F5C542]";
const buttonClass =
  "rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold transition hover:border-[#F5C542] disabled:opacity-50";
const cardClass = "rounded-2xl border border-[#243775] bg-[#0B1535] p-5";

const USER_PAGE_SIZE = 50;

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);

  await ensureCoreGroup();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const [groups, users] = await Promise.all([
    prisma.group.findMany({
      orderBy: [{ isCore: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { members: true } },
        invitations: {
          where: { revokedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    prisma.user.findMany({
      where: query
        ? {
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ username: "asc" }, { id: "asc" }],
      take: USER_PAGE_SIZE,
      select: { id: true, username: true, name: true, groupId: true },
    }),
  ]);

  const now = Date.now();

  return (
    <main className="min-h-screen bg-[#070D24] px-5 py-8 text-[#EEF2FF] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F5C542]">
              Admin · Friendly Match
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Group management
            </h1>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-[#243775] px-4 py-2 text-sm font-semibold transition hover:border-[#F5C542]"
          >
            Back to admin
          </Link>
        </div>

        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-bold">Create rival group</h2>
          <ActionForm action={createGroup} resetOnSuccess className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">Group name</span>
              <input name="name" required minLength={2} maxLength={50} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
                Logo link (optional)
              </span>
              <input name="logoUrl" type="url" placeholder="https://" className={inputClass} />
            </label>
            <div className="md:col-span-2">
              <ImageUpload name="logoUpload" label="Or upload a logo" />
            </div>
            <div>
              <button type="submit" className={buttonClass}>Create group</button>
            </div>
          </ActionForm>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">Groups</h2>
          {groups.map((group) => (
            <div key={group.id} className={cardClass}>
              <div className="mb-4 flex items-center gap-3">
                {group.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={group.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-lg border border-[#243775]" />
                )}
                <div>
                  <p className="font-bold">
                    {group.name}
                    {group.isCore && (
                      <span className="ml-2 rounded bg-[#F5C542] px-2 py-0.5 text-xs font-bold text-[#070D24]">
                        CORE
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#9FB0E6]">{group._count.members} members</p>
                </div>
              </div>

              <ActionForm action={updateGroup} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="groupId" value={group.id} />
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">Name</span>
                  <input
                    name="name"
                    defaultValue={group.name}
                    required
                    minLength={2}
                    maxLength={50}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#B9C5E8]">
                    Replace logo with link
                  </span>
                  <input name="logoUrl" type="url" placeholder="https://" className={inputClass} />
                </label>
                <div className="md:col-span-2">
                  <ImageUpload name="logoUpload" label="Or upload a new logo" />
                </div>
                <div>
                  <button type="submit" className={buttonClass}>Save</button>
                </div>
              </ActionForm>

              {!group.isCore && (
                <div className="mt-5 space-y-3 border-t border-[#243775] pt-4">
                  <h3 className="text-sm font-bold text-[#B9C5E8]">Invitation links</h3>
                  <ActionForm
                    action={generateInvitation}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="groupId" value={group.id} />
                    <label className="block">
                      <span className="mb-1 block text-xs text-[#9FB0E6]">Max uses</span>
                      <input name="maxUses" type="number" min={1} max={1000} className={`${inputClass} w-28`} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-[#9FB0E6]">Expires (days)</span>
                      <input name="expiresInDays" type="number" min={1} max={365} className={`${inputClass} w-28`} />
                    </label>
                    <button type="submit" className={buttonClass}>Generate link</button>
                  </ActionForm>
                  <ul className="space-y-2">
                    {group.invitations.map((invitation) => {
                      const expired = invitation.expiresAt !== null && invitation.expiresAt.getTime() < now;
                      const exhausted =
                        invitation.maxUses !== null && invitation.useCount >= invitation.maxUses;
                      return (
                        <li key={invitation.id} className="flex flex-wrap items-center gap-2">
                          <input
                            readOnly
                            aria-label="Invitation link"
                            value={`${origin}/signup?invite=${invitation.token}`}
                            className={`${inputClass} flex-1 text-xs`}
                          />
                          <span className="text-xs text-[#9FB0E6]">
                            {invitation.useCount}
                            {invitation.maxUses !== null ? `/${invitation.maxUses}` : ""} used
                            {expired ? " · expired" : ""}
                            {exhausted ? " · full" : ""}
                          </span>
                          <ActionForm action={revokeInvitation} className="flex items-center gap-2">
                            <input type="hidden" name="invitationId" value={invitation.id} />
                            <button type="submit" className={buttonClass}>Revoke</button>
                          </ActionForm>
                        </li>
                      );
                    })}
                  </ul>
                  <ActionForm
                    action={deleteGroup}
                    confirmMessage={`Delete ${group.name}? Members will be unassigned.`}
                    className="pt-2"
                  >
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" className={`${buttonClass} text-red-300`}>
                      Delete group
                    </button>
                  </ActionForm>
                </div>
              )}
            </div>
          ))}
        </section>

        <section className={cardClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Assign users</h2>
            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search username, name, email"
                className={`${inputClass} w-64`}
              />
              <button type="submit" className={buttonClass}>Search</button>
            </form>
          </div>
          <ul className="divide-y divide-[#243775]">
            {users.map((user) => (
              <li key={user.id} className="py-2">
                <ActionForm action={assignUserToGroup} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <span className="min-w-40 flex-1 text-sm font-semibold">
                    {user.username ?? user.name ?? user.id}
                  </span>
                  <select name="groupId" defaultValue={user.groupId ?? ""} className={`${inputClass} w-48`}>
                    <option value="">No group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                  <button type="submit" className={buttonClass}>Assign</button>
                </ActionForm>
              </li>
            ))}
            {users.length === 0 && <li className="py-2 text-sm text-[#9FB0E6]">No users found.</li>}
          </ul>
          {users.length === USER_PAGE_SIZE && (
            <p className="mt-3 text-xs text-[#9FB0E6]">
              Showing the first {USER_PAGE_SIZE} users. Use search to narrow the list.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
