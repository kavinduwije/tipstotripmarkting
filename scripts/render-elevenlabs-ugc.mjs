import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = `${root}artifacts/ugc-es`;
const converted = `${dir}/elevenlabs`;
const original = `${dir}/tips-to-trip-ugc-es-60s.mp4`;
const output = `${dir}/tips-to-trip-ugc-es-elevenlabs-60s.mp4`;
const voiceOnly = `${dir}/tips-to-trip-ugc-es-elevenlabs-voice.mp3`;
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result;
}
const base = '[1:a]aresample=48000,apad,atrim=duration=30,asetpts=PTS-STARTPTS[a1];[2:a]aresample=48000,apad,atrim=duration=30,asetpts=PTS-STARTPTS[a2];[a1][a2]concat=n=2:v=0:a=1,afade=t=out:st=59.75:d=0.25';
const inputs = ['-i', original, '-i', `${converted}/presenter-01.mp3`, '-i', `${converted}/presenter-02.mp3`];
function loudness(stderr) {
  const match = stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error('Loudness measurement missing');
  return JSON.parse(match[0]);
}
console.log('Measuring the converted narration.');
const measured = loudness(run('ffmpeg', ['-hide_banner', ...inputs, '-filter_complex', `${base},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]`, '-map', '[a]', '-f', 'null', '-']).stderr);
const normalize = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
console.log('Exporting the one-minute video with the ElevenLabs voice.');
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${base},${normalize}[a]`, '-map', '0:v:0', '-map', '[a]', '-map', '0:s?', '-c:v', 'copy', '-c:s', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-metadata:s:a:0', 'language=spa', '-t', '60', '-movflags', '+faststart', output]);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', output, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', voiceOnly]);
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,duration,nb_frames:format=duration', '-of', 'json', output]).stdout);
const video = probe.streams.find(s => s.codec_type === 'video');
if (Number(probe.format.duration) !== 60 || video.width !== 720 || video.height !== 1280 || video.nb_frames !== '1800') throw new Error('Export dimensions or duration incorrect');
run('ffmpeg', ['-hide_banner', '-v', 'error', '-xerror', '-i', output, '-map', '0:v', '-map', '0:a', '-f', 'null', '-']);
const hash = path => run('ffmpeg', ['-hide_banner', '-v', 'error', '-i', path, '-map', '0:v:0', '-c:v', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.trim();
const originalHash = hash(original), outputHash = hash(output);
if (originalHash !== outputHash) throw new Error('Video stream changed unexpectedly');
const finalLoudness = loudness(run('ffmpeg', ['-hide_banner', '-i', output, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']).stderr);
const timing = JSON.parse(readFileSync(`${converted}/timing-verification.json`, 'utf8'));
const voice = JSON.parse(readFileSync(`${converted}/voice.json`, 'utf8'));
writeFileSync(`${converted}/verification.json`, JSON.stringify({ output, voiceOnly, voiceId: voice.voiceId, model: 'eleven_multilingual_sts_v2', probe, fullDecodePassed: true, unchangedVideoStream: true, videoStreamHash: outputHash, finalLoudness, timing, timingAssessment: 'Audio envelope alignment differs by at most 10 milliseconds in five-second windows. Word timing estimates are approximate; ASR merges conoce gente in the converted second segment.' }, null, 2));
console.log('Verified: 60 seconds, 720 × 1280, 1800 frames; full decode passed; video stream unchanged.');
console.log(output);
