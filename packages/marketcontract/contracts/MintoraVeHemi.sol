// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IVeHemi} from "./interfaces/IVeHemi.sol";

/**
 * @title MintoraVeHemi
 * @notice Mintora's marketplace for veHEMI positions. Every listing and offer is priced and paid in HEMI.
 *
 * @dev Non-custodial: the contract never holds HEMI or NFTs. On a sale the buyer pays the seller and the
 *      fee recipient directly and the NFT moves straight from seller to buyer, so there is no balance to drain.
 *      The HEMI token is read from veHEMI itself, so it can't be configured wrong.
 *
 *      veHEMI positions can change after an order is made, so every order also records the position it was
 *      made for:
 *      - The owner can extend a lock (`increaseUnlockTime`). Orders record the lock end and won't fill if it
 *        moved, so a seller can't turn a 10-day lock into a 4-year one just before a sale lands.
 *      - Anyone can add HEMI to a lock (`increaseAmount`). That only makes the position worth more, so orders
 *        just require at least the amount that was recorded.
 *      - Positions that aren't transferable yet, and expired locks (which the owner can withdraw and burn),
 *        can't be traded.
 *
 *      Buyers and sellers also commit to an order id. Changing a listing or an offer gives it a new id, so
 *      neither side can change the terms while the other side's transaction is pending. `cancelAll` bumps the
 *      caller's nonce and kills every listing and offer they have, without a transaction per order.
 *
 *      Every function that calls another contract is nonReentrant, and storage is updated before any token
 *      moves. The NFT transfer (which calls the buyer's onERC721Received hook) is always the last call.
 */
