import { buildLocationCandidates } from './location-candidates.mjs';

/**
 * 组装 VideoIntel 中间结果。
 * 合并所有来源的候选 → 打分排序 → 冲突检测 → 产出 intel.json。
 *
 * @returns {{
 *   bvid: string,
 *   title: string,
 *   sequenceIndex: number,
 *   candidates: { locations: Array, catches: Array, routeSegments: Array, weather: Array, storyEvents: Array },
 *   conflicts: Array,
 *   final: import('../../src/types').VideoRecord
 * }}
 */
export function buildVideoIntel({
  meta, transcriptText, transcriptSource, sequenceIndex,
  previousVideo, visualAnalysis, commentEvidenceList,
  aggregatedCommentLocations,
  inferredLocation, inferredWeather, inferredFishing,
  inferredRoute, inferredDinner, inferredShopping,
  inferredFishingTheory, inferredTimeSpan,
}) {
  const locationCandidates = buildLocationCandidates({
    title: meta.title,
    transcript: transcriptText ?? '',
    visualAnalysis,
    commentEvidenceList: commentEvidenceList ?? [],
    aggregatedCommentLocations,
    previousVideo,
  });

  // 如果没有候选，回退到原始推断结果
  if (locationCandidates.length === 0 && inferredLocation.label !== '未在视频中明确提及') {
    locationCandidates.push({
      label: inferredLocation.label,
      province: inferredLocation.province,
      prefecture: inferredLocation.prefecture,
      county: inferredLocation.county,
      poi: inferredLocation.poi,
      lat: inferredLocation.lat,
      lng: inferredLocation.lng,
      confidence: inferredLocation.confidence,
      score: 20,
      evidence: inferredLocation.evidence,
    });
  }

  // 检测评论与规则推断的冲突
  const conflicts = buildConflicts(locationCandidates, inferredLocation, commentEvidenceList ?? []);

  // 最终地点 = 最高分候选
  const best = locationCandidates[0];
  const finalLocation = best
    ? {
        ...inferredLocation,
        label: best.label,
        province: best.province,
        prefecture: best.prefecture,
        county: best.county,
        poi: best.poi,
        lat: best.lat,
        lng: best.lng,
        confidence: best.confidence,
        evidence: best.evidence,
      }
    : inferredLocation;

  // 构建故事事件
  const storyEvents = buildStoryEvents({
    title: meta.title, transcript: transcriptText ?? '',
    weather: inferredWeather, fishing: inferredFishing,
    location: finalLocation,
  });

  const final = {
    bvid: meta.id,
    title: meta.title,
    publishedAt: toIsoDate(meta.upload_date),
    durationSec: Math.round(meta.duration ?? 0),
    coverUrl: meta.thumbnail,
    bilibiliUrl: meta.webpage_url,
    sequenceIndex,
    transcriptSource,
    location: finalLocation,
    weather: inferredWeather,
    route: inferredRoute,
    timeSpan: inferredTimeSpan,
    dinner: inferredDinner,
    shopping: inferredShopping,
    fishingTheory: inferredFishingTheory,
    fishing: inferredFishing,
    visualAnalysis: visualAnalysis ?? null,
    transcriptExcerpt: (transcriptText ?? '').replace(/\s+/g, ' ').trim().slice(0, 180),
    rawEvidenceRefs: [],
  };

  return {
    bvid: meta.id,
    title: meta.title,
    sequenceIndex,
    candidates: {
      locations: locationCandidates,
      catches: [],
      routeSegments: [],
      weather: [],
      storyEvents,
    },
    conflicts,
    final,
  };
}

function buildConflicts(locationCandidates, originalLocation, commentEvidenceList) {
  const conflicts = [];
  const correctionComments = commentEvidenceList.filter(
    (c) => c.signals.correctionMentions.length > 0 && c.credibility !== 'low'
  );
  if (correctionComments.length > 0 && locationCandidates.length > 0) {
    const topCandidate = locationCandidates[0];
    const commentSource = topCandidate.evidence.find((e) => e.source === 'comment');
    const ruleSource = topCandidate.evidence.find(
      (e) => e.source === 'subtitle' || e.source === 'frame_ocr'
    );
    if (commentSource && ruleSource && ruleSource.quote !== commentSource.quote) {
      conflicts.push({
        field: 'location',
        candidates: [
          { value: `规则推断: ${originalLocation.label}`, source: 'subtitle', quote: ruleSource.quote },
          { value: `评论认为: ${topCandidate.label}`, source: 'comment', quote: commentSource.quote },
        ],
        resolution: correctionComments.length >= 3 ? '多数评论支持相同纠正，采纳评论位置' : null,
      });
    }
  }
  return conflicts;
}

function buildStoryEvents({ title, transcript, weather, fishing, location }) {
  const events = [];
  const text = `${title} ${transcript}`;

  if (/到达|来到|终于到了/.test(text)) {
    const match = text.match(/(?:到达|来到|终于到了)[^，。]*/);
    events.push({
      label: `到达 ${location.label}`,
      timeText: null,
      evidence: [{ source: 'subtitle', quote: match?.[0] ?? `到达 ${location.label}` }],
    });
  }

  if (fishing.caught === 'yes') {
    events.push({
      label: `中鱼${fishing.species.length > 0 ? '：' + fishing.species.join('、') : ''}`,
      timeText: null,
      evidence: fishing.evidence.slice(0, 2),
    });
  }

  if (fishing.isSkunked === 'yes') {
    events.push({
      label: '空军',
      timeText: null,
      evidence: fishing.evidence.slice(0, 1),
    });
  }

  if (weather.conditionTags.includes('下雨') || weather.conditionTags.includes('强降雨')) {
    events.push({
      label: '冒雨前行',
      timeText: null,
      evidence: [{ source: 'subtitle', quote: weather.summary }],
    });
  }

  return events;
}

function toIsoDate(uploadDate) {
  if (!uploadDate || uploadDate.length !== 8) return new Date().toISOString();
  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}T12:00:00.000Z`;
}
