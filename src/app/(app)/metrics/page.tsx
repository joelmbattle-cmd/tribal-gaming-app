import { getMetrics } from "@/lib/data/metrics";
import { MetricsView } from "@/components/views/metrics-view";

export default async function MetricsPage() {
  const metrics = await getMetrics();
  return <MetricsView {...metrics} />;
}
