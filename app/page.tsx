import { getDb } from "../db";
import { planChanges } from "../db/schema";
import Dashboard from "../features/dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const changes = await getDb().select().from(planChanges);
  return <Dashboard initialChanges={changes} />;
}
