import { readFileSync } from 'node:fs';

const weatherPatterns = [
  { regex: /(下雨|雨天|有雨|雨还在下)/g, tag: '下雨' },
  { regex: /(暴雨|大雨|雷雨|打雷|闪电)/g, tag: '强降雨' },
  { regex: /(毛毛雨|小雨|绵下去|阴雨绵绵)/g, tag: '弱降雨' },
  { regex: /(刮风|风大|狂风)/g, tag: '刮风' },
  { regex: /(降温|好冷|冷得|温度.*一两度|差点感冒)/g, tag: '降温' },
  { regex: /(晴天|太阳出来|大太阳|蓝天没有白云)/g, tag: '晴天' },
  { regex: /(阴天|大阴天|雾蒙雾蒙|雾气蒙蒙)/g, tag: '阴天' },
];

const theoryKeywords = [
  { regex: /(鱼口|没口|有口|鱼情)/g, tag: '鱼情判断' },
  { regex: /(钓位|位置|边上|深水|浅水|河边|桥下)/g, tag: '钓位' },
  { regex: /(饵料|窝料|打窝|豆瓣酱|红虫|蚯蚓)/g, tag: '饵料' },
  { regex: /(早上|中午|下午|晚上|天亮|夜里)/g, tag: '时段' },
  { regex: /(刮风|下雨|退水|涨水|水位|水情)/g, tag: '天气水情' },
];

const skunkPatterns = /(空军|没口|一条没钓到|没有钓到|没钓到)/;
const caughtPatterns = /(钓到了|钓到鱼|上鱼|搞到鱼|中鱼|中了)/;

const shoppingAmountPattern = /(\d+(?:\.\d+)?)\s*(?:块钱|块|元)/g;

const timePatterns = /(早上\d{1,2}点(?:钟)?|晚上\d{1,2}点(?:钟)?|中午\d{1,2}点(?:钟)?|下午\d{1,2}点(?:钟)?|\d{1,2}点(?:\d{1,2}分)?(?:钟)?|早上|中午|下午|晚上|天亮了)/g;

const dinnerPatterns = /(牛皮菜|胡豆|黄豆|豆瓣酱|辣椒|米饭|猪肉|肥肉|红椒)/g;
const fishingSpeciesPatterns = /(鲫鱼|鲤鱼|草鱼|鲢鳙|白条|翘嘴|黄颡鱼|鲶鱼)/g;
const locationPatterns =
  /(荆州长江大桥|汉江运河|集贸市场|荆州市|荆州|长阳县|长阳|清江库区|清江|恩施州|恩施|利川市|利川|野三关|野三关镇|谋道镇|长岭镇|建始县|建始|高坪镇|高坪|龙舟坪镇|龙舟坪|宜昌|湖北)/g;

