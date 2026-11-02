import { parseAbi } from "viem";

// Subset of hemilabs/veHEMI VeHemi.sol (ERC721Enumerable)
export const VE_HEMI_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function getLockedBalance(uint256 tokenId) view returns ((int128 amount, uint64 end))",
  // Epoch 1 is the checkpoint written when the lock was created
  "function getUserPoint(uint256 tokenId, uint256 epoch) view returns (((int128 bias, int128 slope, uint64 timestamp, uint64 blockNumber, uint128 amount, uint256 fixedBias) point, address owner))",
  "function balanceOfNFT(uint256 tokenId) view returns (uint256)",
  "function isTransferable(uint256 tokenId) view returns (bool)",
  "function approve(address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
]);

// MintoraVeHemi (packages/marketcontract/contracts/MintoraVeHemi.sol)
export const MARKET_ABI = parseAbi([
  "struct Listing { address seller; uint64 expiry; uint16 feeBps; uint256 price; uint128 lockAmount; uint64 lockEnd; uint64 id; uint64 nonce; uint128 maxLockAmount; }",
  "struct Offer { uint256 amount; uint128 minLockAmount; uint64 maxLockEnd; uint64 expiry; uint64 nonce; uint64 id; address seller; }",
  "function hemi() view returns (address)",
  "function feeBps() view returns (uint16)",
  "function paused() view returns (bool)",
  "function nonces(address account) view returns (uint64)",
  "function getListing(uint256 tokenId) view returns (Listing)",
  "function getOffer(uint256 tokenId, address buyer) view returns (Offer)",
  "function isListingValid(uint256 tokenId) view returns (bool)",
  "function isOfferValid(uint256 tokenId, address buyer) view returns (bool)",
  "function list(uint256 tokenId, uint256 price, uint256 duration, uint128 maxLockAmount) returns (uint256)",
  "function buy(uint256 tokenId, uint256 listingId)",
  "function cancelListing(uint256 tokenId)",
  "function makeOffer(uint256 tokenId, uint256 amount, uint256 duration) returns (uint256)",
  "function cancelOffer(uint256 tokenId)",
  "event Listed(uint256 indexed tokenId, uint256 indexed listingId, address indexed seller, uint256 price, uint256 expiry, uint256 lockAmount, uint256 maxLockAmount, uint256 lockEnd)",
  "event OfferMade(uint256 indexed tokenId, uint256 indexed offerId, address indexed buyer, uint256 amount, uint256 expiry, uint256 minLockAmount, uint256 maxLockEnd, address seller)",
  // The contract's errors, plus the ones its dependencies can bubble up, so failed transactions can be explained
  "error ZeroAddress()",
  "error FeeTooHigh()",
  "error InvalidPrice()",
  "error InvalidDuration()",
  "error InvalidLockCap()",
  "error NotTokenOwner()",
  "error NotApproved()",
  "error NotTransferable()",
  "error NotAuthorized()",
  "error LockExpired()",
  "error PositionChanged()",
  "error SelfTrade()",
  "error NotListed()",
  "error ListingChanged()",
  "error ListingExpired()",
  "error ListingInvalidated()",
  "error SellerNotOwner()",
  "error NoOffer()",
  "error OfferChanged()",
  "error OfferExpired()",
  "error OfferInvalidated()",
  "error HolderChanged()",
  "error FeeAboveLimit()",
  "error InsufficientFunds()",
  "error TransferFailed()",
  "error EnforcedPause()",
  "error ReentrancyGuardReentrantCall()",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
]);

export const MARKET_ERRORS = MARKET_ABI.filter((item) => item.type === "error");
export const LISTED_EVENT = MARKET_ABI.find((item) => item.type === "event" && item.name === "Listed");
export const OFFER_MADE_EVENT = MARKET_ABI.find((item) => item.type === "event" && item.name === "OfferMade");
