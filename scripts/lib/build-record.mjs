import {
  buildEvidenceBundle,
  inferDinner,
  inferFishing,
  inferFishingTheory,
  inferLocation,
  inferRoute,
  inferShopping,
  inferTimeSpan,
  inferWeather,
  transcriptExcerpt,
} from './extractors.mjs';

export function buildVideoRecord({
  meta,
  transcriptText,
  transcriptSource,
  sequenceIndex,
  previousVideo,
  subtitlePath,
  transcriptPath,
  metaPath,
  visualAnalysis = null,
  visualAnalysisPath = null,
}) {
  const location = inferLocation(meta.title, transcriptText, visualAnalysis);

  return {
    video: {
      bvid: meta.id,
      title: meta.title,
      publishedAt: toIsoDate(meta.upload_date),
      durationSec: Math.round(meta.duration ?? 0),
      coverUrl: meta.thumbnail,
      bilibiliUrl: meta.webpage_url,
      sequenceIndex,
      transcriptSource,
      location,
      weather: inferWeather(meta.title, transcriptText, visualAnalysis),
      route: inferRoute(previousVideo, location),
      timeSpan: inferTimeSpan(transcriptText, visualAnalysis),
      dinner: inferDinner(meta.title, transcriptText),
      shopping: inferShopping(transcriptText, visualAnalysis),
      fishingTheory: inferFishingTheory(transcriptText),
      fishing: inferFishing(meta.title, transcriptText, visualAnalysis),
      visualAnalysis,
      transcriptExcerpt: transcriptExcerpt(transcriptText),
      rawEvidenceRefs: [subtitlePath, transcriptPath, metaPath, visualAnalysisPath].filter(Boolean),
    },
    evidence: buildEvidenceBundle({
      meta,
      subtitlePath,
      transcriptPath,
      transcriptSource,
      transcript: transcriptText,
      visualAnalysisPath,
    }),
  };
}

function toIsoDate(uploadDate) {
  if (!uploadDate || uploadDate.length !== 8) {
    return new Date().toISOString();
  }
  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}T12:00:00.000Z`;
}
