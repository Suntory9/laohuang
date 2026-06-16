import type { VideoRecord } from '../types';

export function buildJourneyMapOption(params: {
  videos: VideoRecord[];
  selectedBvid: string;
  routePolyline: [number, number][];
  mapViewport?: {
    center: [number, number];
    zoom: number;
    bounds: { west: number; south: number; east: number; north: number };
  };
}) {
  const { videos, selectedBvid, routePolyline, mapViewport } = params;

  // 路线坐标
  const routeCoords =
    routePolyline.length > 0
      ? routePolyline.map(([lng, lat]) => [lng, lat] as [number, number])
      : videos
          .filter((v) => v.location.lng !== null && v.location.lat !== null)
          .map((v) => [v.location.lng!, v.location.lat!] as [number, number]);

  // 视频点位
  const scatterData = videos
    .filter((v) => v.location.lat !== null && v.location.lng !== null)
    .map((v) => ({
      name: v.title.slice(0, 20),
      value: [v.location.lng!, v.location.lat!] as [number, number],
      bvid: v.bvid,
      video: v,
    }));

  // 按状态分组
  const catchHigh = scatterData.filter(
    (d) => d.video.fishing.caught === 'yes' && d.video.location.confidence !== 'low',
  );
  const catchLow = scatterData.filter(
    (d) => d.video.fishing.caught === 'yes' && d.video.location.confidence === 'low',
  );
  const unknown = scatterData.filter((d) => d.video.fishing.caught === 'unknown');
  const skunked = scatterData.filter((d) => d.video.fishing.isSkunked === 'yes');
  const selected = scatterData.filter((d) => d.bvid === selectedBvid);

  const series: Array<Record<string, unknown>> = [
    // 路线
    {
      type: 'lines',
      coordinateSystem: 'geo',
      polyline: false,
      data: [{ coords: routeCoords }],
      lineStyle: { color: '#ff9800', width: 2, opacity: 0.7, curveness: 0.1 },
      effect: {
        show: routeCoords.length > 1,
        period: 6,
        trailLength: 0.3,
        symbolSize: 4,
      },
      zlevel: 1,
    },
    // 有渔获 + 高/中置信
    {
      type: 'scatter',
      coordinateSystem: 'geo',
      data: catchHigh.map((d) => ({ ...d, symbolSize: 12 })),
      symbol: 'circle',
      itemStyle: { color: '#4caf50', borderColor: '#2e7d32', borderWidth: 1.5 },
      zlevel: 2,
    },
    // 有渔获 + 低置信
    {
      type: 'scatter',
      coordinateSystem: 'geo',
      data: catchLow.map((d) => ({ ...d, symbolSize: 11 })),
      symbol: 'emptyCircle',
      itemStyle: {
        color: '#81c784',
        borderColor: '#81c784',
        borderWidth: 2,
        borderType: 'dashed' as const,
      },
      zlevel: 2,
    },
    // 未知
    {
      type: 'scatter',
      coordinateSystem: 'geo',
      data: unknown.map((d) => ({ ...d, symbolSize: 10 })),
      symbol: 'circle',
      itemStyle: { color: '#9e9e9e', borderColor: '#757575', borderWidth: 1 },
      zlevel: 2,
    },
    // 空军
    {
      type: 'scatter',
      coordinateSystem: 'geo',
      data: skunked.map((d) => ({ ...d, symbolSize: 11 })),
      symbol: 'triangle',
      itemStyle: { color: '#ef5350', borderColor: '#c62828', borderWidth: 1.5 },
      zlevel: 2,
    },
    // 选中高亮
    {
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: selected.map((d) => ({ ...d, symbolSize: 18 })),
      symbol: 'circle',
      itemStyle: { color: '#ffffff', borderColor: '#ff9800', borderWidth: 3 },
      rippleEffect: { brushType: 'stroke', scale: 3 },
      zlevel: 3,
    },
  ];

  return {
    backgroundColor: '#0f0f1a',
    geo: {
      map: '',
      roam: true,
      center: mapViewport?.center ?? [111, 30.5],
      zoom: mapViewport?.zoom ?? 6,
      itemStyle: {
        areaColor: '#1a1a2e',
        borderColor: '#333355',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: { areaColor: '#252540' },
        label: { show: false },
      },
      // 全国缩放范围
      scaleLimit: { min: 3, max: 12 },
    },
    series,
    tooltip: {
      trigger: 'item',
      formatter: (params: { name?: string; data?: { video?: VideoRecord } }) => {
        const v = params.data?.video;
        if (!v) return params.name ?? '';
        const status =
          v.fishing.caught === 'yes'
            ? '✅ 有渔获'
            : v.fishing.isSkunked === 'yes'
              ? '❌ 空军'
              : '❓ 未知';
        const conf =
          v.location.confidence === 'high'
            ? '🟢'
            : v.location.confidence === 'medium'
              ? '🟡'
              : '🔴';
        return `${conf} ${v.title.slice(0, 30)}<br/>${v.location.label}<br/>${status}`;
      },
    },
  };
}
