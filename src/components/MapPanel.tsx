import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import { buildJourneyMapOption } from '../lib/echartsMap';
import type { VideoRecord } from '../types';

interface MapPanelProps {
  videos: VideoRecord[];
  selectedBvid: string;
  onSelectVideo: (bvid: string) => void;
  routePolyline: [number, number][];
  mapViewport?: {
    center: [number, number];
    zoom: number;
    bounds: { west: number; south: number; east: number; north: number };
  };
}

export function MapPanel({
  videos,
  selectedBvid,
  onSelectVideo,
  routePolyline,
  mapViewport,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    chartRef.current = echarts.init(containerRef.current, null, { renderer: 'canvas' });

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update chart when data changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.setOption(
      buildJourneyMapOption({ videos, selectedBvid, routePolyline, mapViewport }),
      true,
    );
  }, [videos, selectedBvid, routePolyline, mapViewport]);

  // Click handler for video selection
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleClick = (params: unknown) => {
      const item = params as { componentSubType?: string; data?: { bvid?: string } };
      if (item.data?.bvid) {
        onSelectVideo(item.data.bvid);
      }
    };

    chart.on('click', handleClick);
    return () => {
      chart.off('click', handleClick);
    };
  }, [onSelectVideo]);

  return (
    <section className="map-stage echarts-map-stage">
      <div ref={containerRef} className="echarts-map" aria-label="游钓旅程地图" />
    </section>
  );
}
