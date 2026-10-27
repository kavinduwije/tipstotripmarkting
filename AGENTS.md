# Project instructions

## British English Meet Buddy campaign

- The new Meet Buddy / Travel Status campaign uses a distinct fictional British adult woman aged 25 and is isolated under `artifacts/meet-buddy-en/`. Its brief, voice and source references are in `scripts/meet-buddy-english.json`.
- For this campaign, keep every map profile badge on land. The closing card uses only the central brand logo with Meet Buddy and the store badges; omit the upper-right duplicate on that card. Keep the upper-right logo in the other scenes.
- Match Meet Buddy's right-side floating controls to the supplied recordings and app source: list/map toggle, handshake requests, profile pin, then circled help; retain the upper-right location button in map mode. Reuse the native button faces rather than approximate glyphs. Their reference crops are recorded in `demo/floating-controls.json`.
- Expanded fictional people, Sri Lanka destinations and immediate status-cloud refreshes are expressly requested marketing demonstration edits. Preserve actual interaction controls and record the alterations in `demo/source-edits.json`; do not describe an edited screen as proof of a live backend update. A sent request must remain awaiting a response unless acceptance is actually demonstrated.
- Its first audio-driven takes failed visual review. Use the reviewed native Higgsfield speaking takes with cadence-preserving ElevenLabs conversion, retaining originals and failed request states. Full-screen app footage can carry the Travel Status voiceover. `scripts/prepare-meet-buddy-performance.mjs` records speech timing and matching frame-aligned trims; `scripts/render-meet-buddy.mjs` and `scripts/verify-meet-buddy.mjs` handle rendering and technical verification. Do not mark an export approved until its visible performance has been reviewed.

## Visuals and voice

- Use **Higgsfield for generated video visuals** and **ElevenLabs for the final character voice**. This is the project's established production workflow unless the user requests a different approach.
- For new product UGC videos, use the supplied Tips to Trip logo as the branding asset and the actual app recordings to illustrate accurate user journeys. Use ElevenLabs for narration and instrumental background music, keeping music below speech with fades and ducking. Aim for natural creator delivery, readable app screens and polished edits. Match the character to the current brief: the Spanish and French business campaigns each use a distinct fictional adult woman aged 21; the existing French product campaign uses a different woman aged 22. Use natural expressions and an energetic, trustworthy voice. Keep her rested and comfortable, with relaxed shoulders, unhurried gestures and breathing room. Older character profiles apply only to their existing videos.
- For new language productions, prefer preparing clean ElevenLabs narration first and using it as driving audio for Higgsfield visuals. Use official speech timestamps for captions, independently review the spoken content, and align app edits to the narration. Keep language versions in separate artifact directories.
- Use the project's existing TypeScript, npm, Node.js 22+ and FFmpeg tooling. Reuse the scripts and completed assets before adding a new workflow.
- For a voice-only revision, reuse the completed Higgsfield video. Convert its narration with ElevenLabs Voice Changer so the original performance, cadence and pauses remain aligned with the presenter.
- Prefer `eleven_multilingual_sts_v2` for the Spanish speech-to-speech workflow. Design or select a voice matching the current brief's character, language and delivery. The earlier Meet Buddy / Near You video used an adult woman aged 25 with a smooth, warm and subtly sultry voice; the new product video uses an adult woman aged 22 with an energetic, trustworthy voice. Do not carry an older character's voice direction into a different brief.
- If generating narration from text instead, explicitly align the presenter and captions to the new audio. Do not assume independently generated speech will match existing mouth movements.
- Check Higgsfield's native dialogue for intelligibility before voice conversion. If it is corrupted, Voice Changer can preserve that corruption. Generate clean scripted narration with ElevenLabs and use a documented Higgsfield audio-driven model (such as `wan/v2.7/image-to-video` with `audio_url`) to synchronize new visuals. Keep rejected takes separate and verify the replacement.
- Read the current official SDK and relevant model/API documentation before changing integrations or generation parameters. Use supported parameters and handle unsuccessful outcomes explicitly.

## Credentials

- Keep `HF_CREDENTIALS` (Higgsfield key ID and secret in `key-id:key-secret` format) and `ELEVENLABS_API_KEY` in the Git-ignored `.env.local` file or server environment.
- Load credentials only at runtime in server-side scripts. Never inspect the environment file contents, print or log credential values, expose them in client bundles, or commit them.
- If a key is missing, ask the user to enter it locally. Never ask them to paste it into chat.
- Keep placeholders only in `.env.example`. Do not dump raw API errors, request headers or arbitrary response bodies that might expose credentials.

## Current video workflow

1. Define the character, script and edit using the existing configuration and renderer. `scripts/ugc-spanish.json` contains the Spanish character, dialogue and scene timing.
2. Generate presenter clips through Higgsfield with the official SDK's `subscribe` method, wait for completion, and cache successful outputs.
3. Combine the presenter with the supplied app recordings using FFmpeg. Show the actual Meet Buddy and Near You journeys rather than generating replacement app UI.
4. Design/select an ElevenLabs voice, then convert the original narration with Voice Changer. Reuse the saved voice and converted audio for unchanged inputs.
5. Check the converted speech against the source for wording, pronunciation, pauses and timing. Save the timing assessment before rendering the voice revision.
6. Export a new file with normalized audio and the appropriate captions, preserving the previous export. When only the voice changes, copy the existing video and subtitle streams.
7. Verify the finished export before reporting completion, then provide a clickable link to the video.