export const locationGazetteer = [
  {
    label: '湖北省',
    aliases: ['湖北'],
    province: '湖北省',
    city: null,
    district: null,
    prefecture: null,
    county: null,
    poi: null,
    lat: 30.5454,
    lng: 114.3423,
    priority: 1,
  },
  {
    label: '荆州 · 汉江运河',
    aliases: ['汉江运河'],
    province: '湖北省',
    city: '荆州',
    district: null,
    prefecture: '荆州市',
    county: null,
    poi: '汉江运河',
    lat: 30.3352,
    lng: 112.2397,
    priority: 8,
  },
  {
    label: '荆州 · 集贸市场',
    aliases: ['集贸市场'],
    province: '湖北省',
    city: '荆州',
    district: null,
    prefecture: '荆州市',
    county: null,
    poi: '集贸市场',
    lat: 30.341,
    lng: 112.233,
    priority: 5,
  },
  {
    label: '荆州',
    aliases: ['荆州', '荆州市'],
    province: '湖北省',
    city: '荆州',
    district: null,
    prefecture: '荆州市',
    county: null,
    poi: null,
    lat: 30.3352,
    lng: 112.2397,
    priority: 4,
  },
  {
    label: '长阳 · 清江',
    aliases: ['清江库区', '清江'],
    province: '湖北省',
    city: '长阳',
    district: '长阳土家族自治县',
    prefecture: '宜昌市',
    county: '长阳土家族自治县',
    poi: '清江',
    lat: 30.4708,
    lng: 111.2016,
    priority: 7,
  },
  {
    label: '长阳土家族自治县',
    aliases: ['长阳县', '长阳'],
    province: '湖北省',
    city: '长阳',
    district: '长阳土家族自治县',
    prefecture: '宜昌市',
    county: '长阳土家族自治县',
    poi: null,
    lat: 30.4708,
    lng: 111.2016,
    priority: 7,
  },
  {
    label: '恩施州 · 利川市',
    aliases: ['利川市', '利川'],
    province: '湖北省',
    city: '恩施',
    district: '利川市',
    prefecture: '恩施土家族苗族自治州',
    county: '利川市',
    poi: null,
    lat: 30.2965,
    lng: 108.9367,
    priority: 7,
  },
  {
    label: '恩施土家族苗族自治州',
    aliases: ['恩施州', '恩施'],
    province: '湖北省',
    city: '恩施',
    district: null,
    prefecture: '恩施土家族苗族自治州',
    county: null,
    poi: null,
    lat: 30.2722,
    lng: 109.4882,
    priority: 5,
  },
  {
    label: '巴东 · 野三关镇',
    aliases: ['野三关镇', '野三关'],
    province: '湖北省',
    city: '恩施',
    district: '巴东县',
    prefecture: '恩施土家族苗族自治州',
    county: '巴东县',
    poi: '野三关镇',
    lat: 30.7342,
    lng: 110.1414,
    priority: 8,
  },
  {
    label: '利川 · 谋道镇',
    aliases: ['谋道镇'],
    province: '湖北省',
    city: '恩施',
    district: '利川市',
    prefecture: '恩施土家族苗族自治州',
    county: '利川市',
    poi: '谋道镇',
    lat: 30.1843,
    lng: 108.8357,
    priority: 8,
  },
  {
    label: '长阳 · 长岭镇',
    aliases: ['长岭镇'],
    province: '湖北省',
    city: '长阳',
    district: '长阳土家族自治县',
    prefecture: '宜昌市',
    county: '长阳土家族自治县',
    poi: '长岭镇',
    lat: 30.398,
    lng: 111.089,
    priority: 8,
  },
  {
    label: '建始县',
    aliases: ['建始县', '建始'],
    province: '湖北省',
    city: '恩施',
    district: '建始县',
    prefecture: '恩施土家族苗族自治州',
    county: '建始县',
    poi: null,
    lat: 30.6615,
    lng: 109.9368,
    priority: 7,
  },
  {
    label: '建始 · 高坪镇',
    aliases: ['高坪镇', '高坪'],
    province: '湖北省',
    city: '恩施',
    district: '建始县',
    prefecture: '恩施土家族苗族自治州',
    county: '建始县',
    poi: '高坪镇',
    lat: 30.6649,
    lng: 110.0789,
    priority: 8,
  },
  {
    label: '长阳 · 龙舟坪镇',
    aliases: ['龙舟坪镇', '龙舟坪'],
    province: '湖北省',
    city: '长阳',
    district: '长阳土家族自治县',
    prefecture: '宜昌市',
    county: '长阳土家族自治县',
    poi: '龙舟坪镇',
    lat: 30.4726,
    lng: 111.1985,
    priority: 8,
  },
  {
    label: '宜昌',
    aliases: ['宜昌'],
    province: '湖北省',
    city: '宜昌',
    district: null,
    prefecture: '宜昌市',
    county: null,
    poi: null,
    lat: 30.6919,
    lng: 111.2865,
    priority: 4,
  },
];

