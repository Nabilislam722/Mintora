// Mock listings until the veHEMI marketplace contract is live
// [tokenId, HEMI locked, lock length (days), days left, price, payment token]
const MOCK = [
  [1042, 250000, 1460, 612, 8400, "USDC"], [877, 40000, 730, 95, 36800, "HEMI"], [2310, 1200000, 1460, 1390, 32000, "USDC"],
  [1503, 85000, 365, 40, 80100, "HEMI"], [388, 500000, 1095, 880, 15050, "USDC"], [2951, 15000, 180, 150, 11200, "HEMI"],
  [1199, 320000, 730, 330, 12050, "USDC"], [640, 72000, 1460, 1020, 40500, "HEMI"], [3077, 910000, 1095, 120, 842000, "HEMI"],
  [1764, 28000, 365, 290, 1095, "USDC"], [455, 160000, 1460, 1180, 92000, "HEMI"], [2208, 60000, 730, 640, 2050, "USDC"],
].map(([id, hemi, total, left, price, currency]) => ({ id, hemi, total, left, price, currency }));

export function useVeHemiListings() {
  return MOCK;
}

export function useVeHemiListing(id) {
  return MOCK.find((l) => String(l.id) === String(id));
}
