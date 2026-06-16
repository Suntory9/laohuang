/**
 * 评论信号提取器。
 * 从 B站评论中识别地名、鱼种、路线提及和纠错表达，计算可信度。
 */

const locationCues = /(这里是|这个地方叫|本地人|就在|坐标是|这是|位置在|属于|小镇叫|村叫|镇叫|县城|市区|市里)/;
const fishCues = /(鲫鱼|鲤鱼|草鱼|鲢鳙|白条|翘嘴|黄颡鱼|鲶鱼|马口|鳊鱼|鳜鱼|黑鱼|罗非|黄辣丁|鳑鲏|麦穗|鳡鱼|青鱼|鳊|鲮|鲻|鲈|鳟)/;
const routeCues = /(从.*到|上一期|下一期|应该是.*附近|大概在|估计在|看起来像|好像是)/;
const correctionCues = /(不是|这不是|纠正|错了|明明|怎么可能|搞错了|认错了|其实不是)/;

/**
 * 从评论列表中提取信号。
 * @param {Array<{rpid: string, author: string, text: string, likes: number, time: string}>} comments
 * @returns {Array<{source: 'comment', rpid: string, userName: string, likeCount: number, text: string, publishedAt: string, signals: object, credibility: string}>}
 */
export function extractCommentEvidence(comments) {
  if (!Array.isArray(comments)) return [];

  return comments.map((comment) => {
    const text = comment.text ?? '';
    const signals = {
      locationMentions: extractLocationMentions(text),
      fishMentions: extractFishMentions(text),
      routeMentions: extractRouteMentions(text),
      correctionMentions: extractCorrectionMentions(text),
    };
    const credibility = scoreCredibility(comment, signals);
    return {
      source: 'comment',
      rpid: comment.rpid,
      userName: comment.author,
      likeCount: comment.likes ?? 0,
      text,
      publishedAt: comment.time ?? '',
      signals,
      credibility,
    };
  }).filter((ev) => {
    // 过滤掉没有任何信号的评论
    const s = ev.signals;
    return s.locationMentions.length > 0 ||
      s.fishMentions.length > 0 ||
      s.routeMentions.length > 0 ||
      s.correctionMentions.length > 0;
  });
}

function extractLocationMentions(text) {
  if (!locationCues.test(text)) return [];
  const matches = text.match(/(?:是|在|到|叫|属于)([一-鿿]{2,6}(?:市|县|区|镇|乡|村|段|河|江|湖|库|桥|湾|沟|口|坪|岭|岗|坡|坝))/g);
  return matches ? [...new Set(matches.map((m) => m.replace(/^(?:是|在|到|叫|属于)/, '')))] : [];
}

function extractFishMentions(text) {
  const speciesMatches = text.match(new RegExp(fishCues.source, 'g'));
  if (!speciesMatches) return [];
  const countMatch = text.match(/(\d+)\s*(条|尾|斤|两)/);
  if (countMatch) {
    return [`${speciesMatches[0]} ${countMatch[0]}`];
  }
  return [...new Set(speciesMatches)];
}

function extractRouteMentions(text) {
  return routeCues.test(text) ? [text.slice(0, 80)] : [];
}

function extractCorrectionMentions(text) {
  return correctionCues.test(text) ? [text.slice(0, 80)] : [];
}

function scoreCredibility(comment, signals) {
  let score = 0;
  const likes = comment.likes ?? 0;

  // 点赞数加权
  if (likes >= 100) score += 3;
  else if (likes >= 10) score += 2;
  else if (likes >= 1) score += 1;

  // 本地人表达加权
  if (/本地人|我是.*人|我家|我们这/.test(comment.text)) score += 2;

  // 有实质信号
  if (signals.locationMentions.length > 0) score += 1;
  if (signals.correctionMentions.length > 0 && signals.locationMentions.length > 0) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * 从 CommentEvidence 列表中聚合所有地名提及。
 * @param {Array<{userName: string, likeCount: number, signals: {locationMentions: string[]}}>} evidenceList
 * @returns {Map<string, {count: number, users: string[], totalLikes: number}>}
 */
export function aggregateCommentLocations(evidenceList) {
  const map = new Map();
  for (const ev of evidenceList) {
    for (const mention of ev.signals.locationMentions) {
      const entry = map.get(mention) ?? { count: 0, users: [], totalLikes: 0 };
      entry.count += 1;
      if (!entry.users.includes(ev.userName)) entry.users.push(ev.userName);
      entry.totalLikes += ev.likeCount;
      map.set(mention, entry);
    }
  }
  return map;
}
