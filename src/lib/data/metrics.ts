import { db } from "@/lib/db";

export async function getMetrics() {
  const [machines, people, exclusions] = await Promise.all([
    db.machine.findMany({ include: { documents: true, history: { orderBy: { date: "asc" } } } }),
    db.person.findMany({ where: { archived: false }, include: { history: { orderBy: { date: "asc" }, take: 1 } } }),
    db.exclusion.findMany({ where: { archived: false } }),
  ]);

  // Compliance Metrics
  // Time-to-verify: days between the "Installed" audit entry and the first
  // "verified" audit entry on the same machine
  const verifyIntervals: number[] = [];
  for (const m of machines) {
    const installed = m.history.find((h) => /install/i.test(h.event));
    const verified = m.history.find((h) => /verif/i.test(h.event));
    if (installed && verified) {
      const days = (verified.date.getTime() - installed.date.getTime()) / 86400000;
      if (days >= 0) verifyIntervals.push(days);
    }
  }
  const avgVerifyDays = verifyIntervals.length === 0 ? 0 : verifyIntervals.reduce((a, b) => a + b, 0) / verifyIntervals.length;
  const openExceptions = machines.filter((m) => m.complianceStatus === "FLAGGED").length;
  const withDocs = machines.filter((m) => m.documents.length > 0).length;
  const auditReadiness = machines.length === 0 ? 0 : Math.round((withDocs / machines.length) * 100);

  // Licensing Metrics
  const investigations = people.filter((p) => p.status === "investigation");
  const now = Date.now();
  const avgBacklogDays =
    investigations.length === 0
      ? 0
      : investigations.reduce((sum, p) => {
          const submitted = p.history[0]?.date?.getTime() ?? now;
          return sum + (now - submitted) / 86400000;
        }, 0) / investigations.length;
  const clearedProfiles = people.filter((p) => p.status === "cleared").length;

  // Self-Exclusion Metrics
  const activeExclusions = exclusions.filter((e) => e.status === "Active").length;

  return {
    // Compliance metrics
    avgVerifyDays: Math.round(avgVerifyDays * 10) / 10,
    openExceptions,
    auditReadiness,
    totalMachines: machines.length,
    // Licensing metrics
    licensingBacklogCount: investigations.length,
    avgBacklogDays: Math.round(avgBacklogDays),
    clearedProfiles,
    totalProfiles: people.length,
    // Self-Exclusion metrics
    activeExclusions,
    totalExclusions: exclusions.length,
  };
}
