import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  parseLooseSrt,
} from './lib/extractors.mjs';
import { buildJourneySummary } from './lib/aggregate.mjs';
import { buildVideoRecord } from './lib/build-record.mjs';
import { refineVideoLocations } from './lib/refine-videos.mjs';
import { analyzeVideoVisuals, publishVisualFrames } from './lib/visual-analysis.mjs';
import { fetchComments } from './fetch-comments.mjs';
import { extractCommentEvidence, aggregateCommentLocations } from './lib/comment-extractors.mjs';
import { buildVideoIntel } from './lib/intel-builder.mjs';

const root = resolve(import.meta.dirname, '..');
const playlistUrl =
  process.env.BILI_PLAYLIST_URL ?? 'https://space.bilibili.com/1173628599/lists/6193999?type=season';
const playlistId = '1173628599_6193999';
const outputDir = resolve(root, 'generated');
const rawDir = resolve(root, 'raw/videos');
const publicDataDir = resolve(root, 'public/data');
const publicFramesDir = resolve(root, 'public/frames');
const sampleLimit = Number(process.env.BILI_SAMPLE_LIMIT ?? '5');
const whisperCli = process.env.WHISPER_CLI_PATH ?? '/opt/homebrew/bin/whisper-cli';
const whisperModel = process.env.WHISPER_MODEL_PATH ?? resolve(root, 'tmp/models/ggml-base.bin');
const downloadAudio = process.env.BILI_DOWNLOAD_AUDIO !== '0';
const forceRefresh = process.env.BILI_FORCE_REFRESH === '1';

mkdirSync(outputDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });
mkdirSync(publicDataDir, { recursive: true });
mkdirSync(publicFramesDir, { recursive: true });

const playlist = JSON.parse(
  execFileSync('yt-dlp', ['--flat-playlist', '--dump-single-json', '--cookies-from-browser', 'chrome', playlistUrl], {
    encoding: 'utf8',
  }),
);

const selectedEntries = [...playlist.entries].slice(-sampleLimit);
const videos = [];
const commentResults = [];