contract MintoraVeHemi is
    Initializable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint64 expiry;
        uint16 feeBps; // fee when listed; a sale charges the lower of this and the current fee
        uint256 price; // in HEMI
        uint128 lockAmount; // HEMI locked when listed
        uint64 lockEnd; // lock end when listed
        uint64 id;
        uint64 nonce; // seller's nonce when listed
    }

    struct Offer {
        uint256 amount; // in HEMI
        uint128 minLockAmount; // HEMI locked when the offer was made
        uint64 maxLockEnd; // lock end when the offer was made
        uint64 expiry;
        uint64 nonce; // buyer's nonce when the offer was made
        uint64 id;
    }

    uint256 private constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 1_000; // 10%
    // How long a listing or offer stays open. The client's LISTING_DURATIONS must stay inside this range.
    uint256 public constant MIN_DURATION = 7 days;
    uint256 public constant MAX_DURATION = 90 days;

    IVeHemi public veHemi;
    IERC20 public hemi;
    address public feeRecipient;
    uint16 public feeBps;
    uint64 private _lastId; // shared by listings and offers

    mapping(address => uint64) public nonces;
    mapping(uint256 => Listing) private _listings;
    mapping(uint256 => mapping(address => Offer)) private _offers;

    event Listed(
        uint256 indexed tokenId,
        uint256 indexed listingId,
        address indexed seller,
        uint256 price,
        uint256 expiry,
        uint256 lockAmount,
        uint256 lockEnd
    );
    event ListingCanceled(uint256 indexed tokenId, uint256 indexed listingId, address indexed seller);
    event Sold(
        uint256 indexed tokenId,
        uint256 indexed listingId,
        address indexed seller,
        address buyer,
        uint256 price,
        uint256 fee
    );
    event OfferMade(
        uint256 indexed tokenId,
        uint256 indexed offerId,
        address indexed buyer,
        uint256 amount,
        uint256 expiry,
        uint256 minLockAmount,
        uint256 maxLockEnd
    );
    event OfferCanceled(uint256 indexed tokenId, uint256 indexed offerId, address indexed buyer);
    event OfferAccepted(
        uint256 indexed tokenId,
        uint256 indexed offerId,
        address indexed seller,
        address buyer,
        uint256 amount,
        uint256 fee
    );
    event NonceIncremented(address indexed account, uint256 nonce);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeeRecipientUpdated(address indexed recipient);

    error ZeroAddress();
    error FeeTooHigh();
    error InvalidPrice();
    error InvalidDuration();
    error NotTokenOwner();
    error NotApproved();
    error NotTransferable();
    error NotAuthorized();
    error LockExpired();
    error PositionChanged();
    error SelfTrade();
    error NotListed();
    error ListingChanged();
    error ListingExpired();
    error ListingInvalidated();
    error SellerNotOwner();
    error NoOffer();
    error OfferChanged();
    error OfferExpired();
    error OfferInvalidated();
    error InsufficientFunds();
    error TransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address veHemi_, address feeRecipient_, uint16 feeBps_) external initializer {
        if (veHemi_ == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        address hemi_ = IVeHemi(veHemi_).HEMI();
        if (hemi_ == address(0)) revert ZeroAddress();

        __Ownable_init(owner_);
        __Ownable2Step_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        veHemi = IVeHemi(veHemi_);
        hemi = IERC20(hemi_);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;

        emit FeeRecipientUpdated(feeRecipient_);
        emit FeeUpdated(0, feeBps_);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // LISTINGS

    /// @notice List a position for HEMI, or replace your listing for it. Approve this contract on veHEMI first.
    /// @param duration Seconds the listing stays open: 7 to 90 days (MIN_DURATION to MAX_DURATION).
    function list(uint256 tokenId, uint256 price, uint256 duration) external whenNotPaused nonReentrant returns (uint256 listingId) {
        if (price == 0) revert InvalidPrice();
        _checkDuration(duration);
        if (veHemi.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!_isApproved(msg.sender, tokenId)) revert NotApproved();
        if (!veHemi.isTransferable(tokenId)) revert NotTransferable();
        (uint128 lockAmount, uint64 lockEnd) = _lockOf(tokenId);
        if (lockEnd <= block.timestamp) revert LockExpired();

        // Replaces our own listing, or a stale one left by an earlier owner
        _clearListing(tokenId);

        uint64 id = ++_lastId;
        uint64 expiry = uint64(block.timestamp + duration);
        _listings[tokenId] = Listing({
            seller: msg.sender,
            expiry: expiry,
            feeBps: feeBps,
            price: price,
            lockAmount: lockAmount,
            lockEnd: lockEnd,
            id: id,
            nonce: nonces[msg.sender]
        });

        emit Listed(tokenId, id, msg.sender, price, expiry, lockAmount, lockEnd);
        return id;
    }

    /// @notice Buy a listed position. Approve this contract for the price in HEMI first.
    /// @param listingId The listing you're buying. Reverts if the seller has changed the listing since.
    function buy(uint256 tokenId, uint256 listingId) external whenNotPaused nonReentrant {
        Listing memory l = _listings[tokenId];
        if (l.seller == address(0)) revert NotListed();
        if (l.id != listingId) revert ListingChanged();
        if (block.timestamp >= l.expiry) revert ListingExpired();
        if (l.nonce != nonces[l.seller]) revert ListingInvalidated();
        if (msg.sender == l.seller) revert SelfTrade();
        if (veHemi.ownerOf(tokenId) != l.seller) revert SellerNotOwner();
        _checkPosition(tokenId, l.lockAmount, l.lockEnd);

        delete _listings[tokenId];
        // The buyer's own offer on this position is pointless now, and must not be fillable after they resell it
        _clearOffer(tokenId, msg.sender);

        uint256 fee = (l.price * Math.min(l.feeBps, feeBps)) / BPS;
        _settle(tokenId, l.seller, msg.sender, l.price, fee);

        emit Sold(tokenId, listingId, l.seller, msg.sender, l.price, fee);
    }

    /// @notice Cancel a listing. The position's current owner can also clear a listing left by an earlier owner.
    function cancelListing(uint256 tokenId) external nonReentrant {
        address seller = _listings[tokenId].seller;
        if (seller == address(0)) revert NotListed();
        if (msg.sender != seller && msg.sender != veHemi.ownerOf(tokenId)) revert NotAuthorized();
        _clearListing(tokenId);
    }

    /// @notice Cancel every listing and offer you have, in one transaction.
    function cancelAll() external {
        uint64 nonce = ++nonces[msg.sender];
        emit NonceIncremented(msg.sender, nonce);
    }

    // OFFERS

    /// @notice Offer HEMI for a position, listed or not. Replaces your offer on it, if you have one.
    /// @dev Nothing is escrowed: approve this contract for `amount` and the HEMI stays in your wallet until the
    ///      owner accepts. The offer only fills for this position as it is now (same unlock date, at least as
    ///      much HEMI).
    /// @param duration Seconds the offer stays open: 7 to 90 days (MIN_DURATION to MAX_DURATION).
    function makeOffer(uint256 tokenId, uint256 amount, uint256 duration) external whenNotPaused nonReentrant returns (uint256 offerId) {
        if (amount == 0) revert InvalidPrice();
        _checkDuration(duration);
        if (veHemi.ownerOf(tokenId) == msg.sender) revert SelfTrade();
        (uint128 lockAmount, uint64 lockEnd) = _lockOf(tokenId);
        if (lockEnd <= block.timestamp) revert LockExpired();
        if (hemi.balanceOf(msg.sender) < amount || hemi.allowance(msg.sender, address(this)) < amount) {
            revert InsufficientFunds();
        }

        _clearOffer(tokenId, msg.sender);

        uint64 id = ++_lastId;
        uint64 expiry = uint64(block.timestamp + duration);
        _offers[tokenId][msg.sender] = Offer({
            amount: amount,
            minLockAmount: lockAmount,
            maxLockEnd: lockEnd,
            expiry: expiry,
            nonce: nonces[msg.sender],
            id: id
        });

        emit OfferMade(tokenId, id, msg.sender, amount, expiry, lockAmount, lockEnd);
        return id;
    }

    /// @notice Sell your position to an offer. Approve this contract on veHEMI first. Cancels your listing for it.
    /// @param offerId The offer you're accepting. Reverts if the buyer has changed the offer since.
    function acceptOffer(uint256 tokenId, address buyer, uint256 offerId) external whenNotPaused nonReentrant {
        Offer memory o = _offers[tokenId][buyer];
        if (o.id == 0) revert NoOffer();
        if (o.id != offerId) revert OfferChanged();
        if (block.timestamp >= o.expiry) revert OfferExpired();
        if (o.nonce != nonces[buyer]) revert OfferInvalidated();
        if (buyer == msg.sender) revert SelfTrade();
        if (veHemi.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!veHemi.isTransferable(tokenId)) revert NotTransferable();
        _checkPosition(tokenId, o.minLockAmount, o.maxLockEnd);

        delete _offers[tokenId][buyer];
        _clearListing(tokenId);

        uint256 fee = (o.amount * feeBps) / BPS;
        _settle(tokenId, msg.sender, buyer, o.amount, fee);

        emit OfferAccepted(tokenId, offerId, msg.sender, buyer, o.amount, fee);
    }

    function cancelOffer(uint256 tokenId) external {
        if (_offers[tokenId][msg.sender].id == 0) revert NoOffer();
        _clearOffer(tokenId, msg.sender);
    }

    // VIEWS

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return _listings[tokenId];
    }

    function getOffer(uint256 tokenId, address buyer) external view returns (Offer memory) {
        return _offers[tokenId][buyer];
    }

    /// @notice Whether `buy` would succeed right now, apart from the buyer's own balance and allowance.
    function isListingValid(uint256 tokenId) external view returns (bool) {
        Listing memory l = _listings[tokenId];
        if (l.seller == address(0) || paused() || block.timestamp >= l.expiry) return false;
        if (l.nonce != nonces[l.seller]) return false;
        if (_ownerOrZero(tokenId) != l.seller || !_isApproved(l.seller, tokenId)) return false;
        if (!veHemi.isTransferable(tokenId)) return false;
        return _positionMatches(tokenId, l.lockAmount, l.lockEnd);
    }

    /// @notice Whether the position's owner could accept this offer right now, including the buyer's HEMI.
    function isOfferValid(uint256 tokenId, address buyer) external view returns (bool) {
        Offer memory o = _offers[tokenId][buyer];
        if (o.id == 0 || paused() || block.timestamp >= o.expiry) return false;
        if (o.nonce != nonces[buyer]) return false;
        address holder = _ownerOrZero(tokenId);
        if (holder == address(0) || holder == buyer || !veHemi.isTransferable(tokenId)) return false;
        if (hemi.balanceOf(buyer) < o.amount || hemi.allowance(buyer, address(this)) < o.amount) return false;
        return _positionMatches(tokenId, o.minLockAmount, o.maxLockEnd);
    }

    // OWNER

    function setFee(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        emit FeeRecipientUpdated(recipient);
    }

    /// @notice Stops new listings, offers and trades. Cancels still work while paused.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recover tokens sent here by mistake. Trades never leave tokens in this contract, so this can't
    ///         touch user funds.
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // INTERNAL

    function _settle(uint256 tokenId, address seller, address buyer, uint256 price, uint256 fee) private {
        if (fee > 0) hemi.safeTransferFrom(buyer, feeRecipient, fee);
        hemi.safeTransferFrom(buyer, seller, price - fee);
        // Last, because it calls the buyer's onERC721Received hook when the buyer is a contract
        veHemi.safeTransferFrom(seller, buyer, tokenId);
        if (veHemi.ownerOf(tokenId) != buyer) revert TransferFailed();
    }

    function _checkPosition(uint256 tokenId, uint128 minAmount, uint64 maxEnd) private view {
        (uint128 amount, uint64 end) = _lockOf(tokenId);
        if (end <= block.timestamp) revert LockExpired();
        // Lock ends only move later and amounts only grow, so these catch any change that hurts the buyer
        if (end > maxEnd || amount < minAmount) revert PositionChanged();
    }

    function _positionMatches(uint256 tokenId, uint128 minAmount, uint64 maxEnd) private view returns (bool) {
        (uint128 amount, uint64 end) = _lockOf(tokenId);
        return end > block.timestamp && end <= maxEnd && amount >= minAmount;
    }

    function _lockOf(uint256 tokenId) private view returns (uint128 amount, uint64 end) {
        IVeHemi.LockedBalance memory lock = veHemi.getLockedBalance(tokenId);
        return (lock.amount > 0 ? uint128(lock.amount) : 0, lock.end);
    }

    function _isApproved(address holder, uint256 tokenId) private view returns (bool) {
        return veHemi.getApproved(tokenId) == address(this) || veHemi.isApprovedForAll(holder, address(this));
    }

    /// @dev ownerOf reverts for burned (withdrawn) positions; the views report those as invalid instead.
    function _ownerOrZero(uint256 tokenId) private view returns (address) {
        try veHemi.ownerOf(tokenId) returns (address holder) {
            return holder;
        } catch {
            return address(0);
        }
    }

    function _clearListing(uint256 tokenId) private {
        Listing storage l = _listings[tokenId];
        if (l.seller == address(0)) return;
        emit ListingCanceled(tokenId, l.id, l.seller);
        delete _listings[tokenId];
    }

    function _clearOffer(uint256 tokenId, address buyer) private {
        uint64 id = _offers[tokenId][buyer].id;
        if (id == 0) return;
        emit OfferCanceled(tokenId, id, buyer);
        delete _offers[tokenId][buyer];
    }

    function _checkDuration(uint256 duration) private pure {
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();
    }
}
