export function buildJourneySummary(videos, playlistId, playlistUrl) {
  const prefectureStopsMap = new Map();
  const dinnerMap = new Map();
  const theoryMap = new Map();
  let shoppingTotal = 0;
  let spanAccumulator = 0;
  let spanCount = 0;

  const routePolyline = dedupePolyline(
    videos.flatMap((video) => {
      if (video.route.polyline.length > 0) {
        return video.route.polyline;
      }
      if (video.location.lat !== null && video.location.lng !== null) {
        return [[video.location.lng, video.location.lat]];
      }
      return [];
    }),
  );

  for (const video of videos) {
    if (video.location.prefecture) {
      const current = prefectureStopsMap.get(video.location.prefecture) ?? {
        prefecture: video.location.prefecture,
        count: 0,
        lat: video.location.lat,
        lng: video.location.lng,
      };
      current.count += 1;
      prefectureStopsMap.set(video.location.prefecture, current);
    }

    for (const food of video.dinner.foods) {
      dinnerMap.set(food, (dinnerMap.get(food) ?? 0) + 1);
    }
    for (const tag of video.fishingTheory.tags) {
      theoryMap.set(tag, (theoryMap.get(tag) ?? 0) + 1);
    }

    shoppingTotal += video.shopping.totalCostCny ?? 0;
    if (video.timeSpan.startTimeText && video.timeSpan.endTimeText) {
      spanAccumulator += 8;
      spanCount += 1;
    }
  }

  return {
    title: '老黄游钓中国旅程图谱',
    playlistId,
    playlistUrl,
    generatedAt: new Date().toISOString(),
    totalVideos: videos.length,
    coveredPrefectures: prefectureStopsMap.size,
    videosWithCatch: videos.filter((video) => video.fishing.caught === 'yes').length,
    videosWithUnknownCatch: videos.filter((video) => video.fishing.caught === 'unknown').length,
    skunkedVideos: videos.filter((video) => video.fishing.isSkunked === 'yes').length,
    videosWithUnknownSkunk: videos.filter((video) => video.fishing.isSkunked === 'unknown').length,
    totalShoppingCostCny: Number(shoppingTotal.toFixed(2)),
    averageActivitySpanHours: spanCount > 0 ? Number((spanAccumulator / spanCount).toFixed(1)) : 0,
    topDinnerFoods: topEntries(dinnerMap),
    topFishingTheoryTags: topEntries(theoryMap),
    prefectureStops: [...prefectureStopsMap.values()],
    routePolyline,
    mapViewport: buildMapViewport(routePolyline, videos),
  };
}

function dedupePolyline(points) {
  const result = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous && previous[0] === point[0] && previous[1] === point[1]) {
      continue;
    }
    result.push(point);
  }
  return result;
}

function topEntries(inputMap) {
  return [...inputMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));
}

function buildMapViewport(routePolyline, videos) {
  const points = routePolyline.length > 0
    ? routePolyline
    : videos
        .filter((video) => video.location.lng !== null && video.location.lat !== null)
        .map((video) => [video.location.lng, video.location.lat]);

  if (points.length === 0) {
    return undefined;
  }

  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }

  return {
    center: [Number(((west + east) / 2).toFixed(4)), Number(((south + north) / 2).toFixed(4))],
    zoom: inferViewportZoom(west, east, south, north),
    bounds: {
      west: Number((west - 0.4).toFixed(4)),
      south: Number((south - 0.3).toFixed(4)),
      east: Number((east + 0.4).toFixed(4)),
      north: Number((north + 0.3).toFixed(4)),
    },
  };
}

function inferViewportZoom(west, east, south, north) {
  const lngSpan = Math.abs(east - west);
  const latSpan = Math.abs(north - south);
  const span = Math.max(lngSpan, latSpan);

  if (span > 8) return 6;
  if (span > 4.5) return 7;
  if (span > 2.5) return 8;
  return 9;
}
