# Tips to Trip video production

## British English Meet Buddy / Travel Status campaign

The new 60-second vertical campaign is isolated in `artifacts/meet-buddy-en/`, with a new fictional adult British presenter aged 25. `scripts/meet-buddy-english.json` defines the narration, character and music. `scripts/meet-buddy-demo.mjs` uses the supplied app screens and recordings as interaction references, with the requested fictional identities, 24-person scrolling list, Sri Lanka maps and edited immediate status refresh. `demo/source-edits.json` records those demonstration edits. Requests remain awaiting a response; the campaign does not invent an accepted connection.

The initial Wan 2.7 audio-driven takes were rejected on visual review for delayed mouth movement. Replacement native spoken performances use the documented Higgsfield Wan 3.0 Prime model, followed by ElevenLabs `eleven_multilingual_sts_v2` Voice Changer with the British Alice voice. The English Voice Changer test is retained separately because it weakened the Meet Buddy name. The Travel Status section uses readable full-screen app footage and clean ElevenLabs narration. Original takes, failed request states and voice tests remain preserved.

Completed generations and audio are cached. `npm run ugc:generate -- --meet-buddy --native-performance --part=1` requests or resumes an individual native take. `--retry-failed` archives a known terminal failure and submits a new billable request; use it only after diagnosing the failure. Never apply it to an ambiguous submission. `npm run ugc:voice -- --meet-buddy --native-convert --available-native --multilingual-native` converts completed native performances and obtains independent official speech timestamps. These API operations consume credits.

`node scripts/prepare-meet-buddy-performance.mjs` compares source and converted speech timing and makes identical frame-aligned leading trims. `npm run ugc:meet-buddy:render` renders the app edit, English captions, upper-right logo outside the closing card, central closing logo and store badges, and independently mixed ducked music. Keep map profile badges inland. Add `-- --revision=land-map-fixed` to the render and verification commands to export the map and closing-brand revision separately. `npm run ugc:meet-buddy:verify` checks duration, dimensions, frame count, full decoding, decoded audio duration, mix timing and loudness. A reviewed `performance-approval.json` selects the final export name; unapproved performances render as `-review-draft.mp4`. The dedicated Sync Lipsync 3 access requirement remains separate from this native-performance workflow.

## Seedance SDK example

Server-side TypeScript example using Node.js 22+ and npm.

1. Install dependencies with `npm ci`.
2. Create `.env.local` from `.env.example` if needed. In a local editor, replace the placeholder with `HF_CREDENTIALS=key-id:key-secret` using your real Higgsfield key ID and secret. Never paste credentials into chat or commit them. `.env.local` is ignored by Git.
3. Run `npm run typecheck`.
4. Run `npm start`. **Every run with valid credentials submits a billable generation request.**

The example loads `.env.local` at runtime using Node's built-in environment loader. An existing `HF_CREDENTIALS` process environment variable takes precedence. Keep the script on the server; do not bundle it into browser code.

It calls the official SDK's `subscribe` method with automatic polling for `bytedance/seedance-2.5/text-to-video`: prompt `A cinematic scene at sunset`, duration `5`, resolution `720p`, aspect ratio `16:9`. Other settings use the model's defaults. Only a completed response containing a valid video URL is printed to stdout. Errors and unsuccessful outcomes return exit code 1 without dumping SDK errors or credentials.

Submission retries are disabled to avoid duplicate billable requests. Polling waits up to 30 minutes. If waiting fails, check the request in the Higgsfield dashboard before running again. The installed SDK stops polling for completed, failed, or nsfw responses; a canceled response during polling may instead reach the timeout, which is treated as unverified.

Official references:

