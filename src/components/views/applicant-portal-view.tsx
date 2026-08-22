const STEPS = ["Submitted", "Background Check", "Reference Checks", "Decision"];

function currentStepIndex(status: string) {
  if (status === "cleared") return 4;
  if (status === "flagged") return 1;
  return 2; // investigation
}

export function ApplicantPortalView({
  firstName,
  personId,
  role,
  documents,
  history,
  status,
}: {
  firstName: string;
  personId: string;
  role: string;
  documents: { id: string; name: string; date: string | null; submitted: boolean }[];
  history: { id: string; date: string; event: string }[];
  status: string;
}) {
  const currentStepIdx = currentStepIndex(status);

  return (
    <div>
      <div className="view-title">Welcome, {firstName}</div>
      <div className="view-sub">Application {personId} · {role}</div>

      <div className="applicant-card">
        <div className="stepper">
          {STEPS.map((s, i) => (
            <div className={`step${i < currentStepIdx ? " done" : i === currentStepIdx ? " current" : ""}`} key={s}>
              <div className="circle">{i < currentStepIdx ? "✓" : i + 1}</div>
              <div className="label">{s}</div>
            </div>
          ))}
        </div>

        <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Document Checklist</div>
        {documents.map((d) => (
          <div className="checklist-item" key={d.id}>
            <div className={`check-icon${d.submitted ? "" : " unsubmitted"}`}>{d.submitted ? "✓" : "—"}</div>
            <span>{d.name}</span>
            <span style={{ marginLeft: "auto", color: "var(--parchment-dim)", fontSize: 11, fontFamily: "var(--font-plex-mono)" }}>
              {d.submitted ? d.date : "Not yet submitted"}
            </span>
          </div>
        ))}

        <div className="section-label">Status History</div>
        <div className="ledger">
          {history.map((h) => (
            <div className="ledger-item" key={h.id}>
              <div className="ledger-date">{h.date}</div>
              <div className="ledger-event">{h.event}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
