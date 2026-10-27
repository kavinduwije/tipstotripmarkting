import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { config, higgsfield, APIError, AuthenticationError, NotEnoughCreditsError, TimeoutError } from "@higgsfield/client/v2";

const spanish = process.argv.includes("--spanish");
const wan = spanish && process.argv.includes("--wan");
const spanishConfig = spanish ? JSON.parse(readFileSync(new URL("ugc-spanish.json", import.meta.url), "utf8")) as { appearance: string; dialogues: string[] } : undefined;
const dir = fileURLToPath(new URL(spanish ? "../artifacts/ugc-es/" : "../artifacts/ugc/", import.meta.url));
const appearance = "An adult woman aged 27, shoulder-length wavy dark brown hair, warm brown eyes, a natural friendly face, a plain cream linen shirt, small gold hoop earrings. She is seated near a bright window in a cozy travel apartment with a blurred plant and warm neutral background. Authentic casual UGC smartphone video, chest-up medium closeup, natural daylight, realistic skin, direct eye contact, subtle hand gestures, camera locked off. Keep her face centered and visible in the upper-middle of the frame throughout. No cuts, no other people, no B-roll, no phone screens, no text, no subtitles, no logos. Clear natural conversational English voice, warm and confident, neutral international English accent. Dry clean voice recording without music, sound effects, or background conversation. Natural lip synchronization.";

const segments = [
  {
    id: "presenter-01",
    model: "bytedance/seedance-2.5/text-to-video",
    dialogue: "Traveling solo? Here's how to meet people and find what's happening nearby with Tips to Trip. Tap Meet Buddy, turn on Go Live, and browse the map or list to see who's around. Open a profile to check their introduction, distance, and match score. Add a quick note and send a meet request. You can check your sent requests while you wait for a response.",
  },
  {
    id: "presenter-02",
    model: "bytedance/seedance-2.5/reference-to-video",
    dialogue: "The requests screen keeps your received, accepted, sent, and blocked requests in one place. Then tap Near You to discover local posts, events, and offers. Use the search bar, or filter by the types of posts you want to see. Scroll through the cards to explore what's nearby. That's the journey: find a buddy, send a request, and discover your next local plan with Tips to Trip.",
  },
];

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

class UploadError extends Error {
  constructor(readonly stage: "create upload URL" | "upload media", readonly httpStatus: number) { super("Upload failed"); }
}

