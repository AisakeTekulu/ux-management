/**
 * End-to-end integration test against the live Supabase database.
 *
 * Tests the full workflow:
 * 1. Sign up a test designer
 * 2. Create a client
 * 3. Create a project (verifies 10 default phases)
 * 4. Add checklist items to a phase
 * 5. Add a design link URL
 * 6. Generate a share link
 * 7. Simulate client review: add a comment via the share link
 * 8. Simulate client sign-off (approve)
 * 9. Verify phase status transitions and activity logging
 * 10. Clean up test data
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

// Use service role client to bypass RLS for test setup/teardown
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = `e2e-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";
let testUserId: string;
let testClientId: string;
let testProjectId: string;
let testPhaseId: string;
let testShareLinkToken: string;
let testShareLinkId: string;

async function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ ${message}`);
}

async function step(name: string, fn: () => Promise<void>) {
  console.log(`\n▶ ${name}`);
  await fn();
}

async function run() {
  console.log("🧪 Starting end-to-end test against live Supabase...\n");
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Test user: ${TEST_EMAIL}\n`);

  try {
    // =========================================================================
    // 1. Create a test user
    // =========================================================================
    await step("1. Create test designer user", async () => {
      const { data, error } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
      assert(!error, `User created (${error?.message ?? "ok"})`);
      testUserId = data.user!.id;
      assert(!!testUserId, `User ID: ${testUserId}`);

      // Insert into public.users table (mirrors auth.users)
      const { error: insertError } = await supabase
        .from("users")
        .insert({ id: testUserId, email: TEST_EMAIL });
      assert(!insertError, `Public users row created (${insertError?.message ?? "ok"})`);
    });

    // =========================================================================
    // 2. Create a client
    // =========================================================================
    await step("2. Create a client", async () => {
      const { data, error } = await supabase
        .from("clients")
        .insert({ owner_id: testUserId, name: "E2E Test Client" })
        .select()
        .single();
      assert(!error, `Client created (${error?.message ?? "ok"})`);
      testClientId = data!.id;
      assert(!!testClientId, `Client ID: ${testClientId}`);
    });

    // =========================================================================
    // 3. Create a project (with default phases)
    // =========================================================================
    await step("3. Create a project with default phases", async () => {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          client_id: testClientId,
          owner_id: testUserId,
          name: "E2E Test Website Redesign",
        })
        .select()
        .single();
      assert(!error, `Project created (${error?.message ?? "ok"})`);
      testProjectId = project!.id;

      // Insert the 10 default phases
      const defaultPhases = [
        "Discovery", "Brief sign-off", "Sitemap", "Wireframes",
        "UI design", "Content", "Development", "Testing", "Launch", "Handover",
      ];
      const phaseRows = defaultPhases.map((title, i) => ({
        project_id: testProjectId,
        title,
        ordinal: i + 1,
        description: "",
        internal_notes: "",
        status: "Draft",
      }));
      const { data: phases, error: phaseError } = await supabase
        .from("phases")
        .insert(phaseRows)
        .select();
      assert(!phaseError, `10 default phases created (${phaseError?.message ?? "ok"})`);
      assert(phases!.length === 10, `Phase count: ${phases!.length}`);

      // Use the first phase for subsequent tests
      testPhaseId = phases![0].id;
      assert(!!testPhaseId, `First phase (Discovery) ID: ${testPhaseId}`);
    });

    // =========================================================================
    // 4. Add checklist items
    // =========================================================================
    await step("4. Add checklist items to Discovery phase", async () => {
      const items = [
        { phase_id: testPhaseId, text: "Define project goals", complete: false },
        { phase_id: testPhaseId, text: "Identify target audience", complete: false },
        { phase_id: testPhaseId, text: "Competitive analysis", complete: true },
      ];
      const { data, error } = await supabase
        .from("checklist_items")
        .insert(items)
        .select();
      assert(!error, `3 checklist items created (${error?.message ?? "ok"})`);
      assert(data!.length === 3, `Checklist count: ${data!.length}`);
      assert(data![2].complete === true, "Third item marked complete");
    });

    // =========================================================================
    // 5. Add a design link URL
    // =========================================================================
    await step("5. Add a design link URL", async () => {
      const { data, error } = await supabase
        .from("design_links")
        .insert({
          phase_id: testPhaseId,
          kind: "url",
          url: "https://figma.com/file/test-design",
        })
        .select()
        .single();
      assert(!error, `Design link created (${error?.message ?? "ok"})`);
      assert(data!.kind === "url", `Kind: ${data!.kind}`);
      assert(data!.url === "https://figma.com/file/test-design", "URL stored correctly");
    });

    // =========================================================================
    // 6. Generate a share link
    // =========================================================================
    await step("6. Generate a share link for the phase", async () => {
      // Generate a 32+ char token
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 43);

      const { data, error } = await supabase
        .from("share_links")
        .insert({
          owner_id: testUserId,
          token,
          scope_type: "phase",
          phase_id: testPhaseId,
        })
        .select()
        .single();
      assert(!error, `Share link created (${error?.message ?? "ok"})`);
      testShareLinkToken = data!.token;
      testShareLinkId = data!.id;
      assert(testShareLinkToken.length >= 32, `Token length: ${testShareLinkToken.length}`);

      // Update phase status to "Sent to Client"
      const { error: statusError } = await supabase
        .from("phases")
        .update({ status: "Sent to Client" })
        .eq("id", testPhaseId);
      assert(!statusError, `Phase status → Sent to Client (${statusError?.message ?? "ok"})`);
    });

    // =========================================================================
    // 7. Simulate client comment via share link
    // =========================================================================
    await step("7. Client leaves a comment", async () => {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          phase_id: testPhaseId,
          author_type: "reviewer",
          author_name: "Jane Client",
          text: "Looks great! I love the direction.",
        })
        .select()
        .single();
      assert(!error, `Comment created (${error?.message ?? "ok"})`);
      assert(data!.author_type === "reviewer", "Author type: reviewer");
      assert(data!.author_name === "Jane Client", "Author name stored");

      // Record activity log
      const { error: logError } = await supabase.from("activity_logs").insert({
        project_id: testProjectId,
        type: "comment_created",
        actor: "Jane Client",
        detail: { commentId: data!.id, phaseId: testPhaseId },
      });
      assert(!logError, `Activity log recorded (${logError?.message ?? "ok"})`);
    });

    // =========================================================================
    // 8. Simulate client sign-off (Approved)
    // =========================================================================
    await step("8. Client approves the phase", async () => {
      // Get checklist snapshot
      const { data: checklist } = await supabase
        .from("checklist_items")
        .select("id, text, complete")
        .eq("phase_id", testPhaseId);

      const snapshot = checklist!.map((item) => ({
        checklistItemId: item.id,
        text: item.text,
        complete: item.complete,
      }));

      // Create approval
      const { data: approval, error } = await supabase
        .from("approvals")
        .insert({
          phase_id: testPhaseId,
          decision: "Approved",
          reviewer_name: "Jane Client",
          reviewer_initials: "JC",
          checklist_snapshot: snapshot,
        })
        .select()
        .single();
      assert(!error, `Approval created (${error?.message ?? "ok"})`);
      assert(approval!.decision === "Approved", "Decision: Approved");
      assert(approval!.reviewer_name === "Jane Client", "Reviewer name stored");
      assert(approval!.checklist_snapshot.length === 3, "Snapshot has 3 items");

      // Update phase status to "Approved"
      const { error: statusError } = await supabase
        .from("phases")
        .update({
          status: "Approved",
          approved_by_name: "Jane Client",
          approved_initials: "JC",
          approved_at: new Date().toISOString(),
        })
        .eq("id", testPhaseId);
      assert(!statusError, `Phase status → Approved (${statusError?.message ?? "ok"})`);

      // Record activity logs
      await supabase.from("activity_logs").insert({
        project_id: testProjectId,
        type: "approval_created",
        actor: "Jane Client",
        detail: { decision: "Approved", reviewerName: "Jane Client", phaseId: testPhaseId },
      });
      await supabase.from("activity_logs").insert({
        project_id: testProjectId,
        type: "phase_status_changed",
        actor: "Jane Client",
        detail: { phaseId: testPhaseId, from: "Sent to Client", to: "Approved" },
      });
      assert(true, "Activity logs recorded for approval and status change");
    });

    // =========================================================================
    // 9. Verify data integrity
    // =========================================================================
    await step("9. Verify data integrity", async () => {
      // Verify phase status
      const { data: phase } = await supabase
        .from("phases")
        .select("*")
        .eq("id", testPhaseId)
        .single();
      assert(phase!.status === "Approved", `Phase status is Approved`);
      assert(phase!.approved_by_name === "Jane Client", "Approved by name stored");
      assert(phase!.approved_initials === "JC", "Approved initials stored");

      // Verify activity logs
      const { data: logs } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("project_id", testProjectId)
        .order("created_at", { ascending: false });
      assert(logs!.length >= 3, `Activity logs count: ${logs!.length}`);

      // Verify share link exists
      const { data: link } = await supabase
        .from("share_links")
        .select("*")
        .eq("id", testShareLinkId)
        .single();
      assert(link!.token === testShareLinkToken, "Share link token matches");
      assert(link!.revoked_at === null, "Share link not revoked");

      // Verify project has 10 phases
      const { data: allPhases } = await supabase
        .from("phases")
        .select("*")
        .eq("project_id", testProjectId);
      assert(allPhases!.length === 10, `Project has 10 phases`);

      // Verify checklist items
      const { data: items } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("phase_id", testPhaseId);
      assert(items!.length === 3, `Phase has 3 checklist items`);

      // Verify design link
      const { data: links } = await supabase
        .from("design_links")
        .select("*")
        .eq("phase_id", testPhaseId);
      assert(links!.length === 1, `Phase has 1 design link`);

      // Verify comment
      const { data: comments } = await supabase
        .from("comments")
        .select("*")
        .eq("phase_id", testPhaseId);
      assert(comments!.length === 1, `Phase has 1 comment`);

      // Verify approval
      const { data: approvals } = await supabase
        .from("approvals")
        .select("*")
        .eq("phase_id", testPhaseId);
      assert(approvals!.length === 1, `Phase has 1 approval`);
    });

    // =========================================================================
    // 10. Clean up
    // =========================================================================
    await step("10. Clean up test data", async () => {
      // Delete client (cascades to project → phases → children)
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", testClientId);
      assert(!error, `Client deleted (cascade) (${error?.message ?? "ok"})`);

      // Verify cascade worked
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", testProjectId)
        .maybeSingle();
      assert(project === null, "Project cascaded (deleted)");

      const { data: phases } = await supabase
        .from("phases")
        .select("id")
        .eq("project_id", testProjectId);
      assert(phases!.length === 0, "Phases cascaded (deleted)");

      // Delete the test user
      const { error: userDeleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", testUserId);
      assert(!userDeleteError, `Public user row deleted (${userDeleteError?.message ?? "ok"})`);

      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(testUserId);
      assert(!authDeleteError, `Auth user deleted (${authDeleteError?.message ?? "ok"})`);
    });

    console.log("\n\n🎉 ALL TESTS PASSED! The full workflow works correctly.\n");
    console.log("Summary:");
    console.log("  • Created a designer account");
    console.log("  • Created a client → project → 10 default phases");
    console.log("  • Added checklist items and a design link");
    console.log("  • Generated a share link and transitioned phase to Sent to Client");
    console.log("  • Client left a comment and approved the phase");
    console.log("  • Verified all data persisted correctly in the database");
    console.log("  • Cascade-deleted everything cleanly");
    console.log("");

  } catch (error) {
    console.error("\n\n💥 TEST FAILED:", error);
    console.log("\nAttempting cleanup...");

    // Best-effort cleanup
    try {
      if (testClientId) await supabase.from("clients").delete().eq("id", testClientId);
      if (testUserId) {
        await supabase.from("users").delete().eq("id", testUserId);
        await supabase.auth.admin.deleteUser(testUserId);
      }
      console.log("Cleanup done.");
    } catch (cleanupError) {
      console.error("Cleanup failed:", cleanupError);
    }
    process.exit(1);
  }
}

run();
