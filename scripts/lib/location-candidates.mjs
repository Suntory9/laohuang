import { locationGazetteer } from './extractors.mjs';
import { scoreEvidence, scoreToConfidence, commentConsensusBoost } from './evidence-scoring.mjs';

/**
 * 从标题+字幕中提取地点候选。
 */
function fromTitleAndTranscript(title, transcript) {
  const sourceText = `${title} ${transcript}`;
  return locationGazetteer
    .map((entry) => {
      const alias = entry.aliases.find((a) => sourceText.includes(a));
      if (!alias) return null;
      return {
        label: entry.label,
        province: entry.province,
        prefecture: entry.prefecture,
        county: entry.county,
        poi: entry.poi,
        lat: entry.lat,
        lng: entry.lng,
        evidence: [{
          source: 'subtitle',
          quote: `在标题或字幕中识别到地名：${alias}`,
          weight: 2,
        }],
      };
    })
    .filter(Boolean);
}

/**
 * 从 OCR 文本中提取地点候选。
 */
function fromOcr(visualAnalysis) {
  const ocrText = (visualAnalysis?.signals?.ocrMentions ?? []).join(' ');
  if (!ocrText) return [];
  return locationGazetteer
    .map((entry) => {
      const alias = entry.aliases.find((a) => ocrText.includes(a));
      if (!alias) return null;
      return {
        label: entry.label,
        province: entry.province,
        prefecture: entry.prefecture,
        county: entry.county,
        poi: entry.poi,
        lat: entry.lat,
        lng: entry.lng,
        evidence: [{
          source: 'frame_ocr',
          quote: `关键帧 OCR 识别到地点词：${alias}`,
          weight: 2,
        }],
      };
    })
    .filter(Boolean);
}

/**
 * 从评论证据中提取地点候选。
 */
function fromComments(commentEvidenceList, aggregatedLocations) {
  if (!aggregatedLocations || aggregatedLocations.size === 0) return [];
  const candidates = [];
  for (const [mention, stats] of aggregatedLocations) {
    const gazMatch = locationGazetteer.find((entry) =>
      entry.aliases.some((a) => mention.includes(a) || a.includes(mention))
    );
    const consensusBoost = commentConsensusBoost(stats.users.length);
    candidates.push({
      label: gazMatch?.label ?? mention,
      province: gazMatch?.province ?? null,
      prefecture: gazMatch?.prefecture ?? null,
      county: gazMatch?.county ?? null,
      poi: gazMatch?.poi ?? null,
      lat: gazMatch?.lat ?? null,
      lng: gazMatch?.lng ?? null,
      evidence: [{
        source: 'comment',
        quote: `${stats.count} 位用户在评论中提到「${mention}」（共 ${stats.totalLikes} 赞）`,
        weight: Math.round(stats.count * consensusBoost),
        ref: stats.users.join(','),
      }],
    });
  }
  return candidates;
}

/**
 * 从前后视频顺序推断候选。
 */
function fromSequence(previousVideo) {
  if (!previousVideo?.location?.prefecture) return [];
  return [{
    label: previousVideo.location.label,
    province: previousVideo.location.province,
    prefecture: previousVideo.location.prefecture,
    county: previousVideo.location.county,
    poi: previousVideo.location.poi,
    lat: previousVideo.location.lat,
    lng: previousVideo.location.lng,
    evidence: [{
      source: 'sequence-inference',
      quote: `前序视频在 ${previousVideo.location.label}，推断当前位置相近`,
      weight: 1,
    }],
  }];
}

/**
 * 合并所有来源的地点候选，去重并打分排序。
 * @returns {Array<{label: string, province: string|null, prefecture: string|null, county: string|null, poi: string|null, lat: number|null, lng: number|null, confidence: string, score: number, evidence: Array}>}
 */
export function buildLocationCandidates({
  title, transcript, visualAnalysis, commentEvidenceList,
  aggregatedCommentLocations, previousVideo,
}) {
  const raw = [
    ...fromTitleAndTranscript(title, transcript),
    ...fromOcr(visualAnalysis),
    ...fromComments(commentEvidenceList ?? [], aggregatedCommentLocations),
    ...fromSequence(previousVideo),
  ];

  // 按 label 去重合并 evidence
  const merged = new Map();
  for (const candidate of raw) {
    const key = candidate.label;
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.evidence.push(...candidate.evidence);
      // 取更精确的坐标
      if (!existing.lat && candidate.lat) {
        existing.lat = candidate.lat;
        existing.lng = candidate.lng;
      }
      // 取更精确的行政层级
      if (!existing.county && candidate.county) existing.county = candidate.county;
      if (!existing.poi && candidate.poi) existing.poi = candidate.poi;
    } else {
      merged.set(key, { ...candidate });
    }
  }

  // 计算分数和置信度
  return [...merged.values()]
    .map((c) => {
      const score = scoreEvidence(c.evidence);
      return {
        ...c,
        score,
        confidence: scoreToConfidence(score),
      };
    })
    .sort((a, b) => b.score - a.score);
}
