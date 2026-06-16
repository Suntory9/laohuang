export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

/**
 * 证据来源。保留 `| string` 是为了允许管线扩展来源时不需要同步改类型
 * （新增来源的提取器脚本可以立即产出证据，类型层面再逐步收窄）。
 */
export type EvidenceSource =
  | 'meta'
  | 'subtitle'
  | 'asr'
  | 'frame_ocr'
  | 'frame_visual'
  | 'comment'
  | 'sequence-inference'
  | 'manual_override'
  | string;

export interface EvidenceItem {
  source: EvidenceSource;
  quote: string;
  timestamp?: string;
  weight?: number;
  ref?: string;
}

export interface LocatedEntity {
  label: string;
  province: string | null;
  /** @deprecated 使用 prefecture */
  city: string | null;
  /** @deprecated 使用 county */
  district: string | null;
  prefecture: string | null;
  county: string | null;
  poi: string | null;
  lat: number | null;
  lng: number | null;
  confidence: Confidence;
  evidence: EvidenceItem[];
}

/**
 * 评论证据 — 由 comment-extractors.mjs 产出，通过 evidence 字段接入 LocationCandidate 等候选类型。
 * 不直接挂在 VideoIntel 下，而是作为候选的证据来源参与打分。
 */
export interface CommentEvidence {
  source: 'comment';
  rpid: string;
  userName: string;
  likeCount: number;
  text: string;
  publishedAt: string;
  signals: {
    locationMentions: string[];
    fishMentions: string[];
    routeMentions: string[];
    correctionMentions: string[];
  };
  credibility: 'high' | 'medium' | 'low';
}

export interface LocationCandidate {
  label: string;
  province: string | null;
  prefecture: string | null;
  county: string | null;
  poi: string | null;
  lat: number | null;
  lng: number | null;
  confidence: Confidence;
  score: number;
  evidence: EvidenceItem[];
}

export interface CatchCandidate {
  species: string;
  countText: string | null;
  weightText: string | null;
  confidence: Confidence;
  score: number;
  evidence: EvidenceItem[];
}

export interface RouteCandidate {
  fromLabel: string;
  toLabel: string;
  evidence: EvidenceItem[];
}

export interface WeatherCandidate {
  summary: string;
  conditionTags: string[];
  confidence: Confidence;
  score: number;
  evidence: EvidenceItem[];
}

export interface StoryEvent {
  label: string;
  timeText: string | null;
  evidence: EvidenceItem[];
}

export interface EvidenceConflict {
  field: string;
  candidates: Array<{ value: string; source: EvidenceSource; quote: string }>;
  resolution: string | null;
}

export interface VideoIntel {
  bvid: string;
  title: string;
  sequenceIndex: number;
  candidates: {
    locations: LocationCandidate[];
    catches: CatchCandidate[];
    routeSegments: RouteCandidate[];
    weather: WeatherCandidate[];
    storyEvents: StoryEvent[];
  };
  conflicts: EvidenceConflict[];
  final: VideoRecord;
}

export interface WeatherInfo {
  summary: string;
  conditionTags: string[];
  temperatureMin: number | null;
  temperatureMax: number | null;
  windLevel: string | null;
  precipitationHint: string | null;
  confidence: Confidence;
  evidence: EvidenceItem[];
}

export interface RouteInfo {
  fromLabel: string | null;
  toLabel: string | null;
  distanceKm: number | null;
  polyline: [number, number][];
  method: 'explicit' | 'inferred-sequential' | 'none';
}

export interface TimeSpanInfo {
  startTimeText: string | null;
  endTimeText: string | null;
  durationHintText: string | null;
  keyMoments: Array<{ label: string; timeText: string }>;
  inferredDayPartTags: string[];
  confidence: Confidence;
  evidence: EvidenceItem[];
}

export interface DinnerInfo {
  summary: string;
  foods: string[];
  cookingMethod: string | null;
  evidence: EvidenceItem[];
}

export interface ShoppingInfo {
  hasShopping: boolean;
  items: string[];
  totalCostText: string | null;
  totalCostCny: number | null;
  costBreakdown: Array<{ item: string; costText: string; costCny: number | null }>;
  evidence: EvidenceItem[];
}

export interface FishingTheoryInfo {
  summary: string;
  tags: string[];
  techniques: string[];
  conditions: string[];
  evidence: EvidenceItem[];
}

export interface FishingInfo {
  caught: 'yes' | 'no' | 'unknown';
  isSkunked: 'yes' | 'no' | 'unknown';
  species: string[];
  weightText: string | null;
  countText: string | null;
  evidence: EvidenceItem[];
}

export interface VisualFrame {
  imageUrl: string | null;
  imagePath: string | null;
  timestampSec: number;
  timestampText: string;
  ocrText: string;
  sceneTags: string[];
  transcriptWindow: string | null;
}

export interface VisualSignals {
  hasCampScene: boolean;
  hasCookingScene: boolean;
  hasFishCloseup: boolean;
  hasRoadSignText: boolean;
  hasRainGearOrWetGround: boolean;
  hasShoppingScene: boolean;
  ocrMentions: string[];
}

export interface VisualAnalysis {
  summary: string;
  frames: VisualFrame[];
  signals: VisualSignals;
  confidence: Confidence;
}

export interface VideoRecord {
  bvid: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  coverUrl: string;
  bilibiliUrl: string;
  sequenceIndex: number;
  transcriptSource: 'official_subtitle' | 'asr';
  location: LocatedEntity;
  weather: WeatherInfo;
  route: RouteInfo;
  timeSpan: TimeSpanInfo;
  dinner: DinnerInfo;
  shopping: ShoppingInfo;
  fishingTheory: FishingTheoryInfo;
  fishing: FishingInfo;
  visualAnalysis?: VisualAnalysis | null;
  transcriptExcerpt: string;
  rawEvidenceRefs: string[];
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
}

export interface JourneySummary {
  title: string;
  playlistId: string;
  playlistUrl: string;
  generatedAt: string;
  totalVideos: number;
  coveredPrefectures: number;
  videosWithCatch: number;
  videosWithUnknownCatch: number;
  skunkedVideos: number;
  videosWithUnknownSkunk: number;
  totalShoppingCostCny: number;
  averageActivitySpanHours: number;
  topDinnerFoods: Array<{ label: string; count: number }>;
  topFishingTheoryTags: Array<{ label: string; count: number }>;
  prefectureStops: Array<{ prefecture: string; count: number; lat: number | null; lng: number | null }>;
  routePolyline: [number, number][];
  mapViewport?: MapViewport;
}
