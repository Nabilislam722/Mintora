// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract Mintora is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    struct Listing {
        address seller;
        uint256 price;
    }

    struct RoyaltyOverride {
        address receiver;
        uint96 fee;
    }

    struct Auction {
        address seller;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool active;
    }

    address public feeRecipient;
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        private s_offers;
    mapping(address => mapping(uint256 => Auction)) private s_auctions;
    mapping(address => RoyaltyOverride) private s_royaltyOverrides;
    mapping(address => uint256) public s_pendingWithdrawals;

    uint256 public constant MAX_ROYALTY = 3000;
    uint256 public marketplaceFee;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 private s_accumulatedFees;

    bool public offersEnabled;
    bool public auctionsEnabled;
    uint256[50] private __gap;

    
    event ItemListed(
        address indexed seller,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemSold(
        address indexed buyer,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 price
    );
    event OfferMade(
        address indexed buyer,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 amount
    );
    event OfferCanceled(
        address indexed buyer,
        address indexed nft,
        uint256 indexed tokenId
    );
    event OfferAccepted(
        address indexed seller,
        address indexed buyer,
        address indexed nft,
        uint256 tokenId,
        uint256 amount
    );
    event AuctionCreated(
        address indexed seller,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 duration
    );
    event AuctionCanceled(
        address indexed seller,
        address indexed nft,
        uint256 indexed tokenId
    );
    event BidPlaced(
        address indexed bidder,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 amount
    );
    event AuctionFinalized(
        address indexed winner,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 amount
    );
    event ItemCanceled(
        address indexed seller,
        address indexed nft,
        uint256 indexed tokenId
    );
    event ItemUpdated(
        address indexed seller,
        address indexed nft,
        uint256 indexed tokenId,
        uint256 newPrice
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();

        feeRecipient = msg.sender;
        marketplaceFee = 500;
        offersEnabled = false;
        auctionsEnabled = false;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // LISTING

    function listItem(
        address nft,
        uint256 tokenId,
        uint256 price
    ) external whenNotPaused {
        require(price > 0, "Price > 0");
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "Not owner");

        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );

        s_listings[nft][tokenId] = Listing(msg.sender, price);

        emit ItemListed(msg.sender, nft, tokenId, price);
    }

    function buyItem(
        address nft,
        uint256 tokenId
    ) external payable nonReentrant whenNotPaused {
        Listing memory listing = s_listings[nft][tokenId];

        require(listing.price > 0, "Not listed");
        require(msg.value == listing.price, "Wrong ETH");
        require(msg.sender != listing.seller, "Self-buy forbidden");
        require(
            IERC721(nft).ownerOf(tokenId) == listing.seller,
            "Seller not owner"
        );
        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(listing.seller, address(this)),
            "Approval revoked"
        );
        _refundAuctionBidder(nft, tokenId);
        delete s_listings[nft][tokenId];
        delete s_auctions[nft][tokenId];

        _handlePayout(nft, tokenId, msg.value, listing.seller);

        IERC721(nft).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemSold(msg.sender, nft, tokenId, msg.value);
    }

    function cancelListing(
        address nft,
        uint256 tokenId
    ) external whenNotPaused {
        Listing memory listing = s_listings[nft][tokenId];

        require(listing.seller != address(0), "Not listed");
        require(listing.seller == msg.sender, "Not seller");
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "No longer owner");

        delete s_listings[nft][tokenId];

        emit ItemCanceled(msg.sender, nft, tokenId);
    }

    function updateListing(
        address nft,
        uint256 tokenId,
        uint256 newPrice
    ) external whenNotPaused {
        require(newPrice > 0, "Price > 0");

        Listing storage listing = s_listings[nft][tokenId];

        require(listing.seller != address(0), "Not listed");
        require(listing.seller == msg.sender, "Not seller");
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "No longer owner");

        listing.price = newPrice;

        emit ItemUpdated(msg.sender, nft, tokenId, newPrice);
    }

    function getListing(
        address nft,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return s_listings[nft][tokenId];
    }

    // OFFERS & AUCTIONS

    modifier offersActive() {
        require(offersEnabled, "Offers disabled");
        _;
    }

    modifier auctionsActive() {
        require(auctionsEnabled, "Auctions disabled");
        _;
    }

    function makeOffer(
        address nft,
        uint256 tokenId
    ) external payable nonReentrant offersActive whenNotPaused {
        require(msg.value > 0, "Offer > 0");

        s_offers[nft][tokenId][msg.sender] += msg.value;

        emit OfferMade(msg.sender, nft, tokenId, msg.value);
    }

    function cancelOffer(address nft, uint256 tokenId) external nonReentrant {
        uint256 amount = s_offers[nft][tokenId][msg.sender];

        require(amount > 0, "No offer");

        delete s_offers[nft][tokenId][msg.sender];

        _safeTransferETH(msg.sender, amount);

        emit OfferCanceled(msg.sender, nft, tokenId);
    }

    function acceptOffer(
        address nft,
        uint256 tokenId,
        address buyer
    ) external nonReentrant offersActive whenNotPaused {
        uint256 amount = s_offers[nft][tokenId][buyer];

        require(amount > 0, "No offer");
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "Not owner");
        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );

        _refundAuctionBidder(nft, tokenId);
        delete s_offers[nft][tokenId][buyer];
        delete s_listings[nft][tokenId];
        delete s_auctions[nft][tokenId];

        _handlePayout(nft, tokenId, amount, msg.sender);

        IERC721(nft).safeTransferFrom(msg.sender, buyer, tokenId);

        emit OfferAccepted(msg.sender, buyer, nft, tokenId, amount);
    }

    // AUCTIONS

    function createAuction(
        address nft,
        uint256 tokenId,
        uint256 duration
    ) external auctionsActive whenNotPaused {
        require(duration > 0, "Invalid duration");
        require(duration >= 1 hours, "Min 1 hour");
        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "Not owner");
        require(!s_auctions[nft][tokenId].active, "Auction exists");
        require(duration <= 30 days, "Duration exceeding 30 days");

        s_auctions[nft][tokenId] = Auction(
            msg.sender,
            0,
            address(0),
            block.timestamp + duration,
            true
        );

        emit AuctionCreated(msg.sender, nft, tokenId, duration);
    }

    function cancelAuction(
        address nft,
        uint256 tokenId
    ) external whenNotPaused auctionsActive {
        Auction memory auction = s_auctions[nft][tokenId];
        require(auction.active, "No auction");
        require(auction.seller == msg.sender, "Not seller");
        require(auction.highestBid == 0, "Bids exist");

        delete s_auctions[nft][tokenId];
        emit AuctionCanceled(msg.sender, nft, tokenId);
    }

    function placeBid(
        address nft,
        uint256 tokenId
    ) external payable nonReentrant auctionsActive whenNotPaused {
        Auction storage auction = s_auctions[nft][tokenId];
        // minimum 2% increment
        require(auction.active, "Not active");
        require(block.timestamp < auction.endTime, "Ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(msg.value > 0, "Bid must be > 0");
        uint256 minIncrement = (auction.highestBid * 200) / FEE_DENOMINATOR;
        require(
            msg.value >= auction.highestBid + minIncrement,
            "Bid increment too low"
        );

        if (auction.highestBid > 0) {
            s_pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        emit BidPlaced(msg.sender, nft, tokenId, msg.value);
    }

    function finalizeAuction(
        address nft,
        uint256 tokenId
    ) external nonReentrant auctionsActive whenNotPaused {
        Auction memory auction = s_auctions[nft][tokenId];

        require(
            msg.sender == auction.seller || msg.sender == auction.highestBidder,
            "Not authorized"
        );
        require(auction.active, "Not active");
        require(block.timestamp >= auction.endTime, "Not ended");
        require(
            IERC721(nft).ownerOf(tokenId) == auction.seller,
            "Seller not owner"
        );
        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(auction.seller, address(this)),
            "Not approved"
        );

        delete s_auctions[nft][tokenId];
        delete s_listings[nft][tokenId];

        if (auction.highestBid > 0) {
            _handlePayout(nft, tokenId, auction.highestBid, auction.seller);

            IERC721(nft).safeTransferFrom(
                auction.seller,
                auction.highestBidder,
                tokenId
            );
        }

        emit AuctionFinalized(
            auction.highestBidder,
            nft,
            tokenId,
            auction.highestBid
        );
    }

    // WITHDRAW FOR OUTBID BIDDERS

    function withdrawRefund() external nonReentrant {
        uint256 amount = s_pendingWithdrawals[msg.sender];

        require(amount > 0, "Nothing to withdraw");

        s_pendingWithdrawals[msg.sender] = 0;

        _safeTransferETH(msg.sender, amount);
    }

    // INTERNAL

    function _handlePayout(
        address nft,
        uint256 tokenId,
        uint256 price,
        address seller
    ) internal {
        uint256 feeAmount = (price * marketplaceFee) / FEE_DENOMINATOR;
        uint256 royaltyAmount;
        address royaltyReceiver;

        RoyaltyOverride memory overrideData = s_royaltyOverrides[nft];

        if (overrideData.receiver != address(0) && overrideData.fee > 0) {
            royaltyAmount = (price * overrideData.fee) / FEE_DENOMINATOR;
            royaltyReceiver = overrideData.receiver;
        } else if (_supportsRoyalty(nft)) {
            (royaltyReceiver, royaltyAmount) = IERC2981(nft).royaltyInfo(
                tokenId,
                price
            );
            uint256 royaltyCap = (price * MAX_ROYALTY) / FEE_DENOMINATOR;
            if (royaltyAmount > royaltyCap) {
                royaltyAmount = royaltyCap;
            }
        }

        require(feeAmount + royaltyAmount <= price, "Fees exceed Price");

        s_accumulatedFees += feeAmount;

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            s_pendingWithdrawals[royaltyReceiver] += royaltyAmount;
        }
        _safeTransferETH(seller, price - feeAmount - royaltyAmount);
    }

    function _refundAuctionBidder(address nft, uint256 tokenId) internal {
        Auction storage auction = s_auctions[nft][tokenId];
        if (auction.active && auction.highestBid > 0) {
            s_pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }
    }

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");

        require(success, "ETH transfer failed");
    }

    // Owner

    function setOffersEnabled(bool enabled) external onlyOwner {
        offersEnabled = enabled;
    }

    function setAuctionsEnabled(bool enabled) external onlyOwner {
        auctionsEnabled = enabled;
    }
    function setFeeRecipient(address recipient) external onlyOwner {
        require(recipient != address(0));
        feeRecipient = recipient;
    }

    function withdrawFees() external onlyOwner {
        require(feeRecipient != address(0), "Fee recipient not set");
        uint256 amount = s_accumulatedFees;
        s_accumulatedFees = 0;
        _safeTransferETH(feeRecipient, amount);
    }

    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 2000, "Max 20%");

        marketplaceFee = newFee;
    }
    function setRoyaltyOverride(
        address nft,
        address receiver,
        uint96 fee
    ) external onlyOwner {
        require(fee <= 1000, "Max 10%");
        s_royaltyOverrides[nft] = RoyaltyOverride(receiver, fee);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _supportsRoyalty(address nft) internal view returns (bool) {
        try IERC165(nft).supportsInterface(type(IERC2981).interfaceId) returns (
            bool supported
        ) {
            return supported;
        } catch {
            return false;
        }
    }
}