for (const [index, entry] of selectedEntries.entries()) {
  const rawVideoDir = resolve(rawDir, entry.id);
  mkdirSync(rawVideoDir, { recursive: true });
  const metaPath = resolve(rawVideoDir, 'meta.json');
  const meta =
    existsSync(metaPath) && !forceRefresh
      ? JSON.parse(readFileSync(metaPath, 'utf8'))
      : JSON.parse(
          execFileSync('yt-dlp', ['--dump-json', '--cookies-from-browser', 'chrome', entry.url], {
            encoding: 'utf8',
          }),
        );
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  const subtitleTarget = resolve(rawVideoDir, `${meta.id}.ai-zh.srt`);
  const transcriptTarget = resolve(rawVideoDir, 'transcript.txt');
  const evidenceTarget = resolve(rawVideoDir, 'evidence.json');
  const audioTargetTemplate = resolve(rawVideoDir, `${meta.id}.%(ext)s`);
  let transcriptText = '';
  let transcriptSource = 'official_subtitle';
  let subtitlePath = existsSync(subtitleTarget) ? subtitleTarget : null;
  let transcriptPath = existsSync(transcriptTarget) ? transcriptTarget : null;
  let subtitleBlocks = [];

  try {
    if (!subtitlePath || forceRefresh) {
      execFileSync(
        'yt-dlp',
        [
          '--cookies-from-browser',
          'chrome',
          '--write-subs',
          '--sub-langs',
          'ai-zh',
          '--skip-download',
          '-o',
          resolve(rawVideoDir, '%(id)s.%(ext)s'),
          entry.url,
        ],
        { stdio: 'pipe' },
      );
      if (existsSync(subtitleTarget)) {
        subtitlePath = subtitleTarget;
      }
    }
    if (!subtitlePath) {
      throw new Error('subtitle-missing');
    }
    subtitleBlocks = parseLooseSrt(subtitlePath).map((block) => ({
      ...block,
      startSec: parseBlockStartSec(block.timestamp),
    }));
    transcriptText = subtitleBlocks.map((block) => block.text).join(' ');
  } catch {
    transcriptSource = 'asr';
    if (!transcriptPath || forceRefresh) {
      transcriptText = runAsrFallback({
        entryUrl: entry.url,
        audioTargetTemplate,
        transcriptTarget,
      });
      transcriptPath = transcriptTarget;
    } else {
      transcriptText = readFileSync(transcriptPath, 'utf8');
    }
  }

  if (transcriptSource === 'official_subtitle') {
    writeFileSync(transcriptTarget, `${transcriptText}\n`);
    transcriptPath = transcriptTarget;
  }

  const rawVisualAnalysis = analyzeVideoVisuals({
    meta,
    videoDir: rawVideoDir,
    transcriptText,
    subtitleBlocks,
    forceRefresh,
  });
  const visualAnalysis = publishVisualFrames({
    videoDir: rawVideoDir,
    bvid: meta.id,
    visualAnalysis: rawVisualAnalysis,
    publicFramesDir,
  });
  const visualAnalysisPath = visualAnalysis ? resolve(rawVideoDir, 'visual-evidence.json') : null;

  // Fetch comments
  const commentResult = fetchComments(entry.id, { limit: 200, forceRefresh });

    // Extract comment evidence
    let commentEvidenceList = [];
    if (commentResult.success && commentResult.count > 0) {
      try {
        const comments = JSON.parse(readFileSync(resolve(rawVideoDir, 'comments.json'), 'utf8'));
        if (Array.isArray(comments)) {
          commentEvidenceList = extractCommentEvidence(comments);
          writeFileSync(
            resolve(rawVideoDir, 'comment-evidence.json'),
            JSON.stringify(commentEvidenceList, null, 2) + '\n',
          );
        }
      } catch (err) {
        console.warn(`  [comment-evidence] ${entry.id}: ${err.message}`);
      }
    }

  const previousVideo = videos.at(-1) ?? null;
  const built = buildVideoRecord({
    meta,
    transcriptText,
    transcriptSource,
    sequenceIndex: index + 1,
    previousVideo,
    subtitlePath,
    transcriptPath,
    metaPath,
    visualAnalysis,
    visualAnalysisPath,
  });

  writeFileSync(
    evidenceTarget,
    `${JSON.stringify(built.evidence, null, 2)}\n`,
  );

  // Assemble VideoIntel
  const aggregatedLocations = aggregateCommentLocations(commentEvidenceList);
  const intel = buildVideoIntel({
    meta,
    transcriptText,
    transcriptSource,
    sequenceIndex: index + 1,
    previousVideo: videos.at(-1) ?? null,
    visualAnalysis,
    commentEvidenceList,
    aggregatedCommentLocations: aggregatedLocations,
    inferredLocation: built.video.location,
    inferredWeather: built.video.weather,
    inferredFishing: built.video.fishing,
    inferredRoute: built.video.route,
    inferredDinner: built.video.dinner,
    inferredShopping: built.video.shopping,
    inferredFishingTheory: built.video.fishingTheory,
    inferredTimeSpan: built.video.timeSpan,
  });

  writeFileSync(
    resolve(rawVideoDir, 'intel.json'),
    JSON.stringify(intel, null, 2) + '\n',
  );

  // Use intel.final instead of built.video
  videos.push(intel.final);
  commentResults.push({ bvid: entry.id, ...commentResult });
}

const refinedVideos = refineVideoLocations(videos);
const summary = buildJourneySummary(refinedVideos, playlistId, playlistUrl);
writeFileSync(resolve(publicDataDir, 'videos.json'), `${JSON.stringify(refinedVideos, null, 2)}\n`);
writeFileSync(resolve(publicDataDir, 'journey.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Generated ${refinedVideos.length} video records.`);

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

function runAsrFallback({ entryUrl, audioTargetTemplate, transcriptTarget }) {
  if (!downloadAudio) {
    return '未抓到官方字幕，且已关闭音频下载回退。';
  }

  execFileSync(
    'yt-dlp',
    ['--cookies-from-browser', 'chrome', '-x', '--audio-format', 'mp3', '-o', audioTargetTemplate, entryUrl],
    { stdio: 'pipe' },
  );

  const audioPath = resolve(audioTargetTemplate.replace('%(ext)s', 'mp3'));
  execFileSync(
    whisperCli,
    ['-ng', '-m', whisperModel, '-l', 'zh', '-f', audioPath, '-otxt', '-of', transcriptTarget.replace(/\.txt$/, '')],
    { stdio: 'pipe' },
  );

  return readFileSync(transcriptTarget, 'utf8');
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
