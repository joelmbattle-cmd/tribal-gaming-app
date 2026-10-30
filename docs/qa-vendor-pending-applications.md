# QA: Vendor pending applications (Invited + Submitted)

No seed needed — existing Licensing UI creates vendor-linked applications.

1. Sign in as a LICENSING user.
2. Licensing → Applications (`/licensing/applications`) → **+ Send Application**.
3. Fill name/email/role, set **Vendor Company** = target company (e.g. "UI Mobile"), **Send Application**. → row is `Invited`.
4. Repeat for a second applicant on the same company. Open it in the drawer → **Mark Submitted** → `Submitted`.
5. Open Licensing → Vendors → the company. "Pending Applications — Need Apps (2)" shows one Invited + one Submitted row.
6. At ≤860px width / coarse pointer, verify `.vendor-pending-row` wraps and the Accept/Reject (`.vendor-pending-actions .btn`) buttons are ≥44px and don't overflow.

Local alternative: `npm run db:seed` (destructive — wipes and reseeds the DB).
