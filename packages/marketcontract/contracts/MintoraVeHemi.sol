// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IVeHemi} from "./interfaces/IVeHemi.sol";

contract MintoraVeHemi is
    Initializable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IERC721Receiver
{
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint64 expiry;
        uint16 feeBps;
        uint256 price;
        uint128 lockAmount;
        uint64 lockEnd;
        uint64 id;
        uint64 nonce;
        uint128 maxLockAmount;
    }

    struct Offer {
        uint256 amount;
        uint128 minLockAmount;
        uint64 maxLockEnd;
        uint64 expiry;
        uint64 nonce;
        uint64 id;
        address seller;
    }

    uint256 private constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 1_000;
    uint256 public constant MIN_DURATION = 7 days;
    uint256 public constant MAX_DURATION = 90 days;

    IVeHemi public veHemi;
    IERC20 public hemi;
    address public feeRecipient;
    uint16 public feeBps;
    uint64 private _lastId;

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
        uint256 maxLockAmount,
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
        uint256 maxLockEnd,
        address seller
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
    error InvalidLockCap();
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
    error HolderChanged();
    error FeeAboveLimit();
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

    function list(uint256 tokenId, uint256 price, uint256 duration, uint128 maxLockAmount) external whenNotPaused nonReentrant returns (uint256 listingId) {
        if (price == 0) revert InvalidPrice();
        _checkDuration(duration);
        if (veHemi.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!veHemi.isTransferable(tokenId)) revert NotTransferable();
        (uint128 lockAmount, uint64 lockEnd) = _lockOf(tokenId);
        if (lockEnd <= block.timestamp) revert LockExpired();
        if (maxLockAmount < lockAmount) revert InvalidLockCap();

        _clearListing(tokenId);
        _clearOffer(tokenId, msg.sender);

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
            nonce: nonces[msg.sender],
            maxLockAmount: maxLockAmount
        });

        emit Listed(tokenId, id, msg.sender, price, expiry, lockAmount, maxLockAmount, lockEnd);
        return id;
    }

    function buy(uint256 tokenId, uint256 listingId) external whenNotPaused nonReentrant {
        Listing memory l = _listings[tokenId];
        if (l.seller == address(0)) revert NotListed();
        if (l.id != listingId) revert ListingChanged();
        if (block.timestamp >= l.expiry) revert ListingExpired();
        if (l.nonce != nonces[l.seller]) revert ListingInvalidated();
        if (msg.sender == l.seller) revert SelfTrade();
        if (veHemi.ownerOf(tokenId) != l.seller) revert SellerNotOwner();
        if (!veHemi.isTransferable(tokenId)) revert NotTransferable();
        if (!_isApproved(tokenId)) revert NotApproved();
        _checkPosition(tokenId, l.lockAmount, l.maxLockAmount, l.lockEnd);

        delete _listings[tokenId];
        _clearOffer(tokenId, msg.sender);

        uint256 fee = (l.price * Math.min(l.feeBps, feeBps)) / BPS;
        _settle(tokenId, l.seller, l.seller, msg.sender, l.price, fee);

        emit Sold(tokenId, listingId, l.seller, msg.sender, l.price, fee);
    }

    function cancelListing(uint256 tokenId) external nonReentrant {
        address seller = _listings[tokenId].seller;
        if (seller == address(0)) revert NotListed();
        if (msg.sender != seller && msg.sender != veHemi.ownerOf(tokenId)) revert NotAuthorized();
        _clearListing(tokenId);
    }

    function cancelAll() external {
        uint64 nonce = ++nonces[msg.sender];
        emit NonceIncremented(msg.sender, nonce);
    }

    function makeOffer(uint256 tokenId, uint256 amount, uint256 duration) external whenNotPaused nonReentrant returns (uint256 offerId) {
        if (amount == 0) revert InvalidPrice();
        _checkDuration(duration);
        address holder = veHemi.ownerOf(tokenId);
        if (holder == msg.sender) revert SelfTrade();
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
            id: id,
            seller: holder
        });

        emit OfferMade(tokenId, id, msg.sender, amount, expiry, lockAmount, lockEnd, holder);
        return id;
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        whenNotPaused
        nonReentrant
        returns (bytes4)
    {
        if (msg.sender != address(veHemi)) revert NotAuthorized();
        if (operator != from) revert NotTokenOwner();
        (address buyer, uint256 offerId, uint16 maxFeeBps) = abi.decode(data, (address, uint256, uint16));

        Offer memory o = _offers[tokenId][buyer];
        if (o.id == 0) revert NoOffer();
        if (o.id != offerId) revert OfferChanged();
        if (block.timestamp >= o.expiry) revert OfferExpired();
        if (o.nonce != nonces[buyer]) revert OfferInvalidated();
        if (feeBps > maxFeeBps) revert FeeAboveLimit();
        if (from != o.seller) revert HolderChanged();
        if (!veHemi.isTransferable(tokenId)) revert NotTransferable();
        _checkPosition(tokenId, o.minLockAmount, type(uint128).max, o.maxLockEnd);

        delete _offers[tokenId][buyer];
        _clearOffer(tokenId, from);
        _clearListing(tokenId);

        uint256 fee = (o.amount * feeBps) / BPS;
        _settle(tokenId, address(this), from, buyer, o.amount, fee);

        emit OfferAccepted(tokenId, offerId, from, buyer, o.amount, fee);
        return IERC721Receiver.onERC721Received.selector;
    }

    function cancelOffer(uint256 tokenId) external {
        if (_offers[tokenId][msg.sender].id == 0) revert NoOffer();
        _clearOffer(tokenId, msg.sender);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return _listings[tokenId];
    }

    function getOffer(uint256 tokenId, address buyer) external view returns (Offer memory) {
        return _offers[tokenId][buyer];
    }

    function isListingValid(uint256 tokenId) external view returns (bool) {
        Listing memory l = _listings[tokenId];
        if (l.seller == address(0) || paused() || block.timestamp >= l.expiry) return false;
        if (l.nonce != nonces[l.seller]) return false;
        if (_ownerOrZero(tokenId) != l.seller || !_isApproved(tokenId)) return false;
        if (!veHemi.isTransferable(tokenId)) return false;
        return _positionMatches(tokenId, l.lockAmount, l.maxLockAmount, l.lockEnd);
    }

    function isOfferValid(uint256 tokenId, address buyer) external view returns (bool) {
        Offer memory o = _offers[tokenId][buyer];
        if (o.id == 0 || paused() || block.timestamp >= o.expiry) return false;
        if (o.nonce != nonces[buyer]) return false;
        address holder = _ownerOrZero(tokenId);
        if (holder != o.seller || !veHemi.isTransferable(tokenId)) return false;
        if (hemi.balanceOf(buyer) < o.amount || hemi.allowance(buyer, address(this)) < o.amount) return false;
        return _positionMatches(tokenId, o.minLockAmount, type(uint128).max, o.maxLockEnd);
    }

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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    function _settle(uint256 tokenId, address holder, address seller, address buyer, uint256 price, uint256 fee) private {
        if (fee > 0) hemi.safeTransferFrom(buyer, feeRecipient, fee);
        hemi.safeTransferFrom(buyer, seller, price - fee);
        veHemi.safeTransferFrom(holder, buyer, tokenId);
        if (veHemi.ownerOf(tokenId) != buyer) revert TransferFailed();
    }

    function _checkPosition(uint256 tokenId, uint128 minAmount, uint128 maxAmount, uint64 maxEnd) private view {
        (uint128 amount, uint64 end) = _lockOf(tokenId);
        if (end <= block.timestamp) revert LockExpired();
        if (end > maxEnd || amount < minAmount || amount > maxAmount) revert PositionChanged();
    }

    function _positionMatches(uint256 tokenId, uint128 minAmount, uint128 maxAmount, uint64 maxEnd) private view returns (bool) {
        (uint128 amount, uint64 end) = _lockOf(tokenId);
        return end > block.timestamp && end <= maxEnd && amount >= minAmount && amount <= maxAmount;
    }

    function _lockOf(uint256 tokenId) private view returns (uint128 amount, uint64 end) {
        IVeHemi.LockedBalance memory lock = veHemi.getLockedBalance(tokenId);
        return (lock.amount > 0 ? uint128(lock.amount) : 0, lock.end);
    }

    function _isApproved(uint256 tokenId) private view returns (bool) {
        return veHemi.getApproved(tokenId) == address(this);
    }

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
