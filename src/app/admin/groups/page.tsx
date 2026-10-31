import Link from "next/link";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { ensureCoreGroup } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { ImageUpload } from "@/components/ImageUpload";
import { AdminDialog } from "../admin-dialog";
import { ActionForm } from "./action-form";
import { GroupSelect } from "./group-select";
import {
  addUserToGroupByUsername,
  assignUserToGroup,
  createGroup,
  deleteGroup,
  generateInvitation,
  revokeInvitation,
  updateFriendlyMatchCount,
  updateGroup,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-[#243775] bg-[#070D24] px-3 py-2 text-sm text-[#EEF2FF] outline-none focus:border-[#F5C542]";
const buttonClass =
  "rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold transition hover:border-[#F5C542] disabled:opacity-50";
const labelClass = "mb-2 block text-sm font-semibold text-[#B9C5E8]";

const PAGE_SIZE = 20;
const MEMBER_LIST_LIMIT = 200;

type SearchParams = { q?: string; g?: string; p?: string };

function pageHref(params: { q: string; g: string }, page: number) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.g) search.set("g", params.g);
  if (page > 1) search.set("p", String(page));
  const qs = search.toString();
  return qs ? `/admin/groups?${qs}` : "/admin/groups";
}

function GroupAvatar({ url, name }: { url: string | null; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`${name} logo`} className="h-10 w-10 rounded-lg object-cover" />
  ) : (
    <div
      aria-hidden
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#243775] text-xs font-bold text-[#9FB0E6]"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function GroupEditForm({ group }: { group: { id: string; name: string; logoUrl: string | null } }) {
  return (
    <ActionForm action={updateGroup} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="groupId" value={group.id} />
      <label className="block">
        <span className={labelClass}>Name</span>
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
        <span className={labelClass}>Replace logo with link</span>
        <input name="logoUrl" type="url" placeholder="https://" className={inputClass} />
      </label>
      <div className="md:col-span-2">
        <ImageUpload
          name="logoUpload"
          label="Or upload a new logo"
          initialUrl={group.logoUrl}
        />
      </div>
      <div>
        <button type="submit" className={buttonClass}>Save changes</button>
      </div>
    </ActionForm>
  );
}

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const g = (sp.g ?? "").slice(0, 100);
  const requestedPage = Math.max(1, Math.floor(Number(sp.p)) || 1);

  const core = await ensureCoreGroup();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const userWhere: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(g === "none" ? { groupId: null } : g ? { groupId: g } : {}),
  };

  const [groups, coreMembers, totalUsers] = await Promise.all([
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
      where: { groupId: core.id },
      orderBy: { username: "asc" },
      take: MEMBER_LIST_LIMIT,
      select: { id: true, username: true, name: true },
    }),
    prisma.user.count({ where: userWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const users = await prisma.user.findMany({
    where: userWhere,
    orderBy: [{ username: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      groupId: true,
      friendlyMatchCount: true,
    },
  });

  const coreGroup = groups.find((group) => group.isCore);
  const rivals = groups.filter((group) => !group.isCore);
  const groupOptions = groups.map((group) => ({ id: group.id, name: group.name }));
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
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-[#243775] px-4 py-3 text-sm font-semibold transition hover:border-[#F5C542]"
            >
              Back to admin
            </Link>
            {coreGroup && (
              <AdminDialog buttonLabel="7DS setting" title="7DS setting" variant="secondary">
                <div className="space-y-6">
                  <GroupEditForm group={coreGroup} />
                  <div className="space-y-3 border-t border-[#243775] pt-5">
                    <h3 className="text-sm font-bold text-[#B9C5E8]">
                      Members ({coreGroup._count.members})
                    </h3>
                    <ActionForm
                      action={addUserToGroupByUsername}
                      resetOnSuccess
                      className="flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="groupId" value={coreGroup.id} />
                      <label className="block flex-1">
                        <span className="mb-1 block text-xs text-[#9FB0E6]">Add member by username</span>
                        <input name="username" required className={inputClass} />
                      </label>
                      <button type="submit" className={buttonClass}>Add</button>
                    </ActionForm>
                    <ul className="max-h-72 divide-y divide-[#243775] overflow-y-auto rounded-lg border border-[#243775]">
                      {coreMembers.map((member) => (
                        <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-sm">{member.username ?? member.name ?? member.id}</span>
                          <ActionForm action={assignUserToGroup} className="flex items-center gap-2">
                            <input type="hidden" name="userId" value={member.id} />
                            <input type="hidden" name="groupId" value="" />
                            <button type="submit" className="text-xs font-semibold text-red-300 hover:underline">
                              Remove
                            </button>
                          </ActionForm>
                        </li>
                      ))}
                      {coreMembers.length === 0 && (
                        <li className="px-3 py-3 text-sm text-[#9FB0E6]">No members yet.</li>
                      )}
                    </ul>
                    {coreGroup._count.members > MEMBER_LIST_LIMIT && (
                      <p className="text-xs text-[#9FB0E6]">
                        Showing the first {MEMBER_LIST_LIMIT} members. Use the user table below for the rest.
                      </p>
                    )}
                  </div>
                </div>
              </AdminDialog>
            )}
            <AdminDialog buttonLabel="Create rival group" title="Create rival group">
              <ActionForm
                action={createGroup}
                resetOnSuccess
                closeOnSuccess
                className="grid gap-4 md:grid-cols-2"
              >
                <label className="block">
                  <span className={labelClass}>Group name</span>
                  <input name="name" required minLength={2} maxLength={50} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Logo link (optional)</span>
                  <input name="logoUrl" type="url" placeholder="https://" className={inputClass} />
                </label>
                <div className="md:col-span-2">
                  <ImageUpload name="logoUpload" label="Or upload a logo" />
                </div>
                <div>
                  <button type="submit" className={buttonClass}>Create group</button>
                </div>
              </ActionForm>
            </AdminDialog>
          </div>
        </div>

        <section aria-labelledby="rivals-heading" className="space-y-3">
          <h2 id="rivals-heading" className="text-lg font-bold">Rival groups</h2>
          {rivals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#243775] p-6 text-sm text-[#9FB0E6]">
              No rival groups yet. Use “Create rival group” to add one.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {rivals.map((group) => (
                <li
                  key={group.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#243775] bg-[#0B1535] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GroupAvatar url={group.logoUrl} name={group.name} />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{group.name}</p>
                      <p className="text-xs text-[#9FB0E6]">{group._count.members} members</p>
                    </div>
                  </div>
                  <AdminDialog buttonLabel="Manage" title={`Manage ${group.name}`} variant="secondary">
                    <div className="space-y-6">
                      <GroupEditForm group={group} />
                      <div className="space-y-3 border-t border-[#243775] pt-5">
                        <h3 className="text-sm font-bold text-[#B9C5E8]">Invitation links</h3>
                        <ActionForm action={generateInvitation} className="flex flex-wrap items-end gap-3">
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
                            const expired =
                              invitation.expiresAt !== null && invitation.expiresAt.getTime() < now;
                            const full =
                              invitation.maxUses !== null && invitation.useCount >= invitation.maxUses;
                            return (
                              <li key={invitation.id} className="flex flex-wrap items-center gap-2">
                                <input
                                  readOnly
                                  aria-label="Invitation link"
                                  value={`${origin}/register/rival/${group.id}?invite=${invitation.token}`}
                                  className={`${inputClass} flex-1 text-xs`}
                                />
                                <span className="text-xs text-[#9FB0E6]">
                                  {invitation.useCount}
                                  {invitation.maxUses !== null ? `/${invitation.maxUses}` : ""} used
                                  {expired ? " · expired" : ""}
                                  {full ? " · full" : ""}
                                </span>
                                <ActionForm action={revokeInvitation} className="flex items-center gap-2">
                                  <input type="hidden" name="invitationId" value={invitation.id} />
                                  <button type="submit" className={buttonClass}>Revoke</button>
                                </ActionForm>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="border-t border-[#243775] pt-5">
                        <ActionForm
                          action={deleteGroup}
                          closeOnSuccess
                          confirmMessage={`Delete ${group.name}? Members will be unassigned.`}
                        >
                          <input type="hidden" name="groupId" value={group.id} />
                          <button type="submit" className={`${buttonClass} text-red-300`}>
                            Delete group
                          </button>
                        </ActionForm>
                      </div>
                    </div>
                  </AdminDialog>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="users-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="users-heading" className="text-lg font-bold">
              Users <span className="text-sm font-normal text-[#9FB0E6]">({totalUsers})</span>
            </h2>
            <form className="flex flex-wrap gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search username, name, email"
                aria-label="Search users"
                className={`${inputClass} w-64`}
              />
              <select name="g" defaultValue={g} aria-label="Filter by group" className={`${inputClass} w-44`}>
                <option value="">All groups</option>
                <option value="none">No group</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              <button type="submit" className={buttonClass}>Apply</button>
            </form>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#243775] bg-[#0B1535]">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-[#243775] text-xs uppercase tracking-wider text-[#9FB0E6]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">User</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Group</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Friendly matches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243775]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#101C45]">
                    <td className="px-4 py-2 font-semibold">
                      {user.username ?? user.name ?? user.id}
                    </td>
                    <td className="px-4 py-2 text-[#9FB0E6]">{user.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <GroupSelect userId={user.id} value={user.groupId} groups={groupOptions} />
                    </td>
                    <td className="px-4 py-2">
                      <ActionForm
                        action={updateFriendlyMatchCount}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          aria-label={`Friendly match count for ${user.username ?? user.name ?? user.id}`}
                          className={`${inputClass} w-24`}
                          defaultValue={user.friendlyMatchCount}
                          min={0}
                          max={2147483647}
                          name="friendlyMatchCount"
                          type="number"
                          step={1}
                          required
                        />
                        <button type="submit" className={buttonClass}>Save</button>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[#9FB0E6]">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={pageHref({ q, g }, page - 1)} className={buttonClass}>Previous</Link>
              ) : (
                <span />
              )}
              <span className="text-[#9FB0E6]">Page {page} of {totalPages}</span>
              {page < totalPages ? (
                <Link href={pageHref({ q, g }, page + 1)} className={buttonClass}>Next</Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
