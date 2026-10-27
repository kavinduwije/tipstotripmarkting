import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import {
  APIError,
  AuthenticationError,
  BadInputError,
  CredentialsMissedError,
  NotEnoughCreditsError,
  TimeoutError,
  ValidationError,
  config,
  higgsfield,
} from "@higgsfield/client/v2";

function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  try {
    loadEnvFile(fileURLToPath(new URL(".env.local", import.meta.url)));
  } catch {
    fail("Could not load .env.local. Add HF_CREDENTIALS locally and run again.");
    return;
  }

  // Credentials stay in this Node process and are never logged.
  const credentials = process.env.HF_CREDENTIALS;
  if (
    !credentials ||
    credentials === "key-id:key-secret" ||
    !/^[^:\s]+:[^:\s]+$/.test(credentials)
  ) {
    fail("Set HF_CREDENTIALS in .env.local to your key-id:key-secret locally. Do not share it in chat.");
    return;
  }

  config({
    credentials,
    // Avoid retrying submission of a billable request after an ambiguous failure.
    maxRetries: 0,
    pollInterval: 5_000,
    maxPollTime: 30 * 60 * 1_000,
  });

  const result = await higgsfield.subscribe(
    "bytedance/seedance-2.5/text-to-video",
    {
      input: {
        prompt: "A cinematic scene at sunset",
        duration: 5,
        resolution: "720p",
        aspect_ratio: "16:9",
      },
      withPolling: true,
    },
  );

  const status: string = result.status;
  switch (status) {
    case "completed": {
      const videoUrl = result.video?.url;
      if (!videoUrl) {
        fail("Request completed but returned no video URL. Generation is not verified.");
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(videoUrl);
      } catch {
        fail("Request completed but returned an invalid video URL.");
        return;
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        fail("Request completed but returned an unsupported video URL.");
        return;
      }
      console.log(videoUrl);
      return;
    }
    case "failed":
      fail("Generation failed; no successful video was returned.");
      return;
    case "canceled":
    case "cancelled":
      fail("Generation was canceled; no successful video was returned.");
      return;
    case "nsfw":
    case "moderated":
      fail("Generation was rejected by moderation; no successful video was returned.");
      return;
    default:
      fail("Request did not return a completed status; generation is not verified.");
  }
}

main().catch((error: unknown) => {
  // Never dump SDK errors, responses, or request objects: they can contain headers.
  if (error instanceof AuthenticationError || error instanceof CredentialsMissedError) {
    fail("Authentication failed. Check your credentials locally.");
  } else if (error instanceof NotEnoughCreditsError) {
    fail("The API reported insufficient credits or denied access. Check your Higgsfield account.");
  } else if (error instanceof BadInputError || error instanceof ValidationError) {
    fail("The API rejected the request parameters. Generation is not verified.");
  } else if (error instanceof TimeoutError) {
    fail("Waiting for completion timed out. Check the request in Higgsfield before submitting again; it may still be running.");
  } else if (error instanceof APIError) {
    fail("The Higgsfield API returned an error. Generation is not verified.");
  } else {
    fail("The request could not complete. Check network access and the Higgsfield dashboard before submitting again.");
  }
});
