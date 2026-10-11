import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { put, get, del } from "@vercel/blob";
import { db } from "@/platform/db";
import { mediaUploads, records } from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { ensureTradeFileParent, tradeFileChanged } from "@/modules/theater/files";
import { fileQuota } from "@/platform/quotas";
import { assertRead, assertWrite } from "@/modules/records/service";
import { findRecord, serialize } from "@/modules/records/repository";
import { auditChange } from "@/platform/events";
const partBytes = 2_000_000;
const allowed = [
  "pdf",
  "docx",
  "xlsx",
  "csv",
  "txt",
  "mp4",
  "webm",
  "mp3",
  "wav",
  "dwg",
  "dxf",
  "gdtf",
  "mvr",
];
export async function initMedia(context: Context, input: unknown) {
  const body = z
    .object({
      itemId: z.string(),
      name: z.string().min(1).max(200),
      mime: z.string().max(100),
      size: z.number().int().min(1).max(64_000_000),
    })
    .parse(input);
  const suffix = body.name.split(".").at(-1)?.toLowerCase();
  if (!suffix || !allowed.includes(suffix))
    throw new HttpError(
      400,
      "Erlaubt sind PDF, Office, CSV/Text, MP4/WebM/MP3/WAV, DWG/DXF und MVR/GDTF.",
    );
  const parentId = await ensureTradeFileParent(context, body.itemId),
    parent = await findRecord(context, parentId, "handovers");
  await assertRead(context, parent);
  assertWrite(context, "handovers", parent, true);
  await fileQuota(context, body.size);
  const [entry] = await db
    .insert(mediaUploads)
    .values({
      ...body,
      organizationId: context.organizationId,
      departmentId: parent.departmentId,
      userId: context.user.id,
      expiresAt: new Date(Date.now() + 3600000),
    })
    .returning({ id: mediaUploads.id, size: mediaUploads.size });
  return { ...entry, partBytes, parts: Math.ceil(body.size / partBytes) };
}
async function uploadContext(context: Context, id: string) {
  const [upload] = await db
    .select()
    .from(mediaUploads)
    .where(eq(mediaUploads.id, id))
    .limit(1)
    .for("update");
  if (!upload || upload.userId !== context.user.id || upload.expiresAt <= new Date())
    throw new HttpError(404, "Die Uploadsitzung ist abgelaufen oder nicht zugänglich.");
  const parent = await findRecord(context, "trade-files:" + upload.itemId, "handovers");
  await assertRead(context, parent);
  assertWrite(context, "handovers", parent, true);
  return upload;
}
export async function mediaPart(context: Context, id: string, index: number, bytes: Uint8Array) {
  const upload = await uploadContext(context, id);
  if (upload.completedFileId) throw new HttpError(409, "Dieser Upload ist bereits abgeschlossen.");
  const parts = Math.ceil(upload.size / partBytes),
    expected = index === parts - 1 ? upload.size - index * partBytes : partBytes;
  if (!Number.isInteger(index) || index < 0 || index >= parts || bytes.length !== expected)
    throw new HttpError(400, "Größe oder Position des Uploadblocks ist ungültig.");
  const hash = createHash("sha256").update(bytes).digest("hex"),
    previous = upload.parts.find((p) => p.index === index);
  if (previous) {
    if (previous.sha256 !== hash)
      throw new HttpError(409, "Dieser Block wurde bereits mit anderem Inhalt übertragen.");
    return { index, stored: true };
  }
  const path = `${context.organizationId}/${upload.departmentId}/media-parts/${upload.id}/${index}`;
  await put(path, Buffer.from(bytes), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/octet-stream",
  });
  try {
    await db
      .update(mediaUploads)
      .set({ parts: [...upload.parts, { index, path, size: bytes.length, sha256: hash }] })
      .where(eq(mediaUploads.id, id));
  } catch (error) {
    await del(path).catch(() => {});
    throw error;
  }
  return { index, stored: true };
}
function mediaSignature(bytes: Buffer, suffix: string) {
  if (suffix === "pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (["docx", "xlsx", "gdtf", "mvr"].includes(suffix))
    return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (suffix === "mp4") return bytes.subarray(4, 8).toString() === "ftyp";
  if (suffix === "webm") return bytes.subarray(0, 4).toString("hex") === "1a45dfa3";
  if (suffix === "wav")
    return (
      bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WAVE"
    );
  if (suffix === "mp3")
    return (
      bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  if (suffix === "dwg") return /^AC10\d{2}/.test(bytes.subarray(0, 6).toString());
  return !bytes.subarray(0, 10000).includes(0);
}
export async function finishMedia(context: Context, id: string) {
  const upload = await uploadContext(context, id);
  if (upload.completedFileId)
    return serialize(await findRecord(context, upload.completedFileId, "files"));
  if (upload.parts.length !== Math.ceil(upload.size / partBytes))
    throw new HttpError(409, "Es fehlen Uploadblöcke. Der Upload kann fortgesetzt werden.");
  const buffers = [];
  for (const part of upload.parts.sort((a, b) => a.index - b.index)) {
    const blob = await get(part.path, { access: "private" });
    if (!blob || blob.statusCode !== 200) throw new HttpError(409, "Ein Uploadblock fehlt.");
    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    if (
      bytes.length !== part.size ||
      createHash("sha256").update(bytes).digest("hex") !== part.sha256
    )
      throw new HttpError(409, "Ein Uploadblock ist beschädigt.");
    buffers.push(bytes);
  }
  const bytes = Buffer.concat(buffers),
    suffix = upload.name.split(".").at(-1)!.toLowerCase();
  if (bytes.length !== upload.size || !mediaSignature(bytes, suffix))
    throw new HttpError(400, "Dateityp und Inhalt passen nicht zusammen.");
  await fileQuota(context, bytes.length, upload.id);
  const fileId = crypto.randomUUID(),
    path = `${context.organizationId}/${upload.departmentId}/trade-media/${upload.itemId}/${fileId}.${suffix}`;
  // Binary originals are downloaded, never executed or rendered as HTML.
  const mime =
    suffix === "pdf"
      ? "application/pdf"
      : suffix === "mp4"
        ? "video/mp4"
        : suffix === "webm"
          ? "video/webm"
          : suffix === "wav"
            ? "audio/wav"
            : suffix === "mp3"
              ? "audio/mpeg"
              : "application/octet-stream";
  await put(path, bytes, { access: "private", contentType: mime, addRandomSuffix: false });
  try {
    const parent = await findRecord(context, "trade-files:" + upload.itemId, "handovers");
    const [file] = await db
      .insert(records)
      .values({
        id: fileId,
        kind: "files",
        organizationId: context.organizationId,
        departmentId: upload.departmentId,
        productionId: parent.productionId,
        createdBy: context.user.id,
        data: {
          name: upload.name,
          mime,
          size: bytes.length,
          recordKind: "handovers",
          recordId: parent.id,
          path,
          image: false,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          media: true,
        },
      })
      .returning();
    await db.update(mediaUploads).set({ completedFileId: fileId }).where(eq(mediaUploads.id, id));
    await tradeFileChanged(context, upload.itemId, db as never);
    await auditChange(db as never, context, "file.uploaded", fileId);
    const { after } = await import("@/platform/request");
    after(async () => {
      await del(upload.parts.map((p) => p.path));
    });
    return serialize(file);
  } catch (error) {
    await del(path).catch(() => {});
    throw error;
  }
}
