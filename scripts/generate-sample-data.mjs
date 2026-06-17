import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSrtText } from './lib/extractors.mjs';
import { buildJourneySummary } from './lib/aggregate.mjs';
import { buildVideoRecord } from './lib/build-record.mjs';

const root = resolve(import.meta.dirname, '..');
const subtitlePath = resolve(root, 'output/subtitles/BV18JDmBkE1D.ai-zh.srt');
const fallbackTranscriptPath = resolve(root, 'output/transcripts/bv18jdm-bke1d.txt');
const publicDataDir = resolve(root, 'public/data');

mkdirSync(publicDataDir, { recursive: true });

const officialSubtitle = readFileSync(subtitlePath, 'utf8');
const transcriptBlocks = parseSrtText(officialSubtitle);
const transcript = transcriptBlocks.map((block) => block.text).join(' ');
const fallbackTranscript = readFileSync(fallbackTranscriptPath, 'utf8');

const title = '刮风下雨躲进废弃房，一锅牛皮菜烧胡豆，又吃美了';
const baseVideo = {
  bvid: 'BV18JDmBkE1D',
  title,
  publishedAt: '2026-04-12T11:30:00.000Z',
  durationSec: 1041,
  coverUrl: 'http://i1.hdslb.com/bfs/archive/d230e0b1aa0681de52a26459ec2a8531c085a40b.jpg',
  bilibiliUrl: 'https://www.bilibili.com/video/BV18JDmBkE1D/',
};

const videoOne = buildVideoRecord({
  meta: {
    id: baseVideo.bvid,
    title: baseVideo.title,
    upload_date: '20260412',
    duration: baseVideo.durationSec,
    thumbnail: baseVideo.coverUrl,
    webpage_url: baseVideo.bilibiliUrl,
  },
  transcriptText: transcript,
  transcriptSource: 'official_subtitle',
  sequenceIndex: 245,
  previousVideo: null,
  subtitlePath,
  transcriptPath: fallbackTranscriptPath,
  metaPath: 'sample:meta',
}).video;

const videoTwo = {
  ...videoOne,
  bvid: 'BV1demo000002',
  title: '沿着汉江运河继续骑，下午风雨里找钓位，晚上简单烧个猪肉牛皮菜',
  publishedAt: '2026-04-13T11:30:00.000Z',
  sequenceIndex: 246,
  bilibiliUrl: 'https://www.bilibili.com/video/BV1demo000002/',
  location: {
    ...videoOne.location,
    label: '荆州 · 汉江运河边',
    poi: '汉江运河',
    evidence: [{ source: 'title', quote: '沿着汉江运河继续骑' }],
  },
  route: {
    fromLabel: videoOne.location.label,
    toLabel: '荆州 · 汉江运河边',
    distanceKm: 18.5,
    polyline: [
      [112.2397, 30.3352],
      [112.262, 30.351],
    ],
    method: 'inferred-sequential',
  },
  weather: {
    summary: '视频中明确提到刮风、下雨，结合相邻视频推断仍是阴雨天气。',
    conditionTags: ['下雨', '刮风'],
    temperatureMin: null,
    temperatureMax: null,
    windLevel: '风大',
    precipitationHint: '有降雨',
    confidence: 'medium',
    evidence: [{ source: 'title', quote: '下午风雨里找钓位' }],
  },
  timeSpan: {
    startTimeText: '下午三点',
    endTimeText: '晚上十点',
    durationHintText: '视频覆盖下午找位到夜间做饭收工',
    keyMoments: [
      { label: '找钓位', timeText: '下午三点' },
      { label: '做饭', timeText: '晚上七点' },
      { label: '收工', timeText: '晚上十点' },
    ],
    inferredDayPartTags: ['下午', '晚上'],
    confidence: 'medium',
    evidence: [{ source: 'title', quote: '下午风雨里找钓位，晚上简单烧个猪肉牛皮菜' }],
  },
  dinner: {
    summary: '晚餐是猪肉配牛皮菜，仍然是户外简炊。',
    foods: ['猪肉', '牛皮菜'],
    cookingMethod: '烧煮',
    evidence: [{ source: 'title', quote: '晚上简单烧个猪肉牛皮菜' }],
  },
  shopping: {
    hasShopping: true,
    items: ['猪肉', '青菜'],
    totalCostText: '合计约 18.00 元',
    totalCostCny: 18,
    costBreakdown: [
      { item: '猪肉', costText: '12元', costCny: 12 },
      { item: '青菜', costText: '6元', costCny: 6 },
    ],
    evidence: [{ source: 'inference', quote: '样例数据：演示买菜花费展示字段' }],
  },
  fishingTheory: {
    summary: '强调风雨天找避风位、沿河边找缓流位置更稳。',
    tags: ['钓位', '天气水情'],
    techniques: ['钓位'],
    conditions: ['天气水情'],
    evidence: [{ source: 'inference', quote: '样例数据：演示理论标签展示字段' }],
  },
  fishing: {
    caught: 'no',
    isSkunked: 'yes',
    species: [],
    weightText: null,
    countText: null,
    evidence: [{ source: 'inference', quote: '样例数据：演示空军筛选' }],
  },
  transcriptExcerpt: '下午沿着汉江运河继续骑，风很大，先找个背风的位置避雨，晚上再简单做饭。',
  rawEvidenceRefs: ['demo:synthetic'],
};

const videos = [videoOne, videoTwo];
const summary = buildJourneySummary(
  videos,
  '1173628599_6193999',
  'https://space.bilibili.com/1173628599/lists/6193999?type=season',
);

writeFileSync(resolve(publicDataDir, 'videos.json'), `${JSON.stringify(videos, null, 2)}\n`);
writeFileSync(resolve(publicDataDir, 'journey.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Generated sample data for ${videos.length} videos.`);
console.log(`Transcript fallback length: ${fallbackTranscript.length}`);