export function parseSrtText(input) {
  const content = input.replace(/\r/g, '');
  return content
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      return {
        index: Number(lines[0]),
        timestamp: lines[1] ?? '',
        text: lines.slice(2).join(' ').trim(),
      };
    });
}

export function loadTranscript(path) {
  return readFileSync(path, 'utf8');
}

export function parseLooseSrt(path) {
  const buffer = readFileSync(path);
  return parseSrtText(buffer.toString('utf8'));
}

export function inferLocation(title, transcript, visualAnalysis = null) {
  const sourceText = `${title} ${transcript}`;
  const matches = [...sourceText.matchAll(locationPatterns)].map((match) => match[0]);
  const normalized = unique(
    matches.map((value) => {
      if (value === '荆州市') return '荆州';
      return value;
    }),
  );
  const gazetteerMatches = locationGazetteer
    .map((entry) => {
      const alias = entry.aliases.find((item) => sourceText.includes(item));
      if (!alias) return null;
      return {
        ...entry,
        alias,
        score: entry.priority * 100 + alias.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  const best = gazetteerMatches[0] ?? null;
  const ocrSourceText = (visualAnalysis?.signals?.ocrMentions ?? []).join(' ');
  const visualMatch = !best && ocrSourceText
    ? locationGazetteer
        .map((entry) => {
          const alias = entry.aliases.find((item) => ocrSourceText.includes(item));
          if (!alias) return null;
          return {
            ...entry,
            alias,
            score: entry.priority * 100 + alias.length,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)[0] ?? null
    : null;
  const resolved = best ?? visualMatch;
  const visualEvidence = visualMatch
    ? [
        {
          source: 'frame_ocr',
          quote: `关键帧 OCR 识别到地点词：${visualMatch.alias}`,
        },
      ]
    : [];

  return {
    label: resolved?.label ?? normalized.at(0) ?? '未在视频中明确提及',
    province: resolved?.province ?? null,
    city: resolved?.city ?? null,
    district: resolved?.district ?? null,
    prefecture: resolved?.prefecture ?? null,
    county: resolved?.county ?? null,
    poi: resolved?.poi ?? null,
    lat: resolved?.lat ?? null,
    lng: resolved?.lng ?? null,
    confidence: best ? 'high' : visualMatch ? 'medium' : normalized.length > 0 ? 'medium' : 'unknown',
    evidence: normalized.slice(0, 4).map((value) => ({
      source: 'subtitle',
      quote: `识别到地点词：${value}`,
    })).concat(visualEvidence),
  };
}

export function inferRoute(previousVideo, currentLocation) {
  if (
    !previousVideo ||
    previousVideo.location.lat === null ||
    previousVideo.location.lng === null ||
    currentLocation.lat === null ||
    currentLocation.lng === null
  ) {
    return {
      fromLabel: null,
      toLabel: currentLocation.label,
      distanceKm: null,
      polyline: currentLocation.lat !== null && currentLocation.lng !== null ? [[currentLocation.lng, currentLocation.lat]] : [],
      method: 'none',
    };
  }

  return {
    fromLabel: previousVideo.location.label,
    toLabel: currentLocation.label,
    distanceKm: roughDistance(
      previousVideo.location.lat,
      previousVideo.location.lng,
      currentLocation.lat,
      currentLocation.lng,
    ),
    polyline: [
      [previousVideo.location.lng, previousVideo.location.lat],
      [currentLocation.lng, currentLocation.lat],
    ],
    method: 'inferred-sequential',
  };
}

export function inferWeather(title, transcript, visualAnalysis = null) {
  const sourceText = `${title} ${transcript}`;
  const tags = new Set();
  for (const pattern of weatherPatterns) {
    if (pattern.regex.test(sourceText)) {
      tags.add(pattern.tag);
    }
  }
  if (visualAnalysis?.signals?.hasRainGearOrWetGround) {
    tags.add('下雨');
  }
  const tagList = normalizeWeatherTags([...tags], sourceText);
  const summary = buildWeatherSummary(tagList, sourceText);
  const visualEvidence = visualAnalysis?.signals?.hasRainGearOrWetGround
    ? [
        {
          source: 'frame_visual',
          quote: '关键帧出现湿地、雨具或明显雨天环境',
        },
      ]
    : [];
  return {
    summary,
    conditionTags: tagList,
    temperatureMin: null,
    temperatureMax: null,
    windLevel: tagList.includes('刮风') ? '风大' : null,
    precipitationHint:
      tagList.includes('强降雨') ? '有明显强降雨' : tagList.includes('下雨') || tagList.includes('弱降雨') ? '有降雨' : null,
    confidence: tagList.length > 0 ? 'medium' : 'unknown',
    evidence: collectEvidence(transcript, weatherPatterns.map((pattern) => pattern.regex), 'subtitle').concat(visualEvidence),
  };
}

export function inferTimeSpan(transcript, visualAnalysis = null) {
  const matches = [...transcript.matchAll(timePatterns)].map((match) => match[0]);
  const dayParts = matches.filter((value) => ['早上', '中午', '下午', '晚上', '天亮了'].some((part) => value.includes(part)));
  const frameTimes = (visualAnalysis?.frames ?? []).map((frame) => frame.timestampText);
  return {
    startTimeText: matches[0] ?? frameTimes[0] ?? null,
    endTimeText: matches.at(-1) ?? frameTimes.at(-1) ?? null,
    durationHintText: matches.length >= 2 ? `视频覆盖从 ${matches[0]} 到 ${matches.at(-1)}` : frameTimes.length >= 2 ? `关键帧覆盖从 ${frameTimes[0]} 到 ${frameTimes.at(-1)}` : null,
    keyMoments: matches.slice(0, 6).map((value, index) => ({ label: `时间点 ${index + 1}`, timeText: value })),
    inferredDayPartTags: [...new Set(dayParts)],
    confidence: matches.length >= 2 ? 'medium' : matches.length === 1 ? 'low' : 'unknown',
    evidence: matches.slice(0, 5).map((value) => ({
      source: 'subtitle',
      quote: `识别到时间表达：${value}`,
    })).concat(
      frameTimes.slice(0, 2).map((value) => ({
        source: 'frame_visual',
        quote: `关键帧时间点：${value}`,
        timestamp: value,
      })),
    ),
  };
}

export function inferDinner(title, transcript) {
  const sourceText = `${title} ${transcript}`;
  const foods = unique([...sourceText.matchAll(dinnerPatterns)].map((match) => match[0]));
  const namedDish = inferNamedDish(sourceText, foods);
  return {
    summary: namedDish ?? (foods.length > 0 ? `晚餐围绕 ${foods.slice(0, 4).join('、')} 展开` : '未在视频中明确提及'),
    foods,
    cookingMethod: inferCookingMethod(sourceText),
    evidence: foods.slice(0, 4).map((food) => ({
      source: 'subtitle',
      quote: `识别到晚餐相关食材：${food}`,
    })),
  };
}

export function inferShopping(transcript, visualAnalysis = null) {
  const breakdown = [];
  const seenContexts = new Set();
  let explicitTotal = null;
  for (const match of transcript.matchAll(shoppingAmountPattern)) {
    const context = windowQuote(transcript, match.index ?? 0, 24);
    const amount = Number(match[1] ?? NaN);
    const item = inferShoppingItem(transcript, match.index ?? 0, context);
    if (!Number.isFinite(amount) || !looksLikeShoppingContext(context, item, amount)) {
      continue;
    }
    if (/(一共|总共|就是)\s*\d+(?:\.\d+)?\s*(?:块钱|块|元)/.test(context)) {
      explicitTotal = amount;
      continue;
    }
    const dedupeKey = `${item}-${amount}`;
    if (seenContexts.has(dedupeKey)) {
      continue;
    }
    seenContexts.add(dedupeKey);
    breakdown.push({
      item,
      costText: `${amount}元`,
      costCny: amount,
    });
  }
  const computedTotal = breakdown.reduce((sum, item) => sum + (item.costCny ?? 0), 0);
  const total = explicitTotal ?? computedTotal;
  const ocrBreakdown = inferVisualShopping(visualAnalysis, seenContexts);
  const mergedBreakdown = breakdown.concat(ocrBreakdown);
  const mergedTotal = mergedBreakdown.reduce((sum, item) => sum + (item.costCny ?? 0), 0);
  return {
    hasShopping: mergedBreakdown.length > 0,
    items: unique(mergedBreakdown.map((item) => item.item).filter(Boolean)),
    totalCostText: mergedBreakdown.length > 0 ? `合计约 ${(explicitTotal ?? mergedTotal).toFixed(2)} 元` : null,
    totalCostCny: mergedBreakdown.length > 0 ? explicitTotal ?? mergedTotal : null,
    costBreakdown: mergedBreakdown,
    evidence: breakdown.slice(0, 5).map((item) => ({
      source: 'subtitle',
      quote: `识别到花费：${item.item} ${item.costText}`,
    })).concat(
      ocrBreakdown.map((item) => ({
        source: 'frame_ocr',
        quote: `关键帧 OCR 识别到价格线索：${item.item} ${item.costText}`,
      })),
    ),
  };
}

export function inferFishingTheory(transcript) {
  const tags = new Set();
  for (const keyword of theoryKeywords) {
    if (keyword.regex.test(transcript)) {
      tags.add(keyword.tag);
    }
  }
  const tagList = [...tags];
  return {
    summary:
      tagList.length > 0
        ? `视频中提到的钓鱼理论主要集中在 ${tagList.join('、')}`
        : '未在视频中明确提及',
    tags: tagList,
    techniques: tagList.filter((tag) => ['钓位', '饵料', '时段'].includes(tag)),
    conditions: tagList.filter((tag) => ['鱼情判断', '天气水情'].includes(tag)),
    evidence: collectEvidence(transcript, theoryKeywords.map((item) => item.regex), 'subtitle').slice(0, 6),
  };
}

export function inferFishing(title, transcript, visualAnalysis = null) {
  const sourceText = `${title} ${transcript}`;
  const species = unique([...sourceText.matchAll(fishingSpeciesPatterns)].map((match) => match[0]));
  const titleCatch = /(钓到|打破纪录|吃上微物|搞到一个|上鱼了|斤鲫|巨物)/.test(title);
  const titleSkunk = /(没钓到鱼|一口没有|空军)/.test(title);
  const transcriptSignals = extractFishingSignals(transcript);
  const visualFishSignal = visualAnalysis?.signals?.hasFishCloseup ?? false;
  const explicitSkunk = titleSkunk ? true : titleCatch ? false : transcriptSignals.skunk;
  const explicitCatch = titleSkunk ? false : titleCatch || transcriptSignals.catch || visualFishSignal;
  const caught = explicitSkunk ? 'no' : explicitCatch ? 'yes' : 'unknown';
  const isSkunked = explicitSkunk ? 'yes' : explicitCatch ? 'no' : 'unknown';
  const weight = extractFishingWeight(sourceText);
  const count = extractFishingCount(sourceText);
  return {
    caught,
    isSkunked,
    species,
    weightText: weight,
    countText: count,
    evidence: collectEvidence(transcript, [caughtPatterns, skunkPatterns, fishingSpeciesPatterns], 'subtitle')
      .slice(0, 6)
      .concat(
        visualFishSignal
          ? [
              {
                source: 'frame_visual',
                quote: '关键帧中出现鱼获或钓鱼结果展示画面',
              },
            ]
          : [],
      ),
  };
}

export function transcriptExcerpt(transcript) {
  const compact = transcript.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 180);
}

export function buildEvidenceBundle({ meta, subtitlePath, transcriptPath, transcriptSource, transcript, visualAnalysisPath }) {
  return {
    meta: {
      id: meta.id,
      title: meta.title,
      publishedAt: meta.upload_date,
      durationSec: Math.round(meta.duration ?? 0),
      sourceUrl: meta.webpage_url,
    },
    transcriptSource,
    files: {
      subtitlePath,
      transcriptPath,
      visualAnalysisPath: visualAnalysisPath ?? null,
    },
    snippets: {
      intro: transcriptExcerpt(transcript),
    },
  };
}

export function collectEvidence(transcript, regexes, source) {
  const evidence = [];
  for (const regex of regexes) {
    const matches = [...transcript.matchAll(new RegExp(regex.source, 'g'))];
    for (const match of matches.slice(0, 2)) {
      evidence.push({
        source,
        quote: windowQuote(transcript, match.index ?? 0, 26),
      });
    }
  }
  return evidence;
}

function windowQuote(text, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values)];
}

function inferCookingMethod(sourceText) {
  if (/炒着吃|炒肉|炒菜/.test(sourceText)) return '炒';
  if (/焖饭|闷饭/.test(sourceText)) return '焖';
  if (/煮汤|鱼汤|一菜一汤/.test(sourceText)) return '煮汤';
  if (/炒饭/.test(sourceText)) return '炒饭';
  if (/炒/.test(sourceText)) return '炒';
  if (/烧|红烧/.test(sourceText)) return '烧';
  if (/煮/.test(sourceText)) return '煮';
  return null;
}

function inferNamedDish(sourceText, foods) {
  const explicitPatterns = [
    /(野葱闷饭|野葱焖饭)/,
    /(半只鸭子)/,
    /(牛皮菜烧胡豆|牛皮菜烧黄豆|牛皮菜配胡豆)/,
    /(半斤牛肉炒着吃|牛肉炒着吃)/,
    /(一菜一汤)/,
    /(烧排骨|排骨)/,
    /(炒饭)/,
    /(鱼汤)/,
  ];
  for (const pattern of explicitPatterns) {
    const match = sourceText.match(pattern);
    if (match) {
      return `晚餐是${match[0]}`;
    }
  }

  if (foods.includes('牛皮菜') && (foods.includes('胡豆') || foods.includes('黄豆'))) {
    return '晚餐是牛皮菜烧胡豆';
  }
  if (/鸭子/.test(sourceText)) {
    return '晚餐是半只鸭子配米饭';
  }
  if (/牛肉/.test(sourceText)) {
    return '晚餐是牛肉炒菜';
  }
  if (/野葱/.test(sourceText) && /饭/.test(sourceText)) {
    return '晚餐是野葱焖饭';
  }
  if (/排骨/.test(sourceText)) {
    return '晚餐是烧排骨';
  }
  if (/鱼汤/.test(sourceText) || /煮鱼/.test(sourceText)) {
    return '晚餐有鱼汤';
  }
  if (foods.includes('猪肉') && foods.includes('辣椒')) {
    return '晚餐以辣椒炒肉为主';
  }
  if (foods.includes('米饭') && foods.length <= 2) {
    return '晚餐以米饭简餐为主';
  }
  return null;
}

function extractFishingWeight(sourceText) {
  const matches = [...sourceText.matchAll(/(\d{1,2}(?:\.\d+)?)\s*(斤|两|公斤|千克)/g)];
  for (const match of matches) {
    const value = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(value)) continue;
    if (unit === '两' && value > 30) continue;
    if ((unit === '斤' || unit === '公斤' || unit === '千克') && value > 50) continue;
    const context = windowQuote(sourceText, match.index ?? 0, 20);
    if (!/(钓到|上了|鲫鱼|鲤鱼|翘嘴|巨物|鱼|这条|半斤|一斤|斤鲫|重量)/.test(context)) {
      continue;
    }
    return `${match[1]}${unit}`;
  }
  return null;
}

function extractFishingCount(sourceText) {
  const matches = [...sourceText.matchAll(/(\d{1,2})\s*(条|尾)/g)];
  for (const match of matches) {
    const value = Number(match[1]);
    if (value <= 20) {
      return `${match[1]}${match[2]}`;
    }
  }
  return null;
}

function extractFishingSignals(transcript) {
  let catchSignal = false;
  let skunkSignal = false;
  const catches = [...transcript.matchAll(new RegExp(caughtPatterns.source, 'g'))];
  const skunks = [...transcript.matchAll(new RegExp(skunkPatterns.source, 'g'))];

  for (const match of catches) {
    const context = windowQuote(transcript, match.index ?? 0, 34);
    if (isThirdPartyFishingContext(context)) continue;
    if (/(没上鱼|不上鱼|不怎么上鱼|也没看到上鱼|没有中鱼)/.test(context)) continue;
    if (/(煮汤|香味|烫了|吃|喝|饭|菜|牛肉|鸭子)/.test(context) && !/(鱼|钓|竿|窝|鲫鱼|鲤鱼|翘嘴)/.test(context)) continue;
    if (/(我|今天|终于|兄弟们|收竿|晚上|夜钓|来了一口|突然来一口|我去)/.test(context) || !/(大哥|钓友|旁边|他们|别人)/.test(context)) {
      catchSignal = true;
      break;
    }
  }

  for (const match of skunks) {
    const context = windowQuote(transcript, match.index ?? 0, 34);
    if (isThirdPartyFishingContext(context)) continue;
    if (/(今天|我|这里|守了|收了|一口都没有|没钓到)/.test(context) || !/(大哥|钓友|旁边|他们|别人|昨天)/.test(context)) {
      skunkSignal = true;
      break;
    }
  }

  return {
    catch: catchSignal,
    skunk: skunkSignal,
  };
}

function isThirdPartyFishingContext(context) {
  return /(大哥|钓友|旁边|他们|别人|全场|这里六七个人|他在这里|他说|昨天|桶里面还有一条)/.test(context);
}

function sanitizeShoppingItem(raw) {
  const trimmed = raw.trim();
  if (!trimmed || /^\d+$/.test(trimmed)) {
    return '未明确品类';
  }
  if (/^(啊|呀|哇|嗯|消费|花费|老板|这个|那个)$/.test(trimmed)) {
    return '未明确品类';
  }
  if (/\d/.test(trimmed)) {
    return '未明确品类';
  }
  if (trimmed.length > 8) {
    return '未明确品类';
  }
  return trimmed;
}

function inferShoppingItem(transcript, index, context) {
  const forward = transcript.slice(index, index + 18);
  const backward = transcript.slice(Math.max(0, index - 18), index);
  const candidates = [
    forward.match(/(?:块钱|块|元)(?:的)?(半只鸭|二荆条|螺丝椒|辣椒|青椒|红椒|牛肉|猪肉|羊肉|咪咪肉|排骨|胡豆|黄豆)/),
    backward.match(/(半只鸭|二荆条|螺丝椒|辣椒|青椒|红椒|牛肉|猪肉|羊肉|咪咪肉|排骨|胡豆|黄豆|蔬菜|菜)(?:已经买好了|花了|用了|消费|花费|买了|买成)?$/),
    context.match(/(半只鸭|二荆条|螺丝椒|辣椒|青椒|红椒|牛肉|猪肉|羊肉|咪咪肉|排骨|胡豆|黄豆|蔬菜|买了一点菜|菜)/),
  ];
  for (const match of candidates) {
    const value = match?.[1] ?? match?.[0];
    if (!value) continue;
    if (value === '买了一点菜') {
      return '蔬菜';
    }
    return sanitizeShoppingItem(value);
  }
  return '未明确品类';
}

function looksLikeShoppingContext(context, item, amount) {
  if (amount < 1) {
    return false;
  }
  if (amount < 3 && item === '未明确品类') {
    return false;
  }
  if (/(宾馆|民宿|旅馆|住宿|房费|房间|快餐|牛肉面|羊肉面|面馆|梨|一斤|五六十块|七八十)/.test(context)) {
    return false;
  }
  const groceryCues = /(超市|市场|买菜|买了一点菜|菜已经买好了|消费|买了|买点|食材|配菜)/;
  if (groceryCues.test(context)) {
    return true;
  }
  if (item !== '未明确品类' && /(鸭|牛肉|猪肉|羊肉|咪咪肉|辣椒|螺丝椒|二荆条|排骨|胡豆|黄豆|蔬菜|菜)/.test(item)) {
    return true;
  }
  return false;
}

function inferVisualShopping(visualAnalysis, seenContexts) {
  if (!visualAnalysis?.frames?.length) {
    return [];
  }

  const breakdown = [];
  for (const frame of visualAnalysis.frames) {
    const matches = [...frame.ocrText.matchAll(/(\d+(?:\.\d+)?)\s*(元|块)/g)];
    for (const match of matches) {
      const amount = Number(match[1]);
      if (!Number.isFinite(amount)) continue;
      const item = inferVisualShoppingItem(frame.ocrText);
      if (item === '未明确品类' && amount < 5) continue;
      const dedupeKey = `ocr-${item}-${amount}`;
      if (seenContexts.has(dedupeKey)) continue;
      seenContexts.add(dedupeKey);
      breakdown.push({
        item,
        costText: `${amount}元`,
        costCny: amount,
      });
    }
  }
  return breakdown.slice(0, 4);
}

function inferVisualShoppingItem(text) {
  const match = text.match(/(牛肉|猪肉|羊肉|排骨|胡豆|黄豆|辣椒|蔬菜|市场|菜)/);
  return match?.[1] ?? '未明确品类';
}

function normalizeWeatherTags(tags, sourceText) {
  const normalized = new Set(tags);

  if (normalized.has('强降雨')) {
    normalized.add('下雨');
  }
  if (normalized.has('弱降雨')) {
    normalized.add('下雨');
  }
  if (normalized.has('晴天') && normalized.has('阴天')) {
    normalized.delete('晴天');
  }
  if (normalized.has('晴天') && /(阴天|大阴天)/.test(sourceText)) {
    normalized.delete('晴天');
  }
  if (normalized.has('晴天') && /(没有太阳|没太阳|晒会儿太阳.*结果是个阴天)/.test(sourceText)) {
    normalized.delete('晴天');
  }
  if (normalized.has('下雨') && /(今天.*没下雨|不下雨了|雨停了|雨晓了)/.test(sourceText)) {
    normalized.add('雨停');
  }
  if (normalized.has('下雨') && normalized.has('晴天') && !/(大太阳|蓝天没有白云|太阳出来)/.test(sourceText)) {
    normalized.delete('晴天');
  }

  return [...normalized];
}

function buildWeatherSummary(tags, sourceText) {
  if (tags.length === 0) {
    return '未在视频中明确提及';
  }

  const parts = [];
  if (tags.includes('强降雨')) {
    parts.push('当天有明显雷雨或大雨');
  } else if (tags.includes('弱降雨')) {
    parts.push('当天以小雨或绵雨为主');
  } else if (tags.includes('下雨')) {
    parts.push('当天有降雨');
  }

  if (tags.includes('阴天')) {
    parts.push('天色偏阴');
  } else if (tags.includes('晴天')) {
    parts.push('有较明显日照');
  }

  if (tags.includes('刮风')) {
    parts.push('伴随风力影响');
  }

  if (tags.includes('降温')) {
    parts.push('体感偏冷或出现降温');
  }

  if (tags.includes('雨停')) {
    parts.push('视频里也提到雨势后续减弱或暂停');
  }

  if (parts.length === 0 && /天气预报/.test(sourceText)) {
    parts.push('视频中提到天气预报信息');
  }

  return parts.join('，');
}

function roughDistance(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(1));
}
