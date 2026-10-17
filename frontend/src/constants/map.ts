/**
 * Map style used on web and native. The default is OpenFreeMap's light Positron style (OpenStreetMap data),
 * which needs no API key. Set EXPO_PUBLIC_MAP_STYLE_URL to switch provider (for example a
 * MapTiler or Google-backed style) without code changes.
 */
export const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
