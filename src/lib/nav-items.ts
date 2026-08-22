import type { Role } from "@/generated/prisma/enums";

export type NavItem = { href: string; label: string; icon: string };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  COMPLIANCE: [
    { href: "/compliance/floor", label: "Floor Map", icon: "▦" },
    { href: "/compliance/machines", label: "Machine Records", icon: "▤" },
    { href: "/compliance/shipments", label: "Shipments", icon: "▣" },
    { href: "/compliance/exclusions", label: "Self-Exclusion", icon: "⛔" },
    { href: "/compliance/software", label: "Software Status", icon: "⚙" },
    { href: "/metrics", label: "Metrics & Reporting", icon: "▲" },
  ],
  LICENSING: [
    { href: "/licensing/profiles", label: "Person Profiles", icon: "◍" },
    { href: "/metrics", label: "Metrics & Reporting", icon: "▲" },
  ],
  APPLICANT: [{ href: "/applicant", label: "My Application", icon: "◍" }],
};

export const RAIL_NOTE: Record<Role, string> = {
  COMPLIANCE: "Licensing data and the Applicant Portal are not visible from this role — separation of duties per R4.",
  LICENSING: "Compliance floor data is not visible from this role — separation of duties per R4.",
  APPLICANT: "Simplified external front-end (R9). Licensing staff retain control of the underlying profile internally.",
};

export const ROLE_LABEL: Record<Role, string> = {
  COMPLIANCE: "Compliance",
  LICENSING: "Licensing",
  APPLICANT: "Applicant Portal",
};
