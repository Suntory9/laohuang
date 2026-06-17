import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe';
const tesseractPath = process.env.TESSERACT_PATH ?? 'tesseract';

const desiredFrameCount = 6;

export function loadVisualAnalysis(videoDir) {
  const visualPath = resolve(videoDir, 'visual-evidence.json');
  if (!existsSync(visualPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(visualPath, 'utf8'));
  } catch {
    return null;
  }
}

export function publishVisualFrames({ videoDir, bvid, visualAnalysis, publicFramesDir }) {
  if (!visualAnalysis?.frames?.length) {
    return visualAnalysis;
  }

  const targetDir = resolve(publicFramesDir, bvid);
  mkdirSync(targetDir, { recursive: true });

  return {
    ...visualAnalysis,
    frames: visualAnalysis.frames.map((frame) => {
      if (!frame.imagePath || !existsSync(frame.imagePath)) {
        return { ...frame, imageUrl: null };
      }

      const filename = basename(frame.imagePath);
      const publicFile = resolve(targetDir, filename);
      copyFileSync(frame.imagePath, publicFile);
      return {
        ...frame,
        imageUrl: `/frames/${bvid}/${filename}`,
      };
    }),
  };
}

export function analyzeVideoVisuals({
  meta,
  videoDir,
  transcriptText,
  subtitleBlocks,
  forceRefresh = false,
}) {
  const visualPath = resolve(videoDir, 'visual-evidence.json');
  if (!forceRefresh) {
    const cached = loadVisualAnalysis(videoDir);
    if (cached) {
      return cached;
    }
  }

  if (!isToolAvailable(ffmpegPath)) {
    return null;
  }

  const previewPath = resolve(videoDir, 'preview.mp4');
  const framesDir = resolve(videoDir, 'frames');
  mkdirSync(framesDir, { recursive: true });

  try {
    if (forceRefresh && existsSync(framesDir)) {
      rmSync(framesDir, { recursive: true, force: true });
      mkdirSync(framesDir, { recursive: true });
    }

    if (!existsSync(previewPath) || forceRefresh) {
      downloadPreviewFromMeta(meta, previewPath);
    }

    if (!existsSync(previewPath)) {
      return null;
    }

    const durationSec = Math.max(1, Number(meta.duration ?? probeDuration(previewPath) ?? 0));
    const timestamps = collectFrameTimestamps(previewPath, durationSec);
    const frames = timestamps
      .map((timestampSec, index) =>
        extractFrameEvidence({
          previewPath,
          framesDir,
          timestampSec,
          frameIndex: index,
          subtitleBlocks,
          transcriptText,
        }),
      )
      .filter(Boolean);

    if (frames.length === 0) {
      return null;
    }

    const signals = buildSignals(frames, transcriptText, meta.title);
    const summary = summarizeFrames(frames, signals, transcriptText, meta.title);
    const visualAnalysis = {
      summary,
      frames,
      signals,
      confidence: inferConfidence(frames, signals),
    };

    writeFileSync(visualPath, `${JSON.stringify(visualAnalysis, null, 2)}\n`);
    return visualAnalysis;
  } catch {
    return null;
  }
}

function downloadPreviewFromMeta(meta, previewPath) {
  const preferredFormat = pickPreviewFormat(meta);
  if (!preferredFormat?.url) {
    return;
  }

  const headers = buildHeaderBlob(preferredFormat.http_headers ?? meta.http_headers ?? {});
  const args = [
    '-y',
    '-loglevel',
    'error',
  ];

  if (headers) {
    args.push('-headers', headers);
  }

  args.push(
    '-i',
    preferredFormat.url,
    '-vf',
    'scale=min(960,iw):-2',
    '-an',
    '-pix_fmt',
    'yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '31',
    previewPath,
  );

  try {
    execFileSync(ffmpegPath, args, { stdio: 'pipe' });
  } catch {
    if (meta.webpage_url) {
      execFileSync(
        'yt-dlp',
        [
          '--cookies-from-browser',
          'chrome',
          '-f',
          'worstvideo[ext=mp4]/worstvideo/worst[ext=mp4]/worst',
          '--no-playlist',
          '-o',
          previewPath,
          meta.webpage_url,
        ],
        { stdio: 'pipe' },
      );
    }
  }
}

function pickPreviewFormat(meta) {
  const formats = Array.isArray(meta.formats) ? meta.formats : [];
  const videoFormats = formats
    .filter((format) => format?.url && format.vcodec && format.vcodec !== 'none' && format.ext === 'mp4')
    .sort((left, right) => (left.width ?? 9999) - (right.width ?? 9999) || (left.tbr ?? 9999) - (right.tbr ?? 9999));

  return videoFormats[0] ?? null;
}

