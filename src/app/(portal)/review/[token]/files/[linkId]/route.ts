import "server-only";

/**
 * Route Handler: GET /review/[token]/files/[linkId]
 *
 * Public file access for the client portal — validates the share link token,
 * verifies the file belongs to an in-scope phase, then returns a signed URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import {
  isShareLinkAccessible,
  isPhaseAccessibleThroughLink,
  INVALID_LINK_MESSAGE,
} from "@/lib/domain/share-link";

const STORAGE_BUCKET = "designs";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; linkId: string }> },
) {
  const { token, linkId } = await params;

  const serviceClient = createServiceRoleClient();
  const repos = createSupabaseRepositories(serviceClient);

  // Validate share link
  const shareLink = await repos.shareLinks.findByToken(token);
  if (!shareLink || !isShareLinkAccessible(shareLink)) {
    return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 403 });
  }

  // Load the design link
  const designLink = await repos.designLinks.findById(linkId);
  if (!designLink || designLink.kind !== "file" || !designLink.storagePath) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  // Verify the file's phase is accessible through this share link
  const phase = await repos.phases.findById(designLink.phaseId);
  if (!phase || !isPhaseAccessibleThroughLink(shareLink, phase)) {
    return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 403 });
  }

  // Generate signed URL with inline content disposition for browser viewing
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
  });
}
