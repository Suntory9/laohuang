export function refineVideoLocations(videos) {
  const refined = videos.map((video) => ({
    ...video,
    location: {
      ...video.location,
      evidence: [...video.location.evidence],
    },
    route: {
      ...video.route,
      polyline: [...video.route.polyline],
    },
  }));

  for (let index = 0; index < refined.length; index += 1) {
    const current = refined[index];
    if (!needsLocationInference(current)) {
      continue;
    }

    const previousKnown = findNearestKnown(refined, index, -1);
    const nextKnown = findNearestKnown(refined, index, 1);
    const inferred = chooseInference(current, previousKnown, nextKnown);
    if (!inferred) {
      continue;
    }

    current.location = {
      ...current.location,
      label: inferred.label,
      province: inferred.province,
      city: inferred.city,
      district: inferred.district,
      prefecture: inferred.prefecture,
      county: inferred.county,
      poi: inferred.poi,
      lat: inferred.lat,
      lng: inferred.lng,
      confidence: 'low',
      evidence: [
        ...current.location.evidence,
        {
          source: 'sequence-inference',
          quote: inferred.reason,
        },
      ],
    };
  }

  for (let index = 0; index < refined.length; index += 1) {
    const current = refined[index];
    const previous = index > 0 ? refined[index - 1] : null;
    if (
      previous &&
      current.location.lat !== null &&
      current.location.lng !== null &&
      previous.location.lat !== null &&
      previous.location.lng !== null
    ) {
      current.route = {
        fromLabel: previous.location.label,
        toLabel: current.location.label,
        distanceKm: roughDistance(
          previous.location.lat,
          previous.location.lng,
          current.location.lat,
          current.location.lng,
        ),
        polyline: [
          [previous.location.lng, previous.location.lat],
          [current.location.lng, current.location.lat],
        ],
        method: 'inferred-sequential',
      };
    }
  }

  return refined;
}

function needsLocationInference(video) {
  return video.location.prefecture === null || video.location.label === '未在视频中明确提及' || video.location.label === '湖北省';
}

function findNearestKnown(videos, startIndex, direction) {
  let cursor = startIndex + direction;
  while (cursor >= 0 && cursor < videos.length) {
    const candidate = videos[cursor];
    if (candidate.location.prefecture !== null && candidate.location.label !== '湖北省') {
      return candidate.location;
    }
    cursor += direction;
  }
  return null;
}

function chooseInference(current, previousKnown, nextKnown) {
  if (previousKnown && nextKnown && previousKnown.prefecture === nextKnown.prefecture) {
    return {
      ...preferMoreSpecific(previousKnown, nextKnown),
      reason: `前后相邻视频都落在 ${previousKnown.prefecture} 一带，按连续旅程推断当前位置沿用同城节点。`,
    };
  }

  if (mentionsContinuation(current.title) && previousKnown) {
    return {
      ...previousKnown,
      reason: `标题呈现连续叙事，沿用上一条已知地点 ${previousKnown.label}。`,
    };
  }

  if ((mentionsArrival(current.title) || mentionsProvinceOnly(current.title)) && nextKnown) {
    return {
      ...nextKnown,
      reason: `标题仅说明到达省域，结合下一条已知地点 ${nextKnown.label} 推断当前停留点。`,
    };
  }

  if (nextKnown && !previousKnown) {
    return {
      ...nextKnown,
      reason: `前序缺少有效地点，采用最近的后续已知地点 ${nextKnown.label} 作为低置信度推断。`,
    };
  }

  if (previousKnown) {
    return {
      ...previousKnown,
      reason: `缺少明确地点词，采用最近的前序已知地点 ${previousKnown.label} 作为低置信度推断。`,
    };
  }

  return null;
}

function preferMoreSpecific(left, right) {
  const leftScore = specificity(left);
  const rightScore = specificity(right);
  return leftScore >= rightScore ? left : right;
}

function specificity(location) {
  return [location.prefecture, location.district, location.poi].filter(Boolean).length;
}

function mentionsContinuation(title) {
  return /(继续|被困|原地|入住|搞生活|扎营|躲避|出发)/.test(title);
}

function mentionsArrival(title) {
  return /(来到|到达|终于可以|正式开始)/.test(title);
}

function mentionsProvinceOnly(title) {
  return /游钓湖北|来到湖北|到达湖北/.test(title);
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
