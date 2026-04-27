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
        uint256 reservePrice;
    }

    struct Offer {
        uint256 amount;
        uint256 expiry;
    }

    address public feeRecipient;
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    mapping(address => mapping(uint256 => mapping(address => Offer)))
        private s_offers;
    mapping(address => mapping(uint256 => Auction)) private s_auctions;
    mapping(address => RoyaltyOverride) private s_royaltyOverrides;
    mapping(address => uint256) public s_pendingWithdrawals;

    uint256 public constant MAX_ROYALTY = 3000;
    uint256 public marketplaceFee;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 private s_accumulatedFees;
    uint256 public constant BID_EXTENSION_THRESHOLD = 10 minutes;
    uint256 public constant BID_EXTENSION_DURATION = 10 minutes;
    uint256 public constant ROYALTY_GAS_STIPEND = 65_000;
    uint256 public constant AUCTION_GRACE_PERIOD = 7 days;
    bool public offersEnabled;
    bool public auctionsEnabled;
    uint256 public s_totalPendingWithdrawals;
    uint256 public s_totalEscrowedFunds;
    uint256[48] private __gap;

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
        uint256 amount,
        uint256 expiry
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
        uint256 endTime,
        uint256 reservePrice
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
    event AuctionExtended(
        address indexed nft,
        uint256 indexed tokenId,
        uint256 newEndTime
    );
    event OffersToggled(bool enabled);
    event AuctionsToggled(bool enabled);
    event FeeRecipientUpdated(address indexed recipient);
    event RoyaltyOverrideSet(
        address indexed nft,
        address indexed receiver,
        uint96 fee
    );
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);

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
        require(!s_auctions[nft][tokenId].active, "Active auction exists");

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

        _handlePayout(nft, tokenId, msg.value, listing.seller, false);

        IERC721(nft).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemSold(msg.sender, nft, tokenId, msg.value);
    }

    function cancelListing(
        address nft,
        uint256 tokenId
    ) external whenNotPaused {
        Listing memory listing = s_listings[nft][tokenId];
        require(listing.seller != address(0), "Not listed");

        address currentOwner = IERC721(nft).ownerOf(tokenId);
        require(
            msg.sender == listing.seller || msg.sender == currentOwner,
            "Not authorized"
        );

        delete s_listings[nft][tokenId];
        emit ItemCanceled(listing.seller, nft, tokenId);
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
        uint256 tokenId,
        uint256 deadline
    ) external payable nonReentrant offersActive whenNotPaused {
        require(deadline > block.timestamp, "Deadline in the past");
        require(
            IERC721(nft).ownerOf(tokenId) != msg.sender,
            "Cannot offer on own token"
        );
        require(msg.value > 0, "Offer > 0");
        Offer memory prior = s_offers[nft][tokenId][msg.sender];

        if (prior.amount > 0) {
            delete s_offers[nft][tokenId][msg.sender];
            s_totalEscrowedFunds -= prior.amount;
            s_pendingWithdrawals[msg.sender] += prior.amount;
            s_totalPendingWithdrawals += prior.amount;
        }
        s_totalEscrowedFunds += msg.value;
        s_offers[nft][tokenId][msg.sender] = Offer(msg.value, deadline);

        emit OfferMade(msg.sender, nft, tokenId, msg.value, deadline);
    }

    function cancelOffer(address nft, uint256 tokenId) external nonReentrant {
        Offer memory offer = s_offers[nft][tokenId][msg.sender];
        uint256 amount = offer.amount;
        require(amount > 0, "No offer");

        delete s_offers[nft][tokenId][msg.sender];
        s_totalEscrowedFunds -= amount;
        s_pendingWithdrawals[msg.sender] += amount;
        s_totalPendingWithdrawals += amount;

        emit OfferCanceled(msg.sender, nft, tokenId);
    }

    function acceptOffer(
        address nft,
        uint256 tokenId,
        address buyer
    ) external nonReentrant whenNotPaused {
        Offer memory offer = s_offers[nft][tokenId][buyer];
        uint256 amount = offer.amount;

        require(amount > 0, "No offer");
        require(block.timestamp <= offer.expiry, "Offer expired");
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
        s_totalEscrowedFunds -= amount;
        _handlePayout(nft, tokenId, amount, msg.sender, false);

        IERC721(nft).safeTransferFrom(msg.sender, buyer, tokenId);

        emit OfferAccepted(msg.sender, buyer, nft, tokenId, amount);
    }

    // AUCTIONS

    function createAuction(
        address nft,
        uint256 tokenId,
        uint256 duration,
        uint256 reservePrice
    ) external auctionsActive whenNotPaused {
        require(duration >= 1 hours, "Min 1 hour");
        require(duration <= 30 days, "Duration exceeding 30 days");
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "Not owner");
        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );
        require(!s_auctions[nft][tokenId].active, "Auction exists");

        Listing memory existingListing = s_listings[nft][tokenId];
        if (existingListing.seller != address(0)) {
            delete s_listings[nft][tokenId];
            emit ItemCanceled(existingListing.seller, nft, tokenId);
        }

        s_auctions[nft][tokenId] = Auction(
            msg.sender,
            0,
            address(0),
            block.timestamp + duration,
            true,
            reservePrice
        );

        emit AuctionCreated(
            msg.sender,
            nft,
            tokenId,
            block.timestamp + duration,
            reservePrice
        );
    }

    function cancelAuction(address nft, uint256 tokenId) external {
        Auction memory auction = s_auctions[nft][tokenId];
        require(auction.active, "Auction not found");
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
        require(auction.active, "Auction not found");
        require(block.timestamp < auction.endTime, "Ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(msg.value > 0, "Bid must be > 0");

        uint256 minIncrement = (auction.highestBid * 200) / FEE_DENOMINATOR;
        require(
            msg.value >= auction.highestBid + minIncrement,
            "Bid increment too low"
        );
        if (auction.highestBid == 0 && auction.reservePrice > 0) {
            require(msg.value >= auction.reservePrice, "Below reserve price");
        }

        if (auction.highestBid > 0) {
            s_pendingWithdrawals[auction.highestBidder] += auction.highestBid;
            s_totalPendingWithdrawals += auction.highestBid;
            s_totalEscrowedFunds -= auction.highestBid;
        }

        s_totalEscrowedFunds += msg.value;
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
        if (auction.endTime - block.timestamp < BID_EXTENSION_THRESHOLD) {
            auction.endTime += BID_EXTENSION_DURATION;
            emit AuctionExtended(nft, tokenId, auction.endTime);
        }
        emit BidPlaced(msg.sender, nft, tokenId, msg.value);
    }

    function finalizeAuction(
        address nft,
        uint256 tokenId
    ) external nonReentrant whenNotPaused {
        Auction memory auction = s_auctions[nft][tokenId];

        require(auction.active, "Not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        // Within grace period: only seller or winner
        // After grace period: anyone can call — acts like auto-finalize
        if (block.timestamp < auction.endTime + AUCTION_GRACE_PERIOD) {
            require(
                msg.sender == auction.seller ||
                    msg.sender == auction.highestBidder,
                "Not authorized"
            );
        }
        delete s_auctions[nft][tokenId];
        if (auction.highestBid > 0) {
            s_totalEscrowedFunds -= auction.highestBid;
        }
        // try/catch handles burned tokens — ownerOf reverts on non-existent tokenIds
        bool sellerStillOwns = false;
        try IERC721(nft).ownerOf(tokenId) returns (address owner) {
            sellerStillOwns = (owner == auction.seller);
        } catch {
            sellerStillOwns = false;
        }
        // Only check approvalIntact if token exists — getApproved reverts on burned tokens
        bool approvalIntact = sellerStillOwns &&
            (IERC721(nft).getApproved(tokenId) == address(this) ||
                IERC721(nft).isApprovedForAll(auction.seller, address(this)));

        if (auction.highestBid > 0 && sellerStillOwns && approvalIntact) {
            delete s_listings[nft][tokenId];
            _handlePayout(
                nft,
                tokenId,
                auction.highestBid,
                auction.seller,
                true
            );
            IERC721(nft).safeTransferFrom(
                auction.seller,
                auction.highestBidder,
                tokenId
            );
        } else if (auction.highestBid > 0) {
            // Seller burned/moved NFT or revoked approval — refund bidder
            s_pendingWithdrawals[auction.highestBidder] += auction.highestBid;
            s_totalPendingWithdrawals += auction.highestBid;
        }
        // Zero bids: auction cleaned up, listing untouched

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
        s_totalPendingWithdrawals -= amount;

        _safeTransferETH(msg.sender, amount);
    }

    // INTERNAL

    function _handlePayout(
        address nft,
        uint256 tokenId,
        uint256 price,
        address seller,
        bool isAuction
    ) internal {
        uint256 feeAmount = (price * marketplaceFee) / FEE_DENOMINATOR;
        uint256 royaltyAmount;
        address royaltyReceiver;

        RoyaltyOverride memory overrideData = s_royaltyOverrides[nft];
        if (overrideData.receiver != address(0) && overrideData.fee > 0) {
            royaltyAmount = (price * overrideData.fee) / FEE_DENOMINATOR;
            royaltyReceiver = overrideData.receiver;
        } else if (_supportsRoyalty(nft)) {
            try IERC2981(nft).royaltyInfo(tokenId, price) returns (
                address receiver,
                uint256 amount
            ) {
                if (receiver != address(0)) {
                    royaltyReceiver = receiver;
                    royaltyAmount = amount;
                    uint256 royaltyCap = (price * MAX_ROYALTY) /
                        FEE_DENOMINATOR;
                    if (royaltyAmount > royaltyCap) royaltyAmount = royaltyCap;
                }
            } catch {}
        }

        require(feeAmount + royaltyAmount <= price, "Fees exceed price");

        s_accumulatedFees += feeAmount;

        uint256 sellerProceeds = price - feeAmount - royaltyAmount;

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltyOk, ) = royaltyReceiver.call{
                value: royaltyAmount,
                gas: ROYALTY_GAS_STIPEND
            }("");
            if (!royaltyOk) {
                s_pendingWithdrawals[royaltyReceiver] += royaltyAmount;
                s_totalPendingWithdrawals += royaltyAmount;
            }
        }

        if (isAuction) {
            s_pendingWithdrawals[seller] += sellerProceeds;
            s_totalPendingWithdrawals += sellerProceeds;
        } else {
            (bool sellerOk, ) = seller.call{value: sellerProceeds}("");
            if (!sellerOk) {
                s_pendingWithdrawals[seller] += sellerProceeds;
                s_totalPendingWithdrawals += sellerProceeds;
            }
        }
    }

    function _refundAuctionBidder(address nft, uint256 tokenId) internal {
        Auction storage auction = s_auctions[nft][tokenId];
        if (auction.active && auction.highestBid > 0) {
            uint256 amount = auction.highestBid;
            s_pendingWithdrawals[auction.highestBidder] += amount;
            s_totalPendingWithdrawals += amount;
            s_totalEscrowedFunds -= amount; // Move from Escrow to Pending
            auction.highestBid = 0; // Clear it to prevent double-accounting
        }
    }

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");

        require(success, "ETH transfer failed");
    }

    // Owner

    function setOffersEnabled(bool enabled) external onlyOwner {
        offersEnabled = enabled;
        emit OffersToggled(enabled);
    }

    function setAuctionsEnabled(bool enabled) external onlyOwner {
        auctionsEnabled = enabled;
        emit AuctionsToggled(enabled);
    }
    function setFeeRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "Zero address");
        feeRecipient = recipient;
        emit FeeRecipientUpdated(recipient);
    }

    function accumulatedFees() external view onlyOwner returns (uint256) {
        return s_accumulatedFees;
    }
    function withdrawFees() external onlyOwner {
        require(feeRecipient != address(0), "Fee recipient not set");
        uint256 amount = s_accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        s_accumulatedFees = 0;

        (bool ok, ) = feeRecipient.call{value: amount}("");
        if (!ok) {
            s_pendingWithdrawals[feeRecipient] += amount;
            s_totalPendingWithdrawals += amount;
        }
    }

    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 2000, "Max 20%");
        emit MarketplaceFeeUpdated(marketplaceFee, newFee);
        marketplaceFee = newFee;
    }
    /**
     * @notice Recovers STUCK ETH only.
     * @dev Calculates total locked funds (fees + user withdrawals) and only allows
     * withdrawing the surplus (funds that have no internal accounting).
     */
    function rescueETH(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");

        // lockedFunds components — UPDATE THIS SUM in any future upgrade
        // that adds a new escrow pool:
        //   s_accumulatedFees       = unclaimed marketplace fees
        //   s_totalPendingWithdrawals = outbid refunds + seller proceeds (auctions)
        //   s_totalEscrowedFunds    = active bids + active offers
        uint256 lockedFunds = s_accumulatedFees +
            s_totalPendingWithdrawals +
            s_totalEscrowedFunds;
        uint256 contractBalance = address(this).balance;

        require(contractBalance >= lockedFunds, "Insolvent state");
        uint256 safeWithdrawable = contractBalance - lockedFunds;

        require(amount <= safeWithdrawable, "Amount cuts into user funds");
        require(amount > 0, "No stuck ETH to rescue");

        _safeTransferETH(to, amount);
    }
    function setRoyaltyOverride(
        address nft,
        address receiver,
        uint96 fee
    ) external onlyOwner {
        require(fee <= 1000, "Max 10%");
        if (fee > 0) require(receiver != address(0), "Zero receiver");
        s_royaltyOverrides[nft] = RoyaltyOverride(receiver, fee);
        emit RoyaltyOverrideSet(nft, receiver, fee);
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
