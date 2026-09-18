import bcrypt from "bcryptjs";
import { ActivityType, Currency, Prisma, PrismaClient, Role, Stage } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";
const H = 60;
const D = 24 * H;

const ALLOWED_TRANSITIONS: Record<Stage, readonly Stage[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

// ---------------------------------------------------------------------------
// Declarative seed definition. Times are minutes; each event's `after` is the
// delay since the previous event (or since creation for the first event).
// ---------------------------------------------------------------------------

type UserKey = "admin" | "r1" | "r2" | "viewer";
type ReviewerKey = "r1" | "r2";

const USERS: ReadonlyArray<{ key: UserKey; email: string; name: string; role: Role }> = [
  { key: "admin", email: "admin@tracker.local", name: "Alice Morgan", role: "ADMIN" },
  { key: "r1", email: "reviewer1@tracker.local", name: "Daniel Okafor", role: "REVIEWER" },
  { key: "r2", email: "reviewer2@tracker.local", name: "Priya Raman", role: "REVIEWER" },
  { key: "viewer", email: "viewer@tracker.local", name: "Sam Whitfield", role: "VIEWER" },
];

type SeedEvent =
  | { kind: "assign"; to: ReviewerKey; after: number }
  | { kind: "stage"; by: UserKey; to: Stage; after: number }
  | { kind: "comment"; by: UserKey; text: string; after: number }
  | { kind: "archive"; after: number }
  | { kind: "restore"; after: number };

interface SeedOpportunity {
  companyName: string;
  amount: string;
  currency: Currency;
  description: string;
  createdAgo: number;
  events: SeedEvent[];
  final: { stage: Stage; reviewer: ReviewerKey | null; archived: boolean };
}

const assign = (to: ReviewerKey, after: number): SeedEvent => ({ kind: "assign", to, after });
const stage = (by: UserKey, to: Stage, after: number): SeedEvent => ({ kind: "stage", by, to, after });
const comment = (by: UserKey, text: string, after: number): SeedEvent => ({ kind: "comment", by, text, after });
const archive = (after: number): SeedEvent => ({ kind: "archive", after });
const restore = (after: number): SeedEvent => ({ kind: "restore", after });

const OPPORTUNITIES: readonly SeedOpportunity[] = [
  {
    companyName: "Northwind Renewable Energy",
    amount: "4500000.00",
    currency: "USD",
    description:
      "Construction financing for a 60 MW onshore wind farm in west Texas, including grid interconnection and a 15-year power purchase agreement with a regional utility.",
    createdAgo: 2 * D + 3 * H,
    events: [
      comment("admin", "Term sheet received. Waiting on the final PPA draft before this goes to review.", H),
      comment("viewer", "Is the interconnection study already complete?", 5 * H),
      comment("r1", "Interconnection study is scheduled for next month; flagging as a dependency.", 3 * H),
    ],
    final: { stage: "DRAFT", reviewer: null, archived: false },
  },
  {
    companyName: "Helios Solar Partners",
    amount: "12000000.00",
    currency: "EUR",
    description:
      "Portfolio acquisition of eight operating solar parks across Spain and Portugal, with a refinancing of existing senior debt and a small capex reserve.",
    createdAgo: 3 * D,
    events: [
      assign("r1", H),
      stage("admin", "UNDER_REVIEW", H),
      comment("r1", "Reviewing the offtake contracts; two parks have merchant exposure above 30%.", 6 * H),
      comment("admin", "Sponsor has agreed to provide updated P50/P90 yield reports by Friday.", 4 * H),
      comment("viewer", "Noting for the committee pack: currency hedging is in scope.", 8 * H),
    ],
    final: { stage: "UNDER_REVIEW", reviewer: "r1", archived: false },
  },
  {
    companyName: "Atlas Logistics Group",
    amount: "750000.00",
    currency: "GBP",
    description:
      "Working capital facility to fund a fleet of 25 electric delivery vans for last-mile contracts with two national retailers.",
    createdAgo: 5 * D,
    events: [
      stage("admin", "UNDER_REVIEW", 2 * H),
      comment("admin", "Submitted for review; still need to nominate a reviewer.", 3 * H),
      comment("r2", "I can take this one if capacity is needed. Let me know.", 10 * H),
      comment("viewer", "Retailer contracts look short-dated compared to the van lease term.", 20 * H),
    ],
    final: { stage: "UNDER_REVIEW", reviewer: null, archived: false },
  },
  {
    companyName: "BlueHarbor Fisheries",
    amount: "2300000.00",
    currency: "USD",
    description:
      "Expansion of a sustainable aquaculture site in Norway: new pens, feed automation and MSC certification costs over two years.",
    createdAgo: 20 * D,
    events: [
      assign("r2", 2 * H),
      stage("admin", "UNDER_REVIEW", 3 * H),
      comment("r2", "Site licence and environmental permits verified.", D),
      comment("viewer", "Any concentration risk with the single feed supplier?", 5 * H),
      comment("admin", "Supplier has a secondary agreement, confirmed in the data room.", 4 * H),
      stage("r2", "APPROVED", 3 * D),
      comment("admin", "Approved. Legal to prepare documentation.", 2 * H),
    ],
    final: { stage: "APPROVED", reviewer: "r2", archived: false },
  },
  {
    companyName: "Quantum Ledger Systems",
    amount: "18500000.00",
    currency: "USD",
    description:
      "Series C growth capital for a distributed ledger settlement platform targeting mid-sized banks; proceeds fund engineering headcount and regulatory licences.",
    createdAgo: 34 * D,
    events: [
      stage("admin", "UNDER_REVIEW", H),
      assign("r1", H),
      comment("r1", "Customer references are thin: only one live bank deployment.", 2 * D),
      comment("admin", "Sponsor confirmed two more pilots, none contracted yet.", 6 * H),
      comment("viewer", "Valuation looks aggressive against comparable fintech rounds.", 8 * H),
      stage("r1", "REJECTED", 4 * D),
      comment("admin", "Rejected on traction and valuation. Feedback sent to the sponsor.", 2 * H),
    ],
    final: { stage: "REJECTED", reviewer: "r1", archived: false },
  },
  {
    companyName: "Verdant Agritech",
    amount: "950000.00",
    currency: "EUR",
    description:
      "Equipment financing for precision irrigation sensors deployed across 40 cooperative farms in the Netherlands.",
    createdAgo: 45 * D,
    events: [
      assign("r1", H),
      stage("admin", "UNDER_REVIEW", 2 * H),
      comment("r1", "Unit economics validated against three pilot farms.", D),
      comment("viewer", "Great fit with the sustainability mandate.", 4 * H),
      stage("admin", "APPROVED", 2 * D),
      comment("r1", "Conditions precedent: insurance certificates and cooperative guarantees.", 3 * H),
    ],
    final: { stage: "APPROVED", reviewer: "r1", archived: false },
  },
  {
    companyName: "Ironbridge Manufacturing",
    amount: "6800000.00",
    currency: "GBP",
    description:
      "Modernisation loan for a Sheffield precision-steel plant: two CNC lines, a heat-treatment furnace and energy efficiency upgrades.",
    createdAgo: D + 2 * H,
    events: [
      assign("r2", 20),
      stage("admin", "UNDER_REVIEW", 30),
      comment("r2", "Starting with the plant's audited accounts for the last three years.", 90),
      comment("viewer", "Does the furnace upgrade qualify for the green capex allowance?", 45),
      comment("admin", "Yes, sponsor has supplied the eligibility letter.", 40),
    ],
    final: { stage: "UNDER_REVIEW", reviewer: "r2", archived: false },
  },
  {
    companyName: "Sable Health Diagnostics",
    amount: "320000.00",
    currency: "USD",
    description:
      "Seed-stage bridge funding for a point-of-care blood test device ahead of a CE mark submission.",
    createdAgo: 6 * D,
    events: [
      assign("r2", H),
      comment("admin", "Pre-assigned to Priya. Awaiting the regulatory roadmap before submitting for review.", 2 * H),
      comment("r2", "Please also request the clinical validation summary.", 5 * H),
      comment("viewer", "Nice product demo last week.", D),
    ],
    final: { stage: "DRAFT", reviewer: "r2", archived: false },
  },
  {
    companyName: "Crescent Telecom Infrastructure",
    amount: "42000000.00",
    currency: "EUR",
    description:
      "Senior secured financing for a fibre-to-the-home rollout covering 300,000 households across southern Italy under a public-private concession.",
    createdAgo: 90 * D,
    events: [
      assign("r2", H),
      stage("admin", "UNDER_REVIEW", 2 * H),
      comment("r2", "Concession terms are favourable, with availability-based payments.", 2 * D),
      comment("viewer", "Construction timeline seems ambitious.", 6 * H),
      comment("admin", "Sponsor has a strong delivery track record. Contractor is fixed-price.", 5 * H),
      stage("r2", "APPROVED", 5 * D),
      comment("admin", "Financial close achieved; archiving the deal file.", 10 * D),
      archive(H),
    ],
    final: { stage: "APPROVED", reviewer: "r2", archived: true },
  },
  {
    companyName: "Meridian Retail Holdings",
    amount: "1450000.00",
    currency: "GBP",
    description:
      "Refinancing of a portfolio of twelve high-street retail units with declining footfall and short remaining lease terms.",
    createdAgo: 75 * D,
    events: [
      stage("admin", "UNDER_REVIEW", 2 * H),
      assign("r1", H),
      comment("r1", "Occupancy trend is negative and covenant headroom is minimal.", D),
      comment("viewer", "Comparable centres have been trading at steep discounts.", 6 * H),
      comment("admin", "Agree. Recommending rejection.", 3 * H),
      stage("r1", "REJECTED", 2 * D),
      archive(D),
    ],
    final: { stage: "REJECTED", reviewer: "r1", archived: true },
  },
  {
    companyName: "Polar Freight Lines",
    amount: "5200000.00",
    currency: "USD",
    description:
      "Acquisition finance for two ice-class bulk carriers to serve Arctic mining routes.",
    createdAgo: 60 * D,
    events: [
      comment("admin", "Sponsor withdrew before submission. Archiving.", 2 * H),
      comment("viewer", "Shame, this one had potential.", H),
      comment("r1", "Happy to revisit if they come back with a revised structure.", H),
      archive(H),
    ],
    final: { stage: "DRAFT", reviewer: null, archived: true },
  },
  {
    companyName: "Lumen Education Trust",
    amount: "275000.00",
    currency: "GBP",
    description:
      "Grant-backed loan to build a STEM learning centre for a network of eight secondary schools in the West Midlands.",
    createdAgo: 50 * D,
    events: [
      assign("r1", H),
      stage("admin", "UNDER_REVIEW", 2 * H),
      comment("r1", "Grant agreements are in place and repayments are ring-fenced.", D),
      comment("viewer", "Low risk, strong social impact.", 3 * H),
      stage("r1", "APPROVED", D),
      archive(2 * D),
      restore(30 * D),
      comment("admin", "Restored: trust requested a top-up facility, tracking under the same file.", 2 * H),
    ],
    final: { stage: "APPROVED", reviewer: "r1", archived: false },
  },
  {
    companyName: "Oakhaven Biotech",
    amount: "27500000.00",
    currency: "USD",
    description:
      "Phase II clinical trial financing for an oncology drug candidate, structured as milestone-based tranches with royalty participation.",
    createdAgo: 4 * D,
    events: [
      assign("r2", H),
      stage("admin", "UNDER_REVIEW", H),
      comment("r2", "Trial design is sound, but I lack the domain expertise to assess the biology.", 6 * H),
      assign("r1", H),
      comment("r1", "Taking over. Requesting an independent scientific opinion.", 4 * H),
      comment("admin", "Sponsor agreed to commission the external scientific review.", 8 * H),
      comment("viewer", "Should we cap the exposure per tranche?", 10 * H),
    ],
    final: { stage: "UNDER_REVIEW", reviewer: "r1", archived: false },
  },
  {
    companyName: "Tidewater Port Authority",
    amount: "9900000.00",
    currency: "EUR",
    description:
      "Infrastructure bond to deepen the main shipping channel and add two container berths at a mid-sized Baltic port.",
    createdAgo: 3 * H,
    events: [
      comment("admin", "Draft created from the intake call this morning.", 30),
      comment("viewer", "Sharing the port's traffic forecast with the team.", 40),
      comment("r2", "Will pick this up once it is submitted.", 20),
    ],
    final: { stage: "DRAFT", reviewer: null, archived: false },
  },
  {
    companyName: "Kestrel Aerospace Components",
    amount: "3100000.00",
    currency: "EUR",
    description:
      "Growth loan for a Toulouse supplier of composite wing components, backed by a multi-year framework agreement with a tier-one manufacturer.",
    createdAgo: 12 * D,
    events: [
      assign("r2", 3 * H),
      stage("admin", "UNDER_REVIEW", 2 * H),
      comment("r2", "Framework agreement has no minimum volume commitments.", D),
      comment("viewer", "Supplier concentration looks high.", 5 * H),
      comment("admin", "Sponsor could not offer additional security.", 4 * H),
      stage("r2", "REJECTED", 2 * D),
    ],
    final: { stage: "REJECTED", reviewer: "r2", archived: false },
  },
];

// ---------------------------------------------------------------------------
// Build rows
// ---------------------------------------------------------------------------

interface ActivityRow {
  opportunityId: string;
  actorId: string;
  type: ActivityType;
  metadata: Record<string, string | null>;
  createdAt: Date;
}

interface Built {
  users: Prisma.UserCreateManyInput[];
  opportunities: Prisma.OpportunityCreateManyInput[];
  comments: Prisma.CommentCreateManyInput[];
  activities: ActivityRow[];
}

const userId = (key: UserKey): string => `seed_user_${key}`;
const pad = (n: number): string => String(n).padStart(2, "0");

function build(now: Date, passwordHash: string): Built {
  const built: Built = { users: [], opportunities: [], comments: [], activities: [] };

  for (const u of USERS) {
    built.users.push({ id: userId(u.key), email: u.email, name: u.name, role: u.role, passwordHash });
  }

  OPPORTUNITIES.forEach((seed, index) => {
    const opportunityId = `seed_opp_${pad(index + 1)}`;
    const createdAt = new Date(now.getTime() - seed.createdAgo * 60_000);
    let cursor = createdAt;
    const tick = (after: number): Date => {
      cursor = new Date(cursor.getTime() + after * 60_000);
      return cursor;
    };
    const log = (actor: UserKey, type: ActivityType, metadata: ActivityRow["metadata"], at: Date): void => {
      built.activities.push({ opportunityId, actorId: userId(actor), type, metadata, createdAt: at });
    };

    log("admin", "CREATION", { stage: "DRAFT" }, createdAt);

    let reviewer: ReviewerKey | null = null;
    let current: Stage = "DRAFT";
    let commentCount = 0;

    for (const event of seed.events) {
      const at = tick(event.after);
      switch (event.kind) {
        case "assign":
          log(
            "admin",
            "REVIEWER_ASSIGNMENT",
            { previousReviewer: reviewer ? userId(reviewer) : null, newReviewer: userId(event.to) },
            at,
          );
          reviewer = event.to;
          break;
        case "stage":
          log(event.by, "STAGE_CHANGE", { previousStage: current, newStage: event.to }, at);
          current = event.to;
          break;
        case "comment": {
          commentCount += 1;
          const commentId = `seed_cmt_${pad(index + 1)}_${pad(commentCount)}`;
          built.comments.push({
            id: commentId,
            opportunityId,
            authorId: userId(event.by),
            content: event.text,
            createdAt: at,
          });
          log(event.by, "COMMENT_ADDED", { commentId }, at);
          break;
        }
        case "archive":
          log("admin", "ARCHIVED", {}, at);
          break;
        case "restore":
          log("admin", "RESTORED", {}, at);
          break;
      }
    }

    built.opportunities.push({
      id: opportunityId,
      companyName: seed.companyName,
      requestedAmount: seed.amount,
      currency: seed.currency,
      stage: seed.final.stage,
      submissionDate: createdAt,
      description: seed.description,
      isArchived: seed.final.archived,
      createdById: userId("admin"),
      assignedReviewerId: seed.final.reviewer ? userId(seed.final.reviewer) : null,
      createdAt,
      updatedAt: cursor,
    });
  });

  return built;
}

// ---------------------------------------------------------------------------
// In-memory consistency checks: replay each opportunity's log and compare it
// with the opportunity row that will be written.
// ---------------------------------------------------------------------------

function verify(built: Built, now: Date): void {
  const roleById = new Map(built.users.map((u) => [u.id as string, u.role]));
  const commentById = new Map(built.comments.map((c) => [c.id as string, c]));
  const referencedComments = new Set<string>();
  const fail = (opportunityId: string, message: string): never => {
    throw new Error(`Seed inconsistency in ${opportunityId}: ${message}`);
  };

  for (const opp of built.opportunities) {
    const id = opp.id as string;
    const description = opp.description;
    if (description.length > 500) fail(id, `description is ${description.length} chars (max 500)`);
    if (Number(opp.requestedAmount) <= 0) fail(id, "requestedAmount must be positive");

    const events = built.activities.filter((a) => a.opportunityId === id);
    const first = events[0];
    if (!first || first.type !== "CREATION") fail(id, "first activity must be CREATION");
    if (events.filter((e) => e.type === "CREATION").length !== 1) fail(id, "exactly one CREATION expected");

    let stageNow: Stage = "DRAFT";
    let reviewer: string | null = null;
    let archived = false;
    let previousAt = 0;

    for (const e of events) {
      const at = e.createdAt.getTime();
      if (at <= previousAt) fail(id, `timestamps must be strictly increasing (${e.type} at ${e.createdAt.toISOString()})`);
      if (at > now.getTime()) fail(id, `${e.type} is in the future`);
      previousAt = at;
      const actorRole = roleById.get(e.actorId);

      switch (e.type) {
        case "STAGE_CHANGE": {
          const { previousStage, newStage } = e.metadata;
          if (archived) fail(id, "stage change while archived");
          if (actorRole !== "ADMIN" && actorRole !== "REVIEWER") fail(id, "stage change by non admin/reviewer");
          if (previousStage !== stageNow) fail(id, `previousStage ${previousStage} does not match replayed ${stageNow}`);
          if (!newStage || !ALLOWED_TRANSITIONS[stageNow].includes(newStage as Stage)) {
            fail(id, `invalid transition ${stageNow} -> ${newStage}`);
          }
          stageNow = newStage as Stage;
          break;
        }
        case "REVIEWER_ASSIGNMENT": {
          const { previousReviewer, newReviewer } = e.metadata;
          if (archived) fail(id, "reviewer assignment while archived");
          if (actorRole !== "ADMIN") fail(id, "reviewer assignment by non admin");
          if (previousReviewer !== reviewer) fail(id, "previousReviewer does not match replayed reviewer");
          if (!newReviewer || roleById.get(newReviewer) !== "REVIEWER") fail(id, "assigned user is not a REVIEWER");
          if (newReviewer === reviewer) fail(id, "reviewer assigned to themselves again");
          reviewer = newReviewer ?? null;
          break;
        }
        case "COMMENT_ADDED": {
          const commentId = e.metadata.commentId;
          const c = commentId ? commentById.get(commentId) : undefined;
          if (!commentId || !c) fail(id, "COMMENT_ADDED references an unknown comment");
          else {
            if (c.opportunityId !== id || c.authorId !== e.actorId) fail(id, `comment ${commentId} does not match its log entry`);
            if (c.createdAt instanceof Date && c.createdAt.getTime() !== at) fail(id, `comment ${commentId} timestamp differs from its log entry`);
            if (c.content.length < 1 || c.content.length > 1000) fail(id, `comment ${commentId} length out of range`);
            if (referencedComments.has(commentId)) fail(id, `comment ${commentId} logged twice`);
            referencedComments.add(commentId);
          }
          break;
        }
        case "ARCHIVED":
          if (archived) fail(id, "archived twice");
          if (actorRole !== "ADMIN") fail(id, "archive by non admin");
          archived = true;
          break;
        case "RESTORED":
          if (!archived) fail(id, "restored while not archived");
          if (actorRole !== "ADMIN") fail(id, "restore by non admin");
          archived = false;
          break;
        case "CREATION":
          break;
      }
    }

    if (stageNow !== opp.stage) fail(id, `replayed stage ${stageNow} != stored ${opp.stage}`);
    if (archived !== opp.isArchived) fail(id, `replayed archived=${archived} != stored ${opp.isArchived}`);
    if (reviewer !== (opp.assignedReviewerId ?? null)) fail(id, `replayed reviewer ${reviewer} != stored ${opp.assignedReviewerId}`);
  }

  for (const c of built.comments) {
    if (!referencedComments.has(c.id as string)) {
      throw new Error(`Seed inconsistency: comment ${c.id} has no COMMENT_ADDED log entry`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Refusing to seed with NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=true to override.");
  }

  const now = new Date();
  const built = build(now, await bcrypt.hash(PASSWORD, 10));
  verify(built, now);

  await prisma.$transaction(
    async (tx) => {
      // ActivityLog is append-only via a trigger; the seed is the only place that
      // bypasses it, and only for the duration of this transaction.
      await tx.$executeRawUnsafe('ALTER TABLE "ActivityLog" DISABLE TRIGGER USER');
      await tx.activityLog.deleteMany();
      await tx.$executeRawUnsafe('ALTER TABLE "ActivityLog" ENABLE TRIGGER USER');
      await tx.comment.deleteMany();
      await tx.opportunity.deleteMany();
      await tx.user.deleteMany();

      await tx.user.createMany({ data: built.users });
      await tx.opportunity.createMany({ data: built.opportunities });
      await tx.comment.createMany({ data: built.comments });
      await tx.activityLog.createMany({ data: built.activities });
    },
    { timeout: 30_000 },
  );

  const archived = built.opportunities.filter((o) => o.isArchived).length;
  console.log(
    `Seeded ${built.users.length} users, ${built.opportunities.length} opportunities (${archived} archived), ` +
      `${built.comments.length} comments, ${built.activities.length} activity log entries.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