async function uploadReference(credentials: string, inputPath = `${dir}/presenter-reference.mp4`, contentType = "video/mp4"): Promise<string> {
  // Follow the official file-upload API, including all presigned upload headers.
  const link = await fetch("https://api.higgsfield.ai/files/generate-upload-url", {
    method: "POST",
    headers: { Authorization: `Key ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType }),
    signal: AbortSignal.timeout(120000),
  });
  if (!link.ok) throw new UploadError("create upload URL", link.status);
  const data = await link.json() as { upload_url: string; public_url: string; upload_headers: Record<string, string> };
  if (new URL(data.upload_url).protocol !== "https:" || new URL(data.public_url).protocol !== "https:") throw new Error("Invalid upload URL");
  const uploaded = await fetch(data.upload_url, {
    method: "PUT",
    // Only storage headers from the presigned response. No API credentials.
    headers: data.upload_headers,
    body: new Uint8Array(await readFile(inputPath)),
    signal: AbortSignal.timeout(120000),
  });
  if (!uploaded.ok) throw new UploadError("upload media", uploaded.status);
  return data.public_url;
}

async function main() {
  loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials) || credentials.includes("your-key") || credentials === "key-id:key-secret") {
    console.error("Configure HF_CREDENTIALS locally before generating.");
    process.exitCode = 1;
    return;
  }
  config({ credentials, maxRetries: 0, pollInterval: 5000, maxPollTime: 30 * 60 * 1000 });
  await mkdir(dir, { recursive: true });
  const initialImagePath = `${dir}/presenter-reference.png`;
  const usePortrait = spanish && await exists(initialImagePath);
  const selectedSegments = segments.map((segment, i) => ({ ...segment, model: wan ? "alibaba/wan-3.0/image-to-video" : usePortrait && i === 0 ? "bytedance/seedance-2.5/image-to-video" : segment.model, dialogue: spanishConfig?.dialogues[i] ?? segment.dialogue }));
  await writeFile(`${dir}/narration.json`, JSON.stringify(selectedSegments, null, 2));
  let referenceUrl: string | undefined;
  for (const segment of selectedSegments) {
    const metadataPath = `${dir}/${segment.id}.json`;
    let videoUrl: string;
    if (await exists(metadataPath)) {
      const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
      videoUrl = metadata.videoUrl;
      console.log(`Reusing completed ${segment.id}.`);
    } else {
      if (await exists(`${dir}/${segment.id}.pending.json`)) {
        console.error(`${segment.id} has an existing pending request. Check or recover that request before submitting another billable generation.`);
        process.exitCode = 1;
        return;
      }
      let imageUrl: string | undefined;
      if (segment.model.endsWith("/image-to-video")) {
        const imageMetadataPath = `${dir}/presenter-portrait-upload.json`;
        if (await exists(imageMetadataPath)) imageUrl = JSON.parse(await readFile(imageMetadataPath, "utf8")).url;
        else {
          console.log("Uploading the adult travel presenter portrait.");
          imageUrl = await uploadReference(credentials, initialImagePath, "image/png");
          await writeFile(imageMetadataPath, JSON.stringify({ url: imageUrl }, null, 2));
        }
      }
      if (referenceUrl && !wan) {
        const referenceMetadataPath = `${dir}/presenter-reference.json`;
        if (await exists(referenceMetadataPath)) {
          referenceUrl = JSON.parse(await readFile(referenceMetadataPath, "utf8")).url;
        } else {
          const referencePath = `${dir}/presenter-reference.mp4`;
          if (!(await exists(referencePath))) {
            const prepared = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", "3", "-i", `${dir}/presenter-01.mp4`, "-t", "6", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", referencePath], { stdio: "inherit" });
            if (prepared.status !== 0) throw new Error("Reference preparation failed");
          }
          console.log("Uploading a six-second presenter reference for continuity.");
          referenceUrl = await uploadReference(credentials);
          await writeFile(referenceMetadataPath, JSON.stringify({ url: referenceUrl }, null, 2));
        }
      }
      console.log(`Submitting ${segment.id}: 30-second billable generation. Waiting for completion.`);
      const visualPrompt = imageUrl ? "Animate the adult travel presenter in the supplied portrait, preserving her face, hairstyle, clothing, framing, and sunny hostel setting. She is friendly, curious, outgoing and energetic, and enjoys meeting fellow travelers. Steady camera, direct eye contact, small natural hand gestures, natural synchronized lip movement. No cutaways, other people, text, or overlays. Warm clear female voice, native Spanish from Spain, clean dry dialogue, no music or background conversation." : spanishConfig?.appearance ?? appearance;
      const prompt = `${visualPrompt} ${referenceUrl && !wan ? "Use the reference video ONLY to preserve exactly the same adult woman, voice, outfit, framing and background. This is a new continuous take with entirely NEW dialogue; do not repeat dialogue from the reference. " : ""}She explains a mobile app in a single uninterrupted 30-second take. Begin speaking immediately, speak the complete script clearly at about 145 words per minute, and finish the entire script before the end. ${spanish ? "Speak native Spanish from Spain with a lively travel creator personality. Pronounce Tips to Trip and the feature names Meet Buddy, Near You, and Go Live clearly. " : ""}Do not add or omit words. Her EXACT spoken dialogue is: "${segment.dialogue}"`;
      const result = await higgsfield.subscribe(segment.model, {
        input: {
          prompt,
          duration: 30,
          resolution: "720p",
          ...(!imageUrl ? { aspect_ratio: "9:16" } : { image_url: imageUrl }),
          ...(wan ? { aspect_ratio: "9:16", enable_thinking: false } : { output_format: "mp4" }),
          generate_audio: true,
          ...(referenceUrl && !wan ? { video_urls: [referenceUrl] } : {}),
        },
        withPolling: true,
      });
      if (result.status !== "completed" || !result.video?.url) {
        const safeStatus = ["completed", "failed", "nsfw", "canceled", "cancelled", "queued", "in_progress"].includes(result.status) ? result.status : "unknown";
        await writeFile(`${dir}/${segment.id}.unsuccessful.json`, JSON.stringify({ status: safeStatus, requestId: result.request_id }, null, 2));
        console.error(`Generation returned ${safeStatus} without a usable video. No successful output claimed.`);
        process.exitCode = 1;
        return;
      }
      videoUrl = result.video.url;
      if (new URL(videoUrl).protocol !== "https:") throw new Error("Invalid output URL");
      await writeFile(metadataPath, JSON.stringify({ videoUrl, requestId: result.request_id, model: segment.model, duration: 30, dialogue: segment.dialogue }, null, 2));
      console.log(`${segment.id} completed.`);
    }
    const videoPath = `${dir}/${segment.id}.mp4`;
    if (!(await exists(videoPath))) {
      const response = await fetch(videoUrl, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error("Video download failed");
      await writeFile(videoPath, Buffer.from(await response.arrayBuffer()));
      console.log(`${segment.id} downloaded.`);
    }
    referenceUrl = videoUrl;
  }
  console.log("Both presenter segments are ready for editing.");
}

if(process.argv.includes('--meet-buddy')||process.argv.includes('--product')||process.argv.includes('--french')||process.argv.includes('--business')) await import('./generate-product-ugc.js');
else main().catch((error: unknown) => {
  // SDK/network exceptions can contain authorization headers: never print them.
  if (error instanceof UploadError) console.error(`Could not ${error.stage}: HTTP ${error.httpStatus}. No generation was submitted in this attempt.`);
  else if (error instanceof AuthenticationError) console.error("Higgsfield authentication rejected. Check credentials locally.");
  else if (error instanceof NotEnoughCreditsError) console.error("Higgsfield reported insufficient credits or denied access.");
  else if (error instanceof TimeoutError) console.error("Waiting timed out. Check the Higgsfield dashboard before resubmitting.");
  else if (error instanceof APIError) console.error(`Higgsfield API rejected the operation${Number.isInteger(error.statusCode) ? ` (HTTP ${error.statusCode})` : ""}.`);
  else console.error("Generation or download failed. Check Higgsfield before resubmitting; no automatic retry was made.");
  process.exitCode = 1;
});
