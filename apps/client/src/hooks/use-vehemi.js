// Mock listings until the veHEMI marketplace contract is live
// [tokenId, HEMI locked, lock length (days), days left, price in HEMI]
const MOCK = [
  [1042, 250000, 1460, 612, 168000], [877, 40000, 730, 95, 36800], [2310, 1200000, 1460, 1390, 640000],
  [1503, 85000, 365, 40, 80100], [388, 500000, 1095, 880, 301000], [2951, 15000, 180, 150, 11200],
  [1199, 320000, 730, 330, 241000], [640, 72000, 1460, 1020, 40500], [3077, 910000, 1095, 120, 842000],
  [1764, 28000, 365, 290, 21900], [455, 160000, 1460, 1180, 92000], [2208, 60000, 730, 640, 41000],
].map(([id, hemi, total, left, price]) => ({ id, hemi, total, left, price }));

export function useVeHemiListings() {
  return MOCK;
}

export function useVeHemiListing(id) {
  return MOCK.find((l) => String(l.id) === String(id));
}
