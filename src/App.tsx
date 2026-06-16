import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { MapPanel } from './components/MapPanel';
import { TimelineBar } from './components/TimelineBar';
import { DetailPanel } from './components/DetailPanel';
import { AreaStoryPanel } from './components/AreaStoryPanel';
import type { FiltersState } from './components/Filters';
import { buildPrefectureStats } from './lib/adminStats';
import type { JourneySummary, VideoRecord } from './types';

const defaultFilters: FiltersState = {
  keyword: '',
  prefecture: '',
  weatherTag: '',
  catchState: 'all',
  skunkedState: 'all',
  hasShopping: 'all',
  theoryTag: '',
};

export default function App() {
  const [summary, setSummary] = useState<JourneySummary | null>(null);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [selectedBvid, setSelectedBvid] = useState<string>('');
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAreaKey, setSelectedAreaKey] = useState<string>('');

  useEffect(() => {
    Promise.all([
      fetch('/data/journey.json').then((response) => response.json() as Promise<JourneySummary>),
      fetch('/data/videos.json').then((response) => response.json() as Promise<VideoRecord[]>),
    ])
      .then(([journeyData, videosData]) => {
        setSummary(journeyData);
        setVideos(videosData);
        setSelectedBvid(videosData[0]?.bvid ?? '');
      })
      .catch((fetchError: Error) => setError(fetchError.message));
  }, []);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const keyword = filters.keyword.trim();
      const haystack = [
        video.title,
        video.location.label,
        video.dinner.summary,
        video.fishing.species.join(' '),
        video.fishingTheory.summary,
        video.shopping.items.join(' '),
        video.visualAnalysis?.summary ?? '',
        video.visualAnalysis?.signals.ocrMentions.join(' ') ?? '',
      ]
        .join(' ')
        .toLowerCase();

      if (keyword && !haystack.includes(keyword.toLowerCase())) return false;
      if (filters.prefecture && video.location.prefecture !== filters.prefecture) return false;
      if (filters.weatherTag && !video.weather.conditionTags.includes(filters.weatherTag)) return false;
      if (filters.catchState !== 'all' && video.fishing.caught !== filters.catchState) return false;
      if (filters.skunkedState !== 'all' && video.fishing.isSkunked !== filters.skunkedState) return false;
      if (filters.hasShopping === 'yes' && !video.shopping.hasShopping) return false;
      if (filters.hasShopping === 'no' && video.shopping.hasShopping) return false;
      if (filters.theoryTag && !video.fishingTheory.tags.includes(filters.theoryTag)) return false;
      return true;
    });
  }, [filters, videos]);

  const selectedVideo =
    filteredVideos.find((video) => video.bvid === selectedBvid) ?? filteredVideos[0] ?? null;

  const areaStats = useMemo(() => buildPrefectureStats(filteredVideos), [filteredVideos]);
  const selectedArea = areaStats.find((area) => area.key === selectedAreaKey) ?? null;

  useEffect(() => {
    if (selectedVideo && selectedVideo.bvid !== selectedBvid) {
      setSelectedBvid(selectedVideo.bvid);
    }
  }, [selectedBvid, selectedVideo]);

  useEffect(() => {
    if (selectedAreaKey && !areaStats.some((area) => area.key === selectedAreaKey)) {
      setSelectedAreaKey('');
    }
  }, [areaStats, selectedAreaKey]);

  const handleSelectVideo = useCallback((bvid: string) => {
    setSelectedBvid(bvid);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const prefectures = useMemo(
    () =>
      [...new Set(videos.map((v) => v.location.prefecture).filter((c): c is string => Boolean(c)))].sort(
        (a, b) => a.localeCompare(b, 'zh-CN'),
      ),
    [videos],
  );

  const weatherTags = useMemo(
    () =>
      [...new Set(videos.flatMap((v) => v.weather.conditionTags))].sort((a, b) =>
        a.localeCompare(b, 'zh-CN'),
      ),
    [videos],
  );

  const theoryTags = useMemo(
    () =>
      [...new Set(videos.flatMap((v) => v.fishingTheory.tags))].sort((a, b) =>
        a.localeCompare(b, 'zh-CN'),
      ),
    [videos],
  );

  if (error) {
    return (
      <main className="app-shell title-screen">
        <div className="title-screen-content">
          <div className="title-stamp">!</div>
          <h1>数据加载失败</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!summary || videos.length === 0) {
    return (
      <main className="app-shell title-screen">
        <div className="title-screen-content">
          <div className="title-stamp">钓</div>
          <h1>老黄游钓中国</h1>
          <p className="title-subtitle">Field Journal · 湖北篇</p>
          <div className="title-divider"></div>
          <p className="title-desc">
            把视频标题、字幕、音频转写、位置推断、
            <br />
            天气和渔获信息汇聚到同一张旅程图上
          </p>
          <p className="title-loading">正在加载旅程图谱…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <TopBar
        summary={summary}
        filters={filters}
        onChange={setFilters}
        prefectures={prefectures}
        weatherTags={weatherTags}
        theoryTags={theoryTags}
        resultCount={filteredVideos.length}
        totalCount={videos.length}
      />

      <MapPanel
        videos={filteredVideos}
        selectedBvid={selectedVideo?.bvid ?? ''}
        selectedAreaKey={selectedAreaKey}
        areaStats={areaStats}
        onSelectVideo={handleSelectVideo}
        onSelectArea={setSelectedAreaKey}
        routePolyline={summary.routePolyline}
      />

      <AreaStoryPanel
        area={selectedArea}
        onSelectVideo={handleSelectVideo}
        onClear={() => setSelectedAreaKey('')}
      />

      <TimelineBar
        videos={filteredVideos}
        selectedBvid={selectedVideo?.bvid ?? ''}
        onSelectVideo={handleSelectVideo}
      />

      {selectedVideo && (
        <DetailPanel video={selectedVideo} open={detailOpen} onClose={handleCloseDetail} />
      )}
    </main>
  );
}
