const UNSPLASH_PHOTOS = {
  stripClose: "photo-1545180607-96ace47778b9",
  stripApplication: "photo-1545180607-96ace47778b9",
  downlightCeiling: "photo-1771599141394-bc646d21cd61",
  downlightInterior: "photo-1770682527380-f750e9fab18a",
  floodlightStadium: "photo-1762445964939-123200d655ee",
  floodlightMast: "photo-1762445964939-123200d655ee",
  solarStreetlight: "photo-1772968927091-4ae5b3713f41",
  solarStreetlightRoad: "photo-1740805276608-ef60e2e468ba",
  highbayWarehouse: "photo-1715783058283-2e31a1cb7684",
  highbayFixture: "photo-1694875546238-67cb3596adf1",
  panelCeiling: "photo-1770682527380-f750e9fab18a",
} as const;

export type ProductImageKey = keyof typeof UNSPLASH_PHOTOS;

export function img(key: ProductImageKey, width = 1600) {
  const id = UNSPLASH_PHOTOS[key];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=${width}`;
}
