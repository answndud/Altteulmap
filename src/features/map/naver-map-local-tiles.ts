export type TilePoint = {
  x: number;
  y: number;
};

export type LocalFallbackTile = TilePoint & {
  key: string;
  left: string;
  top: string;
  url: string;
};

export const LOCAL_FALLBACK_TILE_SIZE = 256;
export const LOCAL_FALLBACK_TILE_ZOOM = 13;
export const LOCAL_FALLBACK_MIN_ZOOM = 11;
export const LOCAL_FALLBACK_MAX_ZOOM = 16;

const LOCAL_FALLBACK_TILE_RANGE_X = 5;
const LOCAL_FALLBACK_TILE_RANGE_Y = 4;

function clampTileY(tileY: number, zoom: number) {
  const maxTileIndex = 2 ** zoom - 1;

  return Math.max(0, Math.min(maxTileIndex, tileY));
}

function wrapTileX(tileX: number, zoom: number) {
  const tileCount = 2 ** zoom;

  return ((tileX % tileCount) + tileCount) % tileCount;
}

export function getTilePoint(
  point: { latitude: number; longitude: number },
  zoom: number,
): TilePoint {
  const scale = 2 ** zoom;
  const latRad = (point.latitude * Math.PI) / 180;

  return {
    x: ((point.longitude + 180) / 360) * scale,
    y:
      ((1 -
        Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
        2) *
      scale,
  };
}

export function getPointFromTilePoint(point: TilePoint, zoom: number) {
  const scale = 2 ** zoom;
  const longitude = (point.x / scale) * 360 - 180;
  const mercatorY = Math.PI * (1 - (2 * point.y) / scale);
  const latitude = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;

  return {
    latitude,
    longitude,
  };
}

export function getLocalFallbackTiles(
  center: { latitude: number; longitude: number },
  zoom: number,
): LocalFallbackTile[] {
  const centerTile = getTilePoint(center, zoom);
  const centerTileX = Math.floor(centerTile.x);
  const centerTileY = Math.floor(centerTile.y);
  const offsetX = (centerTile.x - centerTileX) * LOCAL_FALLBACK_TILE_SIZE;
  const offsetY = (centerTile.y - centerTileY) * LOCAL_FALLBACK_TILE_SIZE;
  const tiles: LocalFallbackTile[] = [];

  for (
    let yOffset = -LOCAL_FALLBACK_TILE_RANGE_Y;
    yOffset <= LOCAL_FALLBACK_TILE_RANGE_Y;
    yOffset += 1
  ) {
    for (
      let xOffset = -LOCAL_FALLBACK_TILE_RANGE_X;
      xOffset <= LOCAL_FALLBACK_TILE_RANGE_X;
      xOffset += 1
    ) {
      const rawX = centerTileX + xOffset;
      const x = wrapTileX(rawX, zoom);
      const y = clampTileY(centerTileY + yOffset, zoom);

      tiles.push({
        x,
        y,
        key: `${zoom}:${rawX}:${y}`,
        left: `calc(50% + ${(xOffset * LOCAL_FALLBACK_TILE_SIZE - offsetX).toFixed(2)}px)`,
        top: `calc(50% + ${(yOffset * LOCAL_FALLBACK_TILE_SIZE - offsetY).toFixed(2)}px)`,
        url: `https://basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`,
      });
    }
  }

  return tiles;
}