function buildHeaderBlob(headers) {
  const entries = Object.entries(headers).filter(([, value]) => typeof value === 'string' && value.length > 0);
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key}: ${value}\r\n`).join('');
}

function probeDuration(previewPath) {
  try {
    return Number(
      execFileSync(
        ffprobePath,
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          previewPath,
        ],
        { encoding: 'utf8' },
      ).trim(),
    );
  } catch {
    return null;
  }
}

function collectFrameTimestamps(previewPath, durationSec) {
  const evenTimestamps = Array.from({ length: desiredFrameCount }, (_, index) => {
    const progress = (index + 1) / (desiredFrameCount + 1);
    return clampTimestamp(durationSec * progress, durationSec);
  });
  const sceneTimestamps = detectSceneChanges(previewPath, durationSec).slice(0, 4);
  const merged = [...evenTimestamps, ...sceneTimestamps]
    .sort((left, right) => left - right)
    .filter((value, index, list) => index === 0 || Math.abs(value - list[index - 1]) > 18);

  return merged.slice(0, desiredFrameCount);
}

function detectSceneChanges(previewPath, durationSec) {
  try {
    const stderr = execFileSync(
      ffmpegPath,
      [
        '-i',
        previewPath,
        '-filter:v',
        "select='gt(scene,0.24)',showinfo",
        '-frames:v',
        '12',
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return parseSceneTimestamps(stderr, durationSec);
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr : error?.stderr?.toString?.() ?? '';
    return parseSceneTimestamps(stderr, durationSec);
  }
}

function parseSceneTimestamps(output, durationSec) {
  const timestamps = [];
  const regex = /pts_time:([0-9.]+)/g;
  for (const match of output.matchAll(regex)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    timestamps.push(clampTimestamp(value, durationSec));
  }
  return timestamps;
}

function extractFrameEvidence({
  previewPath,
  framesDir,
  timestampSec,
  frameIndex,
  subtitleBlocks,
  transcriptText,
}) {
  const framePath = resolve(framesDir, `frame-${String(frameIndex + 1).padStart(2, '0')}.jpg`);
  if (!existsSync(framePath)) {
    execFileSync(
      ffmpegPath,
      [
        '-y',
        '-loglevel',
        'error',
        '-ss',
        `${timestampSec}`,
        '-i',
        previewPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        framePath,
      ],
      { stdio: 'pipe' },
    );
  }

  if (!existsSync(framePath)) {
    return null;
  }

  const ocrText = runOcr(framePath);
  const transcriptWindow = subtitleBlocks?.length
    ? transcriptWindowAround(subtitleBlocks, timestampSec)
    : transcriptText.slice(0, 120);
  const sceneTags = inferSceneTags({
    ocrText,
    transcriptWindow,
    timestampSec,
  });

  return {
    imagePath: framePath,
    imageUrl: null,
    timestampSec,
    timestampText: formatTimestamp(timestampSec),
    ocrText,
    sceneTags,
    transcriptWindow,
  };
}

function runOcr(framePath) {
  if (!isToolAvailable(tesseractPath)) {
    return '';
  }

  const lang = detectTesseractLanguages();
  try {
    const output = execFileSync(
      tesseractPath,
      [framePath, 'stdout', '-l', lang, '--psm', '6'],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    return output.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

let cachedTesseractLang = null;
function detectTesseractLanguages() {
  if (cachedTesseractLang) return cachedTesseractLang;
  try {
    const output = execFileSync(tesseractPath, ['--list-langs'], { encoding: 'utf8', stdio: 'pipe' });
    const langs = output.split('\n').map((line) => line.trim()).filter(Boolean);
    const preferred = ['chi_sim', 'eng'].filter((lang) => langs.includes(lang));
    cachedTesseractLang = preferred.length > 0 ? preferred.join('+') : 'eng';
    return cachedTesseractLang;
  } catch {
    cachedTesseractLang = 'eng';
    return cachedTesseractLang;
  }
}

function transcriptWindowAround(subtitleBlocks, timestampSec) {
  const nearby = subtitleBlocks
    .filter((block) => Math.abs(block.startSec - timestampSec) <= 40)
    .slice(0, 4)
    .map((block) => block.text)
    .join(' ');
  return nearby || null;
}

function inferSceneTags({ ocrText, transcriptWindow, timestampSec }) {
  const sourceText = `${ocrText} ${transcriptWindow ?? ''}`;
  const tags = new Set();

  if (/(露营|帐篷|废弃房|住在这里|扎营|过夜|凉亭|房子住)/.test(sourceText)) tags.add('搭营');
  if (/(牛皮菜|胡豆|黄豆|煮饭|开饭|做饭|炒菜|烧|锅|晚餐)/.test(sourceText)) tags.add('做饭');
  if (/(钓鱼|鱼口|上鱼|中鱼|鲫鱼|鲤鱼|鱼获|收竿)/.test(sourceText)) tags.add('钓点');
  if (/(鱼|鲫鱼|鲤鱼|翘嘴|斤鲫)/.test(sourceText) && /(钓到|上鱼|鱼获|搞到)/.test(sourceText)) tags.add('鱼获展示');
  if (/(市场|超市|元|块|价格|集贸|蔬菜|牛肉|排骨)/.test(sourceText)) tags.add('买菜');
  if (/(下雨|雨|风大|刮风|积水|雨停)/.test(sourceText)) tags.add('天气场景');
  if (/(收费站|服务区|出口|国道|高速|省道|镇|县|市|村)/.test(ocrText)) tags.add('道路标识');
  if (timestampSec < 120) tags.add('前段');
  if (timestampSec > 720) tags.add('后段');

  return [...tags];
}

function buildSignals(frames, transcriptText, title) {
  const fullOcr = frames.map((frame) => frame.ocrText).join(' ');
  const allTags = frames.flatMap((frame) => frame.sceneTags);
  const ocrMentions = [...new Set(
    fullOcr
      .split(/[^\p{Script=Han}A-Za-z0-9]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  )].slice(0, 24);

  const sourceText = `${title} ${transcriptText} ${fullOcr}`;
  return {
    hasCampScene: allTags.includes('搭营') || /(露营|废弃房|凉亭|住在这里)/.test(sourceText),
    hasCookingScene: allTags.includes('做饭') || /(做饭|开饭|牛皮菜|胡豆|黄豆)/.test(sourceText),
    hasFishCloseup: allTags.includes('鱼获展示') || /(鲫鱼|鲤鱼|上鱼|鱼获)/.test(sourceText),
    hasRoadSignText: allTags.includes('道路标识'),
    hasRainGearOrWetGround: allTags.includes('天气场景') || /(下雨|雨天|暴雨|刮风)/.test(sourceText),
    hasShoppingScene: allTags.includes('买菜') || /(市场|买菜|蔬菜|牛肉|排骨)/.test(sourceText),
    ocrMentions,
  };
}

function summarizeFrames(frames, signals, transcriptText, title) {
  const parts = [];
  if (signals.hasCampScene) parts.push('画面里能看到露营或临时落脚场景');
  if (signals.hasCookingScene) parts.push('关键帧出现做饭或食材处理环节');
  if (signals.hasFishCloseup) parts.push('后段画面包含鱼获或钓点相关展示');
  if (signals.hasShoppingScene) parts.push('中间段出现市场或买菜线索');
  if (signals.hasRoadSignText) parts.push('有路牌或地名文字可辅助定位');
  if (signals.hasRainGearOrWetGround) parts.push('画面和文本都指向雨天或湿地环境');

  const tagDigest = frames
    .flatMap((frame) => frame.sceneTags)
    .filter((tag, index, list) => list.indexOf(tag) === index && !['前段', '后段'].includes(tag))
    .slice(0, 4)
    .join('、');

  if (parts.length === 0 && tagDigest) {
    parts.push(`关键帧主要覆盖 ${tagDigest} 这些内容段落`);
  }

  if (parts.length === 0) {
    parts.push(`关键帧为《${title}》补充了字幕之外的画面上下文`);
  }

  const ocrLead = frames.map((frame) => frame.ocrText).find(Boolean);
  if (ocrLead) {
    parts.push(`OCR 识别到的代表性文字包括「${ocrLead.slice(0, 28)}」`);
  } else if (transcriptText) {
    parts.push(`可结合字幕线索理解这些画面片段`);
  }

  return parts.join('；');
}

function inferConfidence(frames, signals) {
  const ocrFrameCount = frames.filter((frame) => frame.ocrText.length >= 4).length;
  const strongSignalCount = [
    signals.hasCampScene,
    signals.hasCookingScene,
    signals.hasFishCloseup,
    signals.hasRoadSignText,
    signals.hasRainGearOrWetGround,
    signals.hasShoppingScene,
  ].filter(Boolean).length;

  if (ocrFrameCount >= 2 || strongSignalCount >= 3) return 'medium';
  if (frames.length >= 3) return 'low';
  return 'unknown';
}

function clampTimestamp(value, durationSec) {
  return Math.max(1, Math.min(durationSec - 1, Number(value.toFixed(1))));
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const hour = Math.floor(total / 3600);
  const minute = Math.floor((total % 3600) / 60);
  const second = total % 60;

  if (hour > 0) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  }
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function isToolAvailable(command) {
  try {
    execFileSync('which', [command], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