Existing commands:

```sh
npm run typecheck
npm run ugc:generate -- --spanish --wan
npm run ugc:render -- --spanish
npm run ugc:voice -- --design
npm run ugc:voice -- --convert --preview=1
npm run ugc:voice:render
```

These are separate production stages, not a checklist to rerun for every request. Higgsfield generation and ElevenLabs design/conversion consume credits. Use completed cached assets when they satisfy the request. The voice renderer currently requires `artifacts/ugc-es/elevenlabs/timing-verification.json` from an audio timing comparison; it does not create that assessment itself.

The original Seedance example uses `bytedance/seedance-2.5/text-to-video`. The completed Spanish presenter used Higgsfield Wan 3.0 image-to-video after Seedance returned moderation responses. Do not report moderated, failed or canceled requests as successful. Report blockers and model changes accurately.

## Editing preferences and source assets

- Keep the established UGC exports at 60 seconds, vertical 9:16, 720 × 1280 and 30 fps unless the user specifies another format.
- Match captions and overlays to the requested spoken language. Preserve the feature names **Meet Buddy**, **Near You** and the brand **Tips to Trip**.
- Do not add the “AI presenter” text label; the user explicitly requested its removal.
- For all new UGC branding, use `General-assesets/app_logo_white.png` in the upper-right corner throughout, including the closing scene. Remove the upper-left “Tips to Trip” text/chip, the “DEMO REAL DE LA APP” header, and the redundant closing brand label. Render the earlier Spanish ElevenLabs version with `npm run ugc:render -- --spanish --logo --elevenlabs`; the product renderer applies the logo to every scene in both languages.
- Use the supplied recordings from `/Users/kavinduwijewickrama/remotion/my-video/Product screen recordings/`. The latest product video uses `Meet buddy.mov`, `Travel buddy.mov`, `Travel buddy post group chat.mov` and `Near you.mov`. The earlier Meet Buddy video also uses `Meet Buddy part 2.mov`.
- The Spanish business campaign uses `Features for travel business providers.mov` and `How to create business profile in tips to trip with generated business logos as well.mov`. Its script and scenes are in `scripts/ugc-business-spanish.json` and `scripts/ugc-business-spanish-scenes.json`; outputs are isolated in `artifacts/ugc-business-es/`. Show actual profile creation, logo choices, publication options, Near You discovery and statistics. Do not invent booking, revenue or reach guarantees.
- The French business version uses the same recordings with a new presenter and fresh French narration. Its configurations are `scripts/ugc-business-french.json` and `scripts/ugc-business-french-scenes.json`, and its outputs are isolated in `artifacts/ugc-business-fr/`. This brief calls for social dimensions: export 60 seconds at 1080 × 1920, 9:16, 30 fps, with captions above the bottom platform controls. Describe visibility among travelers in the Tips to Trip network and opportunities to develop sales in natural French, without guaranteeing results.
- Keep outputs in the Git-ignored `artifacts/` directory. Preserve originals and give new language or voice revisions distinct filenames.
- Current Spanish exports are `artifacts/ugc-es/tips-to-trip-ugc-es-60s.mp4` and `artifacts/ugc-es/tips-to-trip-ugc-es-elevenlabs-60s.mp4`. Voice assets and verification records are under `artifacts/ugc-es/elevenlabs/`.

## Verification and reporting

- Check duration, dimensions, frame rate, audio and captions with FFprobe, and run a full FFmpeg decode check.
- Check the narration content and timing; automatic transcripts can misrecognize feature names and are not proof of perfect lip sync. Investigate meaningful timing drift rather than claiming success from file existence alone.
- Review text-to-speech output for unintended fillers and repeated syllables. When cleaning already audio-driven presenter footage, make identical frame-aligned cuts in narration and video, hide the cuts with relevant app demonstrations, and adjust caption timestamps. Preserve original generations and narration; independently check the repaired speech before export. `scripts/polish-business-performance.mjs` records this process for the Spanish business campaign.
- For mouth-animation corrections, apply a dedicated Higgsfield video-to-video lip-sync pass to presenter-only footage using the matching dry ElevenLabs speech, then restore the app edit and music. Review mouth shapes, lip closures, speech onset and pauses as well as audio timing. Keep a distinct corrected export; if model access is blocked, report the exact blocker and do not label the existing export as corrected.
- Check decoded final audio duration and compare its narration timing with the verified voice tracks. Container duration alone can hide timestamp errors. Render the audio mix separately from video filters so scene metadata changes cannot reset narration or music processing.
- For voice-only revisions, verify that the video stream is unchanged. Normalize narration to approximately -16 LUFS with a true-peak target of -1.5 dBTP.
- Keep useful generation metadata and verification results without secrets. Do not claim an API integration works until its requested live operation has succeeded; typechecking alone is insufficient.
- After an ambiguous billable request failure, inspect its saved request state or service status before resubmitting. Avoid automatic duplicate submissions.

## Official references

- Higgsfield SDK: https://docs.higgsfield.ai/docs/how-to/sdk
- Seedance 2.5: https://console.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference
- ElevenLabs Voice Changer: https://elevenlabs.io/docs/eleven-creative/playground/voice-changer
- ElevenLabs speech-to-speech API: https://elevenlabs.io/docs/api-reference/speech-to-speech/convert
- ElevenLabs Voice Design API: https://elevenlabs.io/docs/api-reference/text-to-voice/design
