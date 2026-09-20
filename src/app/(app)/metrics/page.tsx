import { getMetrics } from "@/lib/data/metrics";
import { MetricsView } from "@/components/views/metrics-view";
import { auth } from "@/lib/auth";

export default async function MetricsPage() {
  const [metrics, session] = await Promise.all([getMetrics(), auth()]);
  return <MetricsView {...metrics} role={session!.user.role} />;
}