- [SDK documentation](https://docs.higgsfield.ai/docs/how-to/sdk)
- [Seedance 2.5 API reference](https://console.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference)

Typechecking does not verify a live generation. Verification requires a successful `npm start` run that returns a video URL.

## One-minute UGC demo

`npm run ugc:generate` generates two 30-second English presenter segments in vertical 9:16 format. The second uses a six-second reference from the first for continuity. It uses the documented file-upload API and SDK `subscribe` calls. FFmpeg must be installed. Completed segments are cached in the Git-ignored `artifacts/ugc` directory and reused on later runs. New generations are billable; after an ambiguous failure, check Higgsfield before resubmitting.

`npm run ugc:render` edits those segments with the original Meet Buddy, Meet Buddy part 2, and Near You recordings from `/Users/kavinduwijewickrama/remotion/my-video/Product screen recordings`. It exports `artifacts/ugc/tips-to-trip-ugc-60s.mp4` at 720 × 1280, 30 fps, with narration. The app screens are composited from the supplied recordings. The presenter is AI-generated. The edit uses all three recordings and labels the demonstrated steps. Source paths and edit timing are in `scripts/render-ugc.mjs`.

The Spanish version uses `npm run ugc:generate -- --spanish` and `npm run ugc:render -- --spanish`. It has its own presenter, Spanish script and overlays, with assets cached separately under `artifacts/ugc-es`. Its output is `tips-to-trip-ugc-es-60s.mp4`. The character and edit are defined in `scripts/ugc-spanish.json`. New presenter generations are billable. The existing English export is preserved.

Seedance returned moderation responses for the Spanish presenter requests. `npm run ugc:generate -- --spanish --wan` selects the documented Higgsfield Wan 3.0 image-to-video endpoint instead, using the same adult travel portrait for both takes. Only completed clips are cached as successful outputs. The original Seedance example and English generation workflow retain their model settings.

## ElevenLabs Spanish voice

Add `ELEVENLABS_API_KEY` locally to the ignored `.env.local` file. The server script loads it at runtime and sends it only in the ElevenLabs authentication header; it never prints the key or raw service errors.

`npm run ugc:voice -- --design` creates three voice previews for an adult Spanish travel creator with a smooth, warm, subtly sultry voice. `npm run ugc:voice -- --convert --preview=1` saves the selected voice to the account and converts the two existing Spanish presenter audio tracks using `eleven_multilingual_sts_v2`. These API operations consume ElevenLabs credits; cached outputs are reused. Do not delete completed outputs or retry an ambiguous service failure without checking the ElevenLabs account first.

The voice conversion follows the [official Voice Changer workflow](https://elevenlabs.io/docs/eleven-creative/playground/voice-changer), preserving the original performance timing. After checking converted speech against the source and saving `artifacts/ugc-es/elevenlabs/timing-verification.json`, `npm run ugc:voice:render` combines both 30-second tracks, normalizes the voice, and copies the existing video and Spanish captions. It exports `artifacts/ugc-es/tips-to-trip-ugc-es-elevenlabs-60s.mp4` and a separate narration MP3. The original Spanish video is preserved. Export verification checks the duration, frame count, full decode, and identical video stream, and saves the results in `artifacts/ugc-es/elevenlabs/verification.json`.

`npm run ugc:render -- --spanish --logo --elevenlabs` renders the supplied app logo in the upper-right corner, removes the old brand chips and demo header, and copies the verified ElevenLabs audio and captions. It creates `artifacts/ugc-es/tips-to-trip-ugc-es-elevenlabs-logo-60s.mp4` with separate edit assets under `edit-logo/`, preserving earlier exports. This local edit does not call either generation API.

## Spanish product UGC with music

The new product brief is in `scripts/ugc-product-spanish.json`: an adult 22-year-old Spanish travel creator, an energetic and trustworthy voice, Meet Buddy, Travel Buddy requests and group chat, and Near You. The supplied logo appears in the upper-right throughout. Outputs are isolated in `artifacts/ugc-product-es/`.

`npm run ugc:generate -- --product` generates the character portrait with Higgsfield Soul 2 and two 30-second presenter takes with Wan 3.0. Submissions use the official SDK; saved pending request IDs allow recovery without duplicate submissions. `--portrait-only` stops after the portrait.

Use `npm run ugc:voice -- --product --design`, then `npm run ugc:voice -- --product --convert --preview=1`, for the ElevenLabs voice. `npm run ugc:voice -- --product --music` composes a 60-second instrumental music bed. These are billable operations, with completed assets reused from the cache.

Before export, extract the original and converted audio into mono 16 kHz PCM WAVs named `presenter-01.wav` and `presenter-02.wav` under the episode directory and its `elevenlabs/` subdirectory. Transcribe both sets with word timestamps into matching `.transcript.json` files (arrays of segments with `start`, `end`, `text` and `words` containing `start`, `end` and `word`). Review narration content and feature names, then run `npm run ugc:product:verify -- --audio-only` and `npm run ugc:product:captions`. Align scene boundaries to the actual speech; an optional `scene-timing.json` overrides the renderer's default scene plan.

`npm run ugc:product:render` combines the actual recordings, presenter, logo, burned-in Spanish captions, ElevenLabs voice, and a music bed ducked under speech. It exports `tips-to-trip-product-ugc-es-60s.mp4` and keeps a `captions.srt` sidecar. `npm run ugc:product:verify` checks audio timing, all four requested recordings, a complete decode, duration, frame count and final loudness, saving `verification.json`. Inspect representative exported frames before delivery.

The renderer finishes audio separately from video filters, preventing scene metadata changes from resetting the mix. Verification also checks the decoded audio duration and final narration alignment. After the scene clips are complete, `npm run ugc:product:render -- --mix-only` rebuilds captions and the final mix without rendering the scenes again.

The initial second Wan 3.0 take failed the speech intelligibility review. `npm run ugc:voice -- --product --tts-second` creates clean narration with ElevenLabs `eleven_multilingual_v2`; `npm run ugc:generate -- --product --repair-second` uses that audio to drive two 15-second Higgsfield Wan 2.7 takes. The rejected files are backed up with `native-rejected` in their filenames before the completed replacement is installed. Refresh the QA WAVs and transcripts after replacement. These repair operations consume credits and reuse saved completed results when rerun.

## French product video

`scripts/ugc-product-french.json` defines a different adult 22-year-old French presenter and relaxed, trustworthy delivery. The French version uses clean ElevenLabs narration to drive four 15-second Higgsfield Wan 2.7 clips, rather than converting generated native dialogue. Outputs are isolated in `artifacts/ugc-product-fr/`; older videos are preserved.

Use `npm run ugc:voice -- --french --design`, `npm run ugc:voice -- --french --tts --preview=1`, and `npm run ugc:voice -- --french --music`. Speech includes official character timestamps, with edits to long silent pauses reflected in caption alignment. A short take can be slowed with preserved pitch to maintain relaxed pacing; speech is never accelerated or truncated to fit.

Generate the presenter with `npm run ugc:generate -- --french`. The approved clean replacement portrait and all four audio-driven clips have completed successfully. `npm run ugc:generate -- --french --retry-rejected` explicitly retries a known rejected submission, archives its rejection record, and reuses completed assets. Ambiguous submissions without a definite rejection are never retried automatically.

Review actual model audio against the prepared narration, transcribe the generated audio into matching root `.transcript.json` files, then use `npm run ugc:product:captions -- --french`, `npm run ugc:product:render -- --french`, and `npm run ugc:product:verify -- --french`. Review exported frames before delivery. An audio-only adjustment can reuse the completed scene clips with `npm run ugc:product:render -- --french --mix-only`.

Completed export: `artifacts/ugc-product-fr/tips-to-trip-product-ugc-fr-60s.mp4`. It uses a new fictional adult French presenter, the four actual app recordings, French captions, the supplied logo throughout, and ElevenLabs narration and instrumental music. Full decoding, 60-second duration, 720 × 1280 dimensions, 30 fps, and final narration timing passed verification. The final mix measures -16.09 LUFS and -1.49 dBTP. Verification and reviewed frames are saved beside the export; previous language exports are preserved.

The localized 43–45 second presenter mismatch is fixed in `artifacts/ugc-product-fr/tips-to-trip-product-ugc-fr-60s-pause-fixed.mp4`. `node scripts/fix-french-pause.mjs` centers the existing app view during that interval and brings the presenter back at 45 seconds. It copies the original narration/music stream unchanged, preserves the original export, and verifies duration, dimensions, frame count, full decoding and the audio stream hash. Reviewed transition frames and verification are under `qa/pause-fix/`. This is an editorial correction of that interval, not a full-video lip-sync regeneration.

The share-sheet revision is `artifacts/ugc-product-fr/tips-to-trip-product-ugc-fr-60s-fresh-profiles.mp4`. `npx tsx scripts/generate-sharing-profiles.ts` creates five fictional Higgsfield Soul 2 portraits with durable request tracking and cached completed assets; uncached generations are billable. `node scripts/replace-sharing-profiles.mjs` replaces the contact photos and personal names while tracking the sheet animation around 22 seconds. It preserves the “Note to self” label, destination badges, app sharing buttons, existing pause correction and original audio stream. Generation metadata is in `sharing-profiles/`, with export verification and visual QA in `qa/sharing-profiles/`.

`node scripts/replace-sharing-profiles.mjs --spanish` applies the same cached profiles to the Spanish product video, using its separately reviewed share-sheet timing at frames 696–731 (23.2–24.37 seconds). It exports `artifacts/ugc-product-es/tips-to-trip-product-ugc-es-60s-fresh-profiles.mp4`, copies the original Spanish narration/music unchanged, and verifies the full decode, duration, dimensions, frame count and audio hash. This edit does not submit new generation requests. Its reviewed frames and verification are under `artifacts/ugc-product-es/qa/sharing-profiles/`.

## Spanish business campaign

`scripts/ugc-business-spanish.json` defines a new fictional adult Spanish creator aged 21 and a business-focused script. `scripts/ugc-business-spanish-scenes.json` demonstrates profile creation, generated logo options, publishing experiences, Near You discovery and business statistics using the two supplied business recordings. The edit uses the actual app UI and avoids unsupported booking, sales or reach claims. Assets are isolated in `artifacts/ugc-business-es/`.

Prepare narration with `npm run ugc:voice -- --business --tts --reuse-spanish-voice` and music with `npm run ugc:voice -- --business --music`. This campaign uses the existing energetic Spanish custom voice because saving another designed voice returned a definite account voice-slot limit. No existing voices were removed. The narration and instrumental soundtrack are newly generated.

`npm run ugc:generate -- --business --portrait-only` creates a Higgsfield Soul 2 portrait. Review it before animation: this campaign uses an approved crop recorded in `portrait-review.json` to exclude unwanted background/interface elements. `npm run ugc:generate -- --business` uses the clean reference and supplied ElevenLabs speech to drive four 15-second Wan 2.7 clips. Generation is billable; completed outputs are cached, and pending requests are tracked to prevent duplicate submissions.

Independent Scribe speech review identified unintended fillers and a repeated syllable. `node scripts/polish-business-performance.mjs` makes the same frame-aligned cuts in presenter footage and narration, adjusts caption timestamps, and uses app cutaways at the repair points. Original clips and speech remain preserved. `npm run ugc:voice -- --business --transcribe --polished` independently reviews the repaired speech; transcription is billable and cached separately from the initial review. Root presenter WAVs also have independent local transcripts; narration transcripts use the official ElevenLabs alignment.

After speech review, use `npm run ugc:product:captions -- --business`, `npm run ugc:product:render -- --business`, and `npm run ugc:product:verify -- --business`. The export is `artifacts/ugc-business-es/tips-to-trip-business-ugc-es-60s.mp4`, with Spanish captions, the supplied logo in the upper-right throughout, and music ducked under narration. Verification checks 60 seconds, vertical 720 × 1280, 30 fps, all requested recordings, full decoding, audio duration, narration timing and loudness. Visual review assets are saved in `qa/visual-review/`.

## French business campaign

Use `--business --french` to select the isolated French campaign under `artifacts/ugc-business-fr/`. Its new fictional 21-year-old French presenter and business message are in `scripts/ugc-business-french.json`; its edit is in `scripts/ugc-business-french-scenes.json`. The message explains visibility within the Tips to Trip traveler network and new sales opportunities. It does not promise a sales increase. Both original business recordings and the supplied logo are used.

Prepare fresh narration with `npm run ugc:voice -- --business --french --tts --reuse-french-voice` and music with `npm run ugc:voice -- --business --french --music`. The approved French custom voice is reused with new French speech; existing account voices are unchanged. A longer first profile explanation is preserved under `elevenlabs/takes/segment-02-long/`; the revised script fits without accelerating or truncating speech. Independently inspect the narration with `npm run ugc:voice -- --business --french --transcribe` before video generation. The initial review identified an unrequested opening word and hesitation. `node scripts/prepare-french-business-performance.mjs` removes those before animation, preserves the originals, adjusts official caption alignment, and aligns scene timing to the French speech. It refuses to change narration once any presenter has been submitted. Review the cleaned audio with `npm run ugc:voice -- --business --french --transcribe --polished`; these transcription operations are billable and cached separately.

Generate and visually approve the portrait with `npm run ugc:generate -- --business --french --portrait-only`. The clean crop and approval are recorded in `portrait-review.json`. Then `npm run ugc:generate -- --business --french` requests four audio-driven Higgsfield Wan 2.7 takes at native 1080p, using the cleaned 15-second narration segments. The first two takes completed; the last two were rejected with HTTP 403 (insufficient credits). The final campaign uses the new presenter for the first half and narrated actual app demonstrations for the second half, retaining the full 60-second French explanation. `npm run ugc:generate -- --business --french --app-demo-finish` assembles only the accepted, completed takes and records this mode in `production-mode.json`; it never retries the rejected submissions. Each segment's timeline is normalized before combining, avoiding drift from AAC tail padding. API submissions are billable and completed assets are cached.

Finish with `npm run ugc:product:captions -- --business --french`, `npm run ugc:product:render -- --business --french`, and `npm run ugc:product:verify -- --business --french`. The 60-second export is `tips-to-trip-business-ugc-fr-60s.mp4` at 1080 × 1920, 9:16 and 30 fps, with H.264 video, AAC audio, burned-in French captions and an SRT sidecar. The French business layout moves headlines and captions above the bottom controls and keeps the logo in the upper-right. Final video, audio timing, loudness and exported frames must pass review before delivery; previous language exports remain preserved.
