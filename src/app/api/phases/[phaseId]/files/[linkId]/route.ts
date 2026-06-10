import "server-only";

/**
 * Route Handler: GET /api/phases/[phaseId]/files/[linkId]
 *
 * Returns a short-lived signed URL for viewing/downloading a file stored in
 * Supabase Storage. Validates ownership (for admin) or returns a signed URL
 * that expires in 1 hour.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";

const STORAGE_BUCKET = "designs";
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ phaseId: string; linkId: string }> },
) {
  const { phaseId, linkId } = await params;

  // Authenticate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Load the design link
  const repos = createSupabaseRepositories(supabase);
  const designLink = await repos.designLinks.findById(linkId);

  if (!designLink || designLink.phaseId !== phaseId || designLink.kind !== "file") {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  if (!designLink.storagePath) {
    return NextResponse.json({ error: "File path missing." }, { status: 404 });
  }

  // Generate signed URL using service role client (inline viewing, not forced download)
  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(designLink.storagePath, SIGNED_URL_EXPIRY_SECONDS, {
      download: false,
    });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not generate file URL." }, { status: 502 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    fileName: designLink.fileName,
    storagePath: designLink.storagePath,
  });
}
