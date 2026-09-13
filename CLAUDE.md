# Standing Rules

**Product:** Tribal gaming compliance demo. Notion is the source of truth for roadmap and requirements.

**Roles:**
- Claude implements code only.
- Chief of Staff owns all Notion updates, driven by Claude's handoffs.
- Claude does NOT edit Notion.

**Workflow:**
- Prefer branch + PR; no direct pushes to `main` unless the brief says otherwise.
- Keep CI green.
- For field specs, use live Notion sources when available.
- Stay within the scope of the brief — no unrelated changes.

**Handoff:** End every task with a short handoff covering:
Status, Shipped, Files, Verify, Risks, Next (include commit/PR URLs).
