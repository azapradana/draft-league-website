import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { guardGuestPage } from "@/lib/guest-access";
import { getPracticePacks } from "@/lib/pack-data";
import PackSimulator from "./pack-simulator";

export default async function SimulatorPage() {
  const session = await getServerSession(authOptions);
  if (session) guardGuestPage(session);
  const packs = await getPracticePacks();
  return <PackSimulator packs={packs} />;
}
