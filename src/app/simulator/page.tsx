import { getPracticePacks } from "@/lib/pack-data";
import PackSimulator from "./pack-simulator";

export default async function SimulatorPage() {
  const packs = await getPracticePacks();
  return <PackSimulator packs={packs} />;
}
