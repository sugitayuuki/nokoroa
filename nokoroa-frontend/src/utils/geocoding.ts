// 場所テキスト → 緯度経度の変換 (OpenStreetMap Nominatim)。
// 新規投稿フォームと投稿編集フォームで同じ結果になるよう、問い合わせはここに集約する。

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * 場所テキストをジオコーディングする。
 * @returns 該当する場所が無い場合は null。通信・レスポンス異常時は throw する。
 */
export const geocodeLocation = async (
  locationName: string,
  options: { signal?: AbortSignal } = {},
): Promise<GeocodeResult | null> => {
  const query = locationName.trim();
  if (!query) {
    return null;
  }

  const response = await fetch(
    `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ja`,
    { signal: options.signal },
  );

  if (!response.ok) {
    throw new Error('Geocoding failed');
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  // Nominatim はエラー時に配列でない JSON を返すことがある。
  // その場合 data[0] の分割代入で TypeError になり「throw する」契約から外れるため先に検証する
  if (!Array.isArray(data)) {
    throw new Error('Unexpected geocoding response');
  }

  if (data.length === 0) {
    return null;
  }

  const { lat, lon, display_name } = data[0];
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid coordinates returned');
  }

  return { latitude, longitude, displayName: display_name };
};
