/**
 * 统一证据打分逻辑。
 * 所有来源的 EvidenceItem 通过此模块计算加权分数和置信度等级。
 */

/** 证据来源基础权重 */
const SOURCE_WEIGHTS = {
  meta: 100,
  subtitle: 80,
  asr: 60,
  frame_ocr: 70,
  frame_visual: 50,
  comment: 40,
  'sequence-inference': 30,
  manual_override: 1000,
};

/**
 * 为一组 EvidenceItem 计算加权总分。
 * @param {Array<{source: string, weight?: number}>} evidenceList
 * @returns {number}
 */
export function scoreEvidence(evidenceList) {
  let total = 0;
  for (const item of evidenceList) {
    const base = SOURCE_WEIGHTS[item.source] ?? 20;
    const weight = item.weight ?? 1;
    total += base * weight;
  }
  return total;
}

/**
 * 文本中出现频次归一化（0-1）。
 * @param {number} occurrences
 * @param {number} maxOccurrences
 * @returns {number}
 */
export function frequencyBoost(occurrences, maxOccurrences = 5) {
  return Math.min(occurrences / maxOccurrences, 1);
}

/**
 * 评论多人重复加权。
 * @param {number} uniqueUsers
 * @returns {number}
 */
export function commentConsensusBoost(uniqueUsers) {
  if (uniqueUsers >= 5) return 1.5;
  if (uniqueUsers >= 3) return 1.2;
  if (uniqueUsers >= 2) return 1.0;
  return 0.5;
}

/**
 * 计算置信度等级。
 * @param {number} score
 * @returns {'high' | 'medium' | 'low' | 'unknown'}
 */
export function scoreToConfidence(score) {
  if (score >= 200) return 'high';
  if (score >= 100) return 'medium';
  if (score >= 30) return 'low';
  return 'unknown';
}
