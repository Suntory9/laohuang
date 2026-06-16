import type { EChartsOption } from 'echarts';
import type { AdminAreaStats } from './adminStats';
import type { VideoRecord } from '../types';

export const HUBEI_MAP_NAME = 'hubei-prefecture';

export interface JourneyMapOptionInput {
  videos: VideoRecord[];
  areaStats: AdminAreaStats[];
  selectedBvid: string;
  selectedAreaKey: string;
  routePolyline: [number, number][];
}

export function buildJourneyMapOption(input: JourneyMapOptionInput): EChartsOption {
  const maxVideoCount = Math.max(1, ...input.areaStats.map((area) => area.videoCount));
  const areaByName = new Map(input.areaStats.map((area) => [area.name, area]));
  const pointData = input.videos
    .filter((video) => video.location.lng !== null && video.location.lat !== null)
    .map((video) => ({
      name: video.title,
      value: [video.location.lng, video.location.lat, video.sequenceIndex],
      bvid: video.bvid,
      locationLabel: video.location.label,
      isActive: video.bvid === input.selectedBvid,
      caught: video.fishing.caught,
      skunked: video.fishing.isSkunked,
    }));

  const lineData =
    input.routePolyline.length > 1
      ? [{ coords: input.routePolyline, lineStyle: { width: 2 } }]
      : [];

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params) => formatTooltip(params, areaByName),
    },
    visualMap: {
      min: 0,
      max: maxVideoCount,
      show: true,
      calculable: false,
      left: 18,
      bottom: 18,
      itemWidth: 12,
      itemHeight: 80,
      text: ['多', '少'],
      textStyle: { color: '#c8d6a0', fontSize: 11 },
      inRange: { color: ['#182514', '#486454', '#d59500'] },
    },
    geo: {
      map: HUBEI_MAP_NAME,
      roam: true,
      zoom: 1.05,
      label: { show: false },
      itemStyle: {
        areaColor: '#1a2410',
        borderColor: 'rgba(200, 214, 160, 0.28)',
        borderWidth: 1,
      },
      emphasis: {
        label: { show: true, color: '#e8e0cc', fontSize: 12 },
        itemStyle: { areaColor: '#486454' },
      },
      select: {
        label: { show: true, color: '#e8e0cc', fontWeight: 'bold' },
        itemStyle: { areaColor: '#7a9a70', borderColor: '#d59500', borderWidth: 2 },
      },
    },
    series: [
      {
        type: 'map',
        map: HUBEI_MAP_NAME,
        geoIndex: 0,
        selectedMode: 'single',
        data: input.areaStats.map((area) => ({
          name: area.name,
          value: area.videoCount,
          selected: area.key === input.selectedAreaKey,
        })),
      },
      {
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        silent: true,
        polyline: true,
        effect: { show: false },
        lineStyle: { color: 'rgba(213, 149, 0, 0.58)', width: 2, opacity: 0.8 },
        data: lineData,
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 3,
        symbolSize: (value: unknown) => {
          const row = value as [number, number, number];
          return row[2] ? 10 : 8;
        },
        rippleEffect: { scale: 3, brushType: 'stroke' },
        itemStyle: { color: '#d59500', shadowColor: 'rgba(213,149,0,0.35)', shadowBlur: 10 },
        data: pointData,
      },
    ],
  };
}

function formatTooltip(params: unknown, areaByName: Map<string, AdminAreaStats>) {
  const item = params as { componentSubType?: string; name?: string; data?: Record<string, unknown> };
  if (item.componentSubType === 'effectScatter') {
    return `<strong>${item.name ?? ''}</strong><br/>${item.data?.locationLabel ?? ''}`;
  }
  const area = item.name ? areaByName.get(item.name) : null;
  if (!area) return `<strong>${item.name ?? ''}</strong><br/>暂无视频`;
  return `<strong>${area.name}</strong><br/>视频 ${area.videoCount} 期<br/>渔获 ${area.caughtCount} 期 / 空军 ${area.skunkedCount} 期`;
}
