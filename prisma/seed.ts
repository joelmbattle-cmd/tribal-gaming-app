import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing existing data...");
  await db.mapSettings.deleteMany();
  await db.machineHistory.deleteMany();
  await db.machineDocument.deleteMany();
  await db.mapChangeLog.deleteMany();
  await db.machine.deleteMany();
  await db.bank.deleteMany();
  await db.area.deleteMany();
  await db.shipmentRecipient.deleteMany();
  await db.shipmentField.deleteMany();
  await db.shipmentDocument.deleteMany();
  await db.shipment.deleteMany();
  await db.exclusionNote.deleteMany();
  await db.exclusion.deleteMany();
  await db.personHistory.deleteMany();
  await db.personDocument.deleteMany();
  await db.user.deleteMany();
  await db.person.deleteMany();

  await db.mapSettings.create({ data: { id: 1, mapWidth: 1560 } });

  // -------------------------------------------------------------------
  // Areas
  // -------------------------------------------------------------------
  console.log("Seeding areas...");
  const areaMain = await db.area.create({
    data: { key: "main", label: "Main Floor", y: 0, h: 440, order: 0 },
  });
  const areaHighLimit = await db.area.create({
    data: { key: "highlimit", label: "High Limit", y: 460, h: 300, order: 1 },
  });
  await db.area.create({
    data: { key: "other", label: "Other", y: 780, h: 190, order: 2 },
  });

  // -------------------------------------------------------------------
  // Banks + Machines (ported 1:1 from the HTML/JS prototypes)
  // -------------------------------------------------------------------
  console.log("Seeding banks and machines...");

  const bank104 = await db.bank.create({
    data: {
      id: "B-104",
      name: "Bank 104 — Main Floor North",
      areaId: areaMain.id,
      x: 40,
      y: 36,
      capacity: 6,
    },
  });
  const bank118 = await db.bank.create({
    data: {
      id: "B-118",
      name: "Bank 118 — Main Floor South",
      areaId: areaMain.id,
      x: 40,
      y: 250,
      capacity: 4,
    },
  });
  const bank210 = await db.bank.create({
    data: {
      id: "B-210",
      name: "Bank 210 — High Limit Room",
      areaId: areaHighLimit.id,
      x: 40,
      y: 496,
      capacity: 3,
    },
  });

  type SeedMachine = {
    id: string;
    assetNumber: string;
    manufacturer: string;
    model: string;
    theme: string;
    parSheet: string;
    sealNumber: string;
    complianceStatus: "VERIFIED" | "FLAGGED" | "PENDING";
    lifecycleStatus: "ACTIVE" | "IN_TRANSIT" | "OUT_OF_SERVICE" | "CONVERTED" | "RETIRED";
    highlightFlag: "NONE" | "CONVERSION_PROJECT" | "REVOCATION";
    softwareStatus: string;
    statusSince: string;
    bankId: string;
    seatIndex: number;
    docs: { name: string; date: string }[];
    history: { date: string; event: string }[];
  };

  const machines: SeedMachine[] = [
    {
      id: "EGD-10412", assetNumber: "A-2291", manufacturer: "IGT", model: "Peak S30", theme: "Wolf Run Gold",
      parSheet: "PAR-8842-B", sealNumber: "SL-77291", complianceStatus: "VERIFIED", lifecycleStatus: "ACTIVE",
      highlightFlag: "NONE", softwareStatus: "Compliant", statusSince: "2026-07-02", bankId: bank104.id, seatIndex: 0,
      docs: [
        { name: "Install Certification.pdf", date: "2026-02-11" },
        { name: "PAR Sheet — Wolf Run Gold.pdf", date: "2026-02-09" },
        { name: "Seal Log.pdf", date: "2026-07-02" },
      ],
      history: [
        { date: "2026-02-11", event: "Installed at Bank 104, Seat 1" },
        { date: "2026-05-03", event: "Software conversion — theme update applied" },
        { date: "2026-07-02", event: "Compliance seal verified — quarterly audit" },
      ],
    },
    {
      id: "EGD-10413", assetNumber: "A-2292", manufacturer: "IGT", model: "Peak S30", theme: "Golden Goddess",
      parSheet: "PAR-8842-B", sealNumber: "SL-77292", complianceStatus: "VERIFIED", lifecycleStatus: "ACTIVE",
      highlightFlag: "NONE", softwareStatus: "Compliant", statusSince: "2026-06-18", bankId: bank104.id, seatIndex: 1,
      docs: [
        { name: "Install Certification.pdf", date: "2026-02-11" },
        { name: "PAR Sheet — Golden Goddess.pdf", date: "2026-02-09" },
      ],
      history: [
        { date: "2026-02-11", event: "Installed at Bank 104, Seat 2" },
        { date: "2026-06-18", event: "Compliance seal verified — quarterly audit" },
      ],
    },
    {
      id: "EGD-10414", assetNumber: "A-2293", manufacturer: "Aristocrat", model: "MarsX", theme: "Buffalo Ascension",
      parSheet: "PAR-9910-A", sealNumber: "SL-77293", complianceStatus: "FLAGGED", lifecycleStatus: "ACTIVE",
      highlightFlag: "REVOCATION", softwareStatus: "Conditionally Revoked", statusSince: "2026-08-14", bankId: bank104.id, seatIndex: 2,
      docs: [
        { name: "Install Certification.pdf", date: "2026-01-28" },
        { name: "Exception Report.pdf", date: "2026-08-14" },
      ],
      history: [
        { date: "2026-01-28", event: "Installed at Bank 104, Seat 3" },
        { date: "2026-08-14", event: "Seal discrepancy flagged during spot check" },
      ],
    },
    {
      id: "EGD-10415", assetNumber: "A-2294", manufacturer: "Aristocrat", model: "MarsX", theme: "Dragon Link",
      parSheet: "PAR-9910-A", sealNumber: "SL-77294", complianceStatus: "VERIFIED", lifecycleStatus: "ACTIVE",
      highlightFlag: "NONE", softwareStatus: "Compliant", statusSince: "2026-06-30", bankId: bank104.id, seatIndex: 3,
      docs: [{ name: "Install Certification.pdf", date: "2026-01-28" }],
      history: [
        { date: "2026-01-28", event: "Installed at Bank 104, Seat 4" },
        { date: "2026-06-30", event: "Compliance seal verified — quarterly audit" },
      ],
    },
    {
      id: "EGD-11801", assetNumber: "A-3110", manufacturer: "Everi", model: "Empire EXL", theme: "Cash Machine",
      parSheet: "PAR-7701-C", sealNumber: "", complianceStatus: "PENDING", lifecycleStatus: "IN_TRANSIT",
      highlightFlag: "NONE", softwareStatus: "Needs Update", statusSince: "2026-08-09", bankId: bank118.id, seatIndex: 0,
      docs: [{ name: "Shipment Manifest.pdf", date: "2026-08-09" }],
      history: [{ date: "2026-08-09", event: "Received from shipment SH-2298 — pending install verification" }],
    },
    {
      id: "EGD-11802", assetNumber: "A-3111", manufacturer: "Everi", model: "Empire EXL", theme: "Lucky Ducky",
      parSheet: "PAR-7701-C", sealNumber: "SL-81147", complianceStatus: "VERIFIED", lifecycleStatus: "ACTIVE",
      highlightFlag: "NONE", softwareStatus: "Compliant", statusSince: "2026-07-22", bankId: bank118.id, seatIndex: 1,
      docs: [
        { name: "Install Certification.pdf", date: "2026-03-04" },
        { name: "PAR Sheet — Lucky Ducky.pdf", date: "2026-03-02" },
      ],
      history: [
        { date: "2026-03-04", event: "Installed at Bank 118, Seat 2" },
        { date: "2026-07-22", event: "Compliance seal verified — quarterly audit" },
      ],
    },
    {
      id: "EGD-21001", assetNumber: "A-5010", manufacturer: "IGT", model: "Peak S30", theme: "Cleopatra",
      parSheet: "PAR-8842-B", sealNumber: "SL-90512", complianceStatus: "VERIFIED", lifecycleStatus: "ACTIVE",
      highlightFlag: "NONE", softwareStatus: "Compliant", statusSince: "2026-07-10", bankId: bank210.id, seatIndex: 0,
      docs: [{ name: "Install Certification.pdf", date: "2026-04-01" }],
      history: [
        { date: "2026-04-01", event: "Installed at Bank 210, Seat 1" },
        { date: "2026-07-10", event: "Compliance seal verified — quarterly audit" },
      ],
    },
  ];

  for (const m of machines) {
    await db.machine.create({
      data: {
        id: m.id,
        serial: m.id,
        assetNumber: m.assetNumber,
        manufacturer: m.manufacturer,
        model: m.model,
        theme: m.theme,
        parSheet: m.parSheet,
        sealNumber: m.sealNumber,
        complianceStatus: m.complianceStatus,
        lifecycleStatus: m.lifecycleStatus,
        highlightFlag: m.highlightFlag,
        softwareStatus: m.softwareStatus,
        statusSince: new Date(m.statusSince),
        bankId: m.bankId,
        seatIndex: m.seatIndex,
        documents: { create: m.docs.map((d) => ({ name: d.name, date: new Date(d.date) })) },
        history: { create: m.history.map((h) => ({ date: new Date(h.date), event: h.event })) },
      },
    });
  }

  await db.mapChangeLog.create({
    data: {
      changeType: "Move Bank",
      bankName: "Bank 210 — High Limit Room",
      areaLabel: "High Limit",
      notes: "Relocated from Main Floor per capacity request",
      ts: new Date("2026-08-15"),
    },
  });

  // -------------------------------------------------------------------
  // Licensing profiles (R6)
  // -------------------------------------------------------------------
  console.log("Seeding person profiles...");

  await db.person.create({
    data: {
      id: "LIC-00231",
      name: "Marcus Whitfield",
      role: "Applicant — Key Employee",
      status: "investigation",
      dateOfBirth: new Date("1985-02-19"),
      contactInfo: "(602) 555-0142 · m.whitfield@example.com",
      licenseType: "Key",
      applicationDate: new Date("2026-07-01"),
      applicationStatus: "Under Review",
      backgroundStatus: "In Review",
      suitabilityDetermination: "Pending",
      assignedInvestigator: "R. Delgado",
      investigationStartDate: new Date("2026-07-08"),
      keyFindings: "Reference checks in progress; no adverse findings to date.",
      createdBy: "Licensing Director (Demo)",
      lastModifiedBy: "Licensing Director (Demo)",
      documents: {
        create: [
          { name: "Application Form.pdf", date: new Date("2026-07-01"), submitted: true },
          { name: "Background Consent.pdf", date: new Date("2026-07-01"), submitted: true },
          { name: "Employment History.pdf", date: new Date("2026-07-05"), submitted: true },
          { name: "Fingerprint Card", date: null, submitted: false },
        ],
      },
      history: {
        create: [
          { date: new Date("2026-07-01"), event: "Application submitted" },
          { date: new Date("2026-07-08"), event: "Background investigation opened" },
          { date: new Date("2026-08-12"), event: "Reference checks in progress" },
        ],
      },
    },
  });
  await db.person.create({
    data: {
      id: "LIC-00198",
      name: "Dana Ochoa",
      role: "Applicant — Gaming Employee",
      status: "cleared",
      dateOfBirth: new Date("1992-11-30"),
      contactInfo: "(602) 555-0187 · dana.ochoa@example.com",
      licenseType: "Employee",
      licenseNumber: "GE-2026-3341",
      licenseIssueDate: new Date("2026-06-30"),
      licenseExpirationDate: new Date("2028-06-30"),
      applicationDate: new Date("2026-05-14"),
      applicationStatus: "Accepted",
      backgroundStatus: "Approved",
      suitabilityDetermination: "Suitable",
      assignedInvestigator: "R. Delgado",
      investigationStartDate: new Date("2026-05-20"),
      investigationCompletionDate: new Date("2026-06-30"),
      keyFindings: "No disqualifying history found. Cleared for licensure.",
      createdBy: "Licensing Director (Demo)",
      lastModifiedBy: "Licensing Director (Demo)",
      documents: {
        create: [
          { name: "Application Form.pdf", date: new Date("2026-05-14"), submitted: true },
          { name: "Background Consent.pdf", date: new Date("2026-05-14"), submitted: true },
          { name: "Investigation Summary.pdf", date: new Date("2026-06-30"), submitted: true },
        ],
      },
      history: {
        create: [
          { date: new Date("2026-05-14"), event: "Application submitted" },
          { date: new Date("2026-05-20"), event: "Background investigation opened" },
          { date: new Date("2026-06-30"), event: "Investigation completed — license issued" },
        ],
      },
    },
  });
  await db.person.create({
    data: {
      id: "LIC-00247",
      name: "Priya Ramanathan",
      role: "Vendor — Gaming Equipment",
      status: "flagged",
      dateOfBirth: new Date("1980-06-05"),
      contactInfo: "(480) 555-0119 · p.ramanathan@vendorco.example",
      licenseType: "Vendor",
      applicationDate: new Date("2026-08-02"),
      applicationStatus: "Additional Info Needed",
      backgroundStatus: "Needs Info",
      suitabilityDetermination: "Pending",
      assignedInvestigator: "T. Whitcombe",
      investigationStartDate: new Date("2026-08-15"),
      keyFindings: "Discrepancy flagged — prior license action in another jurisdiction. Awaiting explanation from applicant.",
      createdBy: "Licensing Director (Demo)",
      lastModifiedBy: "Licensing Director (Demo)",
      documents: {
        create: [
          { name: "Application Form.pdf", date: new Date("2026-08-02"), submitted: true },
          { name: "Vendor Disclosure.pdf", date: new Date("2026-08-02"), submitted: true },
        ],
      },
      history: {
        create: [
          { date: new Date("2026-08-02"), event: "Application submitted" },
          { date: new Date("2026-08-15"), event: "Discrepancy flagged — prior license action in another jurisdiction" },
        ],
      },
    },
  });
  await db.person.create({
    data: {
      id: "LIC-00252",
      name: "Tomás Herrera",
      role: "Applicant — Key Employee",
      status: "investigation",
      dateOfBirth: new Date("1988-03-27"),
      contactInfo: "(602) 555-0163 · t.herrera@example.com",
      licenseType: "Key",
      applicationDate: new Date("2026-08-10"),
      applicationStatus: "Received",
      backgroundStatus: "Not Started",
      suitabilityDetermination: "Pending",
      createdBy: "Licensing Director (Demo)",
      lastModifiedBy: "Licensing Director (Demo)",
      documents: {
        create: [
          { name: "Application Form.pdf", date: new Date("2026-08-10"), submitted: true },
          { name: "Background Consent.pdf", date: new Date("2026-08-10"), submitted: true },
        ],
      },
      history: {
        create: [
          { date: new Date("2026-08-10"), event: "Application submitted" },
          { date: new Date("2026-08-11"), event: "Background investigation opened" },
        ],
      },
    },
  });

  // -------------------------------------------------------------------
  // Shipments (R3)
  // -------------------------------------------------------------------
  console.log("Seeding shipments...");

  await db.shipment.create({
    data: {
      id: "SH-2298",
      carrier: "XPO Logistics",
      received: new Date("2026-08-09"),
      status: "Processing",
      documents: {
        create: [
          { name: "Bill of Lading.pdf", date: new Date("2026-08-09") },
          { name: "Packing List.pdf", date: new Date("2026-08-09") },
        ],
      },
      extracted: {
        create: [
          { key: "PO Number", value: "PO-55201" },
          { key: "Machine Count", value: "2" },
          { key: "Manufacturer", value: "Everi" },
          { key: "Expected Bank", value: "Bank 118" },
        ],
      },
      notify: {
        create: [
          { email: "compliance-lead@agency.gov", sent: true },
          { email: "floor-ops@agency.gov", sent: true },
          { email: "warehouse@agency.gov", sent: false },
        ],
      },
    },
  });
  await db.shipment.create({
    data: {
      id: "SH-2301",
      carrier: "Old Dominion Freight",
      received: new Date("2026-08-16"),
      status: "Open",
      documents: { create: [{ name: "Bill of Lading.pdf", date: new Date("2026-08-16") }] },
      extracted: {
        create: [
          { key: "PO Number", value: "PO-55214" },
          { key: "Machine Count", value: "4" },
          { key: "Manufacturer", value: "IGT" },
          { key: "Expected Bank", value: "Bank 104" },
        ],
      },
      notify: {
        create: [
          { email: "compliance-lead@agency.gov", sent: false },
          { email: "floor-ops@agency.gov", sent: false },
        ],
      },
    },
  });
  await db.shipment.create({
    data: {
      id: "SH-2276",
      carrier: "XPO Logistics",
      received: new Date("2026-07-02"),
      status: "Closed",
      documents: {
        create: [
          { name: "Bill of Lading.pdf", date: new Date("2026-07-02") },
          { name: "Packing List.pdf", date: new Date("2026-07-02") },
          { name: "Receiving Confirmation.pdf", date: new Date("2026-07-04") },
        ],
      },
      extracted: {
        create: [
          { key: "PO Number", value: "PO-55033" },
          { key: "Machine Count", value: "6" },
          { key: "Manufacturer", value: "Mixed" },
          { key: "Expected Bank", value: "Bank 104 / 118" },
        ],
      },
      notify: { create: [{ email: "compliance-lead@agency.gov", sent: true }] },
    },
  });

  // -------------------------------------------------------------------
  // Self-Exclusion cases (R5) — fabricated demo data only
  // -------------------------------------------------------------------
  console.log("Seeding self-exclusion cases...");

  await db.exclusion.create({
    data: {
      id: "SE-0041",
      status: "Active",
      enrolled: new Date("2025-11-02"),
      term: "5-year term",
      personName: "Harold J. Whitmore",
      dateOfBirth: new Date("1978-04-12"),
      governmentId: "Tribal ID# TGA-004471",
      exclusionType: "Self-Exclusion",
      expirationDate: new Date("2030-11-02"),
      restrictions: "Barred from gaming floor and cage services; automatic denial of comp/loyalty enrollment",
      sourceInitiated: "In-person request at Compliance office",
      createdBy: "Compliance Officer (Demo)",
      lastModifiedBy: "Compliance Officer (Demo)",
      notes: {
        create: [
          { date: new Date("2025-11-02"), event: "Self-exclusion request processed and enrolled" },
          { date: new Date("2026-03-14"), event: "Attempted floor access denied at Bank 104 — security notified" },
        ],
      },
    },
  });
  await db.exclusion.create({
    data: {
      id: "SE-0037",
      status: "Active",
      enrolled: new Date("2025-06-20"),
      term: "Lifetime term",
      personName: "Linda R. Castillo",
      aliases: "Linda Reyes",
      dateOfBirth: new Date("1965-09-03"),
      governmentId: "Driver's License# CA-88213590",
      exclusionType: "Self-Exclusion",
      restrictions: "Lifetime ban from all gaming floor areas; security to escort off premises if identified",
      sourceInitiated: "Self-exclusion hotline request",
      createdBy: "Compliance Officer (Demo)",
      lastModifiedBy: "Compliance Officer (Demo)",
      notes: { create: [{ date: new Date("2025-06-20"), event: "Self-exclusion request processed and enrolled" }] },
    },
  });
  await db.exclusion.create({
    data: {
      id: "SE-0029",
      status: "Expired",
      enrolled: new Date("2023-01-15"),
      term: "2-year term",
      personName: "Devon T. Baptiste",
      dateOfBirth: new Date("1990-01-22"),
      governmentId: "State ID# WA-5527741",
      exclusionType: "Self-Exclusion",
      expirationDate: new Date("2025-01-15"),
      restrictions: "No gaming floor access through term; eligible for reinstatement review after expiration",
      sourceInitiated: "Self-exclusion request form (mail-in)",
      createdBy: "Compliance Officer (Demo)",
      lastModifiedBy: "Compliance Officer (Demo)",
      notes: {
        create: [
          { date: new Date("2023-01-15"), event: "Self-exclusion request processed and enrolled" },
          { date: new Date("2025-01-15"), event: "Term expired — case closed" },
        ],
      },
    },
  });

  // -------------------------------------------------------------------
  // Demo login accounts (R4 / R9)
  // -------------------------------------------------------------------
  console.log("Seeding demo user accounts...");

  const passwordHash = await bcrypt.hash("demo-pass-2026", 10);
  await db.user.create({
    data: { email: "compliance@demo.gov", passwordHash, name: "Compliance Officer (Demo)", role: "COMPLIANCE" },
  });
  await db.user.create({
    data: { email: "licensing@demo.gov", passwordHash, name: "Licensing Director (Demo)", role: "LICENSING" },
  });
  await db.user.create({
    data: {
      email: "applicant@demo.gov",
      passwordHash,
      name: "Marcus Whitfield",
      role: "APPLICANT",
      personId: "LIC-00231",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
