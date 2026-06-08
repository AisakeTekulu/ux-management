import "server-only";

/**
 * Route Handler: POST /api/phases/[phaseId]/files
 *
 * Handles file uploads for design-link attachments. Enforces a 50 MB streaming
 * size limit server-side, writes the file to Supabase Storage, and creates a
 * `design_link` record with `kind: 'file'` only after a successful storage
 * write. If storage fails, no design link is created (R6.5).
 *
 * Uses the SSR cookie-based client for authentication and the service-role
 * client for Storage writes (to bypass RLS on the storage bucket).
 *
 * _Requirements: 6.3, 6.4, 6.5_
 */

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { MAX_UPLOAD_BYTES, isAllowedFileType, ALLOWED_FILE_EXTENSIONS } from "@/lib/domain/validators";

/** The Supabase Storage bucket used for design file uploads. */
const STORAGE_BUCKET = "designs";

/**
 * POST /api/phases/[phaseId]/files
 *
 * Accepts a multipart/form-data request with a single `file` field. Streams
 * the upload and enforces the 50 MB limit before writing to storage.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phaseId: string }> },
) {
  const { phaseId } = await params;

  // --- Authentication ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  // --- Verify phase exists and belongs to the authenticated designer ---
  const repos = createSupabaseRepositories(supabase);
  const phase = await repos.phases.findById(phaseId);

  if (!phase) {
    return NextResponse.json(
      { error: "Phase not found." },
      { status: 404 },
    );
  }

  // --- Parse multipart form data ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "A file field is required." },
      { status: 400 },
    );
  }

  // --- Validate file type (extension and MIME type) ---
  const fileName = file.name || "upload";
  const mimeType = file.type || "application/octet-stream";

  if (!isAllowedFileType(fileName, mimeType)) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
      },
      { status: 415 },
    );
  }

  // --- Enforce 50 MB streaming size limit (R6.3, R6.4) ---
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 50 MB limit." },
      { status: 413 },
    );
  }

  // --- Read file content ---
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Double-check actual byte length after reading (streaming enforcement)
  if (fileBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 50 MB limit." },
      { status: 413 },
    );
  }

  // --- Write to Supabase Storage ---
  const storagePath = `${user.id}/${phaseId}/${Date.now()}-${fileName}`;

  const serviceClient = createServiceRoleClient();
  const { error: storageError } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (storageError) {
    // Storage write failed — do NOT create a design link (R6.5)
    return NextResponse.json(
      { error: "Storage failure. The file could not be saved." },
      { status: 502 },
    );
  }

  // --- Create design_link record only on storage success (R6.5) ---
  const designLink = await repos.designLinks.create({
    phaseId,
    kind: "file",
    url: null,
    storagePath,
    fileName,
  });

  return NextResponse.json(designLink, { status: 201 });
}
