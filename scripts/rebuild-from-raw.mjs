import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLooseSrt } from './lib/extractors.mjs';
import { buildJourneySummary } from './lib/aggregate.mjs';
import { buildVideoRecord } from './lib/build-record.mjs';
import { refineVideoLocations } from './lib/refine-videos.mjs';
import { loadVisualAnalysis, publishVisualFrames } from './lib/visual-analysis.mjs';
import { fetchComments } from './fetch-comments.mjs';
import { extractCommentEvidence, aggregateCommentLocations } from './lib/comment-extractors.mjs';

const root = resolve(import.meta.dirname, '..');
const rawDir = resolve(root, 'raw/videos');
const publicDataDir = resolve(root, 'public/data');
const publicFramesDir = resolve(root, 'public/frames');
const playlistUrl =
  process.env.BILI_PLAYLIST_URL ?? 'https://space.bilibili.com/1173628599/lists/6193999?type=season';
const playlistId = '1173628599_6193999';

mkdirSync(publicDataDir, { recursive: true });
mkdirSync(publicFramesDir, { recursive: true });

const videoDirs = readdirSync(rawDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => resolve(rawDir, entry.name));

const metas = videoDirs
  .map((dir) => {
    const metaPath = resolve(dir, 'meta.json');
    if (!existsSync(metaPath)) return null;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    return { dir, meta, metaPath };
  })
  .filter(Boolean)
  .sort((a, b) => String(a.meta.upload_date).localeCompare(String(b.meta.upload_date)));

const videos = [];
const commentResults = [];

for (const [index, item] of metas.entries()) {
  const subtitlePath = findFirstExisting([
    resolve(item.dir, `${item.meta.id}.ai-zh.srt`),
    resolve(item.dir, 'subtitle.ai-zh.srt'),
  ]);
  const transcriptPath = resolve(item.dir, 'transcript.txt');
  let transcriptText = '';
  let transcriptSource = 'official_subtitle';
  let subtitleBlocks = [];

  if (subtitlePath && existsSync(subtitlePath)) {
    subtitleBlocks = parseLooseSrt(subtitlePath).map((block) => ({
      ...block,
      startSec: parseBlockStartSec(block.timestamp),
    }));
    transcriptText = subtitleBlocks.map((block) => block.text).join(' ');
  } else if (existsSync(transcriptPath)) {
    transcriptText = readFileSync(transcriptPath, 'utf8');
    transcriptSource = 'asr';
  } else {
    transcriptText = item.meta.title;
    transcriptSource = 'asr';
  }

  const rawVisualAnalysis = loadVisualAnalysis(item.dir);
  const visualAnalysis = publishVisualFrames({
    videoDir: item.dir,
    bvid: item.meta.id,
    visualAnalysis: rawVisualAnalysis,
    publicFramesDir,
  });
  const visualAnalysisPath = visualAnalysis ? resolve(item.dir, 'visual-evidence.json') : null;

  // Fetch comments (uses cache if available)
  const commentResult = fetchComments(item.meta.id, { limit: 200, forceRefresh: false });

    // Extract comment evidence
    let commentEvidenceList = [];
    if (commentResult.success && commentResult.count > 0) {
      try {
        const comments = JSON.parse(readFileSync(resolve(item.dir, 'comments.json'), 'utf8'));
        if (Array.isArray(comments)) {
          commentEvidenceList = extractCommentEvidence(comments);
          writeFileSync(
            resolve(item.dir, 'comment-evidence.json'),
            JSON.stringify(commentEvidenceList, null, 2) + '\n',
          );
        }
      } catch (err) {
        console.warn(`  [comment-evidence] ${item.meta.id}: ${err.message}`);
      }
    }

  const built = buildVideoRecord({
    meta: item.meta,
    transcriptText,
    transcriptSource,
    sequenceIndex: index + 1,
    previousVideo: videos.at(-1) ?? null,
    subtitlePath,
    transcriptPath: existsSync(transcriptPath) ? transcriptPath : null,
    metaPath: item.metaPath,
    visualAnalysis,
    visualAnalysisPath,
  });

  videos.push(built.video);
  commentResults.push({ bvid: item.meta.id, ...commentResult });
  writeFileSync(resolve(item.dir, 'evidence.json'), `${JSON.stringify(built.evidence, null, 2)}\n`);
}

const refinedVideos = refineVideoLocations(videos);
const summary = buildJourneySummary(refinedVideos, playlistId, playlistUrl);
writeFileSync(resolve(publicDataDir, 'videos.json'), `${JSON.stringify(refinedVideos, null, 2)}\n`);
writeFileSync(resolve(publicDataDir, 'journey.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Rebuilt ${refinedVideos.length} videos from raw artifacts.`);

// 数据质量报告
const subtitledCount = videos.filter((v) => v.transcriptSource === 'official_subtitle').length;
const asrCount = videos.filter((v) => v.transcriptSource === 'asr').length;
const withCoords = videos.filter((v) => v.location.lat !== null && v.location.lng !== null).length;
const lowConfLoc = videos.filter((v) => v.location.confidence === 'low').length;
const unknownCatch = videos.filter((v) => v.fishing.caught === 'unknown').length;
const unknownSkunk = videos.filter((v) => v.fishing.isSkunked === 'unknown').length;
// 评论统计
const commentSuccess = commentResults.filter((r) => r.success).length;

console.log('\n=== 数据质量报告 ===');
console.log(`视频总数: ${refinedVideos.length}`);
console.log(`字幕数: ${subtitledCount}`);
console.log(`ASR 数: ${asrCount}`);
console.log(`有坐标视频数: ${withCoords}`);
console.log(`低置信地点数: ${lowConfLoc}`);
console.log(`unknown 鱼获数: ${unknownCatch}`);
console.log(`unknown 空军数: ${unknownSkunk}`);
console.log(`评论抓取成功数: ${commentSuccess}`);

function findFirstExisting(paths) {
  return paths.find((path) => path && existsSync(path)) ?? null;
}

function parseBlockStartSec(timestampLine) {
  const match = timestampLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) return 0;
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  );
}
