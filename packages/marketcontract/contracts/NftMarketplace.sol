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
        uint8 extensionCount;
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

    uint8 public constant MAX_BID_EXTENSIONS = 12;
    uint256 public constant MAX_ROYALTY = 3000;
    uint256 public marketplaceFee;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 private s_accumulatedFees;
    uint256 public constant BID_EXTENSION_THRESHOLD = 10 minutes;
    uint256 public constant BID_EXTENSION_DURATION = 10 minutes;
    uint256 public constant ROYALTY_GAS_STIPEND = 200_000;
    uint256 public constant AUCTION_GRACE_PERIOD = 7 days;
    uint256 public constant MIN_RESERVE_FLOOR = 0.01 ether;
    uint256 public constant OWNER_OF_GAS_STIPEND = 100_000;
    uint256 public constant GRIEF_SLASH_BPS = 1_000; // 10% penelty for Grief
    bool public offersEnabled;
    bool public auctionsEnabled;
    uint256 public s_totalPendingWithdrawals;
    uint256 public s_totalEscrowedFunds;

    mapping(address => uint256) public s_ownerOfSkipCount;
    uint256[47] private __gap;

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
        uint256 amount,
        bool transferred
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
    event OwnerOfVerificationSkipped(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed bidder
    );
    event FinalizationFailed(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed bidder,
        bytes32 reason // "LyingNFT" or "BidderGrief"
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
    event StuckPendingSwept(address indexed to, uint256 amount);

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
        require(uint160(nft) > 0x9, "Precompile not allowed");
        require(price > 0, "Price > 0");
        require(_getOwnerSafely(nft, tokenId) == msg.sender, "Not owner");
        require(_isApprovedSafely(nft, tokenId, msg.sender), "Not approved");

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
            _getOwnerSafely(nft, tokenId) == listing.seller,
            "Seller not owner"
        );
        require(
            _isApprovedSafely(nft, tokenId, listing.seller),
            "Approval revoked"
        );
        require(!s_auctions[nft][tokenId].active, "Auction active");

        _refundAuctionBidder(nft, tokenId);
        delete s_listings[nft][tokenId];
        delete s_auctions[nft][tokenId];

        bool transferCallOk;
        bytes memory transferData = abi.encodeWithSelector(
            bytes4(0x42842e0e), // safeTransferFrom(address,address,uint256)
            listing.seller,
            msg.sender,
            tokenId
        );
        assembly {
            transferCallOk := call(
                gas(),
                nft,
                0,
                add(transferData, 0x20),
                mload(transferData),
                0,
                0 // retSize = 0, gas-bomb impossible
            )
        }

        require(
            transferCallOk && _getOwnerSafely(nft, tokenId) == msg.sender,
            "Transfer failed"
        );

        _handlePayout(nft, tokenId, msg.value, listing.seller, false);

        emit ItemSold(msg.sender, nft, tokenId, msg.value);
    }

    function cancelListing(
        address nft,
        uint256 tokenId
    ) external whenNotPaused {
        Listing memory listing = s_listings[nft][tokenId];
        require(listing.seller != address(0), "Not listed");
        require(msg.sender == listing.seller, "Not seller");

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
        require(_getOwnerSafely(nft, tokenId) == msg.sender, "No longer owner");

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
        require(uint160(nft) > 0x9, "Precompile not allowed");
        require(deadline > block.timestamp, "Deadline in the past");
        require(
            _getOwnerSafely(nft, tokenId) != msg.sender,
            "Cannot offer on own token"
        );
        require(
            _getOwnerSafely(nft, tokenId) != address(0),
            "NFT does not exist"
        );
        require(msg.value > 0, "Offer > 0");
        Offer memory prior = s_offers[nft][tokenId][msg.sender];

        if (prior.amount > 0) {
            revert("Offer already exists; cancel first");
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
        address buyer,
        uint256 expectedAmount
    ) external nonReentrant whenNotPaused {
        Offer memory offer = s_offers[nft][tokenId][buyer];
        uint256 amount = offer.amount;

        require(offer.amount == expectedAmount, "Offer amount changed");
        require(amount > 0, "No offer");
        require(block.timestamp <= offer.expiry, "Offer expired");
        require(_getOwnerSafely(nft, tokenId) == msg.sender, "Not owner");
        require(_isApprovedSafely(nft, tokenId, msg.sender), "Not approved");
        require(!s_auctions[nft][tokenId].active, "Auction active");

        _refundAuctionBidder(nft, tokenId);
        delete s_offers[nft][tokenId][buyer];
        Listing memory existingListing = s_listings[nft][tokenId];
        if (existingListing.seller != address(0)) {
            // Guard: if the SAME seller has a listing priced BELOW the offer,
            // a searcher can front-run with buyItem then accept the offer themselves.
            // Force the seller to resolve the conflict explicitly before accepting.
            require(
                !(existingListing.seller == msg.sender &&
                    existingListing.price < amount),
                "Cancel listing first: price undercuts offer"
            );
            delete s_listings[nft][tokenId];
            emit ItemCanceled(existingListing.seller, nft, tokenId);
        }
        delete s_auctions[nft][tokenId];
        s_totalEscrowedFunds -= amount;

        bool transferCallOk;

        bytes memory transferData = abi.encodeWithSelector(
            bytes4(0x42842e0e),
            msg.sender,
            buyer,
            tokenId
        );
        assembly {
            transferCallOk := call(
                gas(),
                nft,
                0,
                add(transferData, 0x20),
                mload(transferData),
                0,
                0 // retSize = 0
            )
        }

        if (!transferCallOk) {
            // buyer's onERC721Received reverted (EIP-7702 ghost offer).
            // Do NOT revert — that would restore offer state and allow indefinite re-blocking.
            // Instead: force-cancel. Offer + listing already deleted above.
            // ETH was removed from s_totalEscrowedFunds above — credit it back as pending.
            s_pendingWithdrawals[buyer] += amount;
            s_totalPendingWithdrawals += amount;
            emit FinalizationFailed(nft, tokenId, buyer, "LyingNFT");
            return; // Offer is permanently gone — trap is one-shot, not indefinite
        }

        // Transfer succeeded — verify ownership moved and pay out
        require(_getOwnerSafely(nft, tokenId) == buyer, "Transfer failed");
        _handlePayout(nft, tokenId, amount, msg.sender, false);
        emit OfferAccepted(msg.sender, buyer, nft, tokenId, amount);
    }

    // AUCTIONS

    function createAuction(
        address nft,
        uint256 tokenId,
        uint256 duration,
        uint256 reservePrice
    ) external auctionsActive whenNotPaused {
        require(uint160(nft) > 0x9, "Precompile not allowed");
        require(duration >= 1 hours, "Min 1 hour");
        require(duration <= 30 days, "Duration exceeding 30 days");
        require(_getOwnerSafely(nft, tokenId) == msg.sender, "Not owner");
        require(_isApprovedSafely(nft, tokenId, msg.sender), "Not approved");
        require(!s_auctions[nft][tokenId].active, "Auction exists");
        require(reservePrice >= MIN_RESERVE_FLOOR, "Reserve too low");

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
            0,
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

    function cancelAuction(
        address nft,
        uint256 tokenId
    ) external whenNotPaused {
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
        require(msg.sender != auction.highestBidder, "Already highest bidder");
        require(msg.value > 0, "Bid must be > 0");
        require(
            _getOwnerSafely(nft, tokenId) == auction.seller,
            "Seller not owner"
        );
        require(
            _isApprovedSafely(nft, tokenId, auction.seller),
            "Approval revoked"
        );

        uint256 percentageIncrement = (s_auctions[nft][tokenId].highestBid *
            200) / 10000;
        uint256 minIncrement = percentageIncrement > 0
            ? percentageIncrement
            : 1;
        require(
            msg.value >= s_auctions[nft][tokenId].highestBid + minIncrement,
            "Bid too low"
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
            if (auction.extensionCount < MAX_BID_EXTENSIONS) {
                auction.endTime += BID_EXTENSION_DURATION;
                auction.extensionCount++;
                emit AuctionExtended(nft, tokenId, auction.endTime);
            }
        }
        emit BidPlaced(msg.sender, nft, tokenId, msg.value);
    }

    function finalizeAuction(
        address nft,
        uint256 tokenId
    ) external nonReentrant whenNotPaused {
        //Load into memory
        Auction memory auction = s_auctions[nft][tokenId];

        //Validation
        require(auction.active, "Not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        if (block.timestamp < auction.endTime + AUCTION_GRACE_PERIOD) {
            require(
                msg.sender == auction.seller ||
                    msg.sender == auction.highestBidder,
                "Not authorized"
            );
        }

        // State Updates (Strict CEI pattern restored)
        delete s_auctions[nft][tokenId];

        // Cache escrow values and update global accounting
        uint256 finalBid = auction.highestBid;
        if (finalBid > 0) {
            s_totalEscrowedFunds -= finalBid;
        }

        bool sellerStillOwns = (_getOwnerSafely(nft, tokenId) ==
            auction.seller);
        bool approvalIntact = sellerStillOwns &&
            _isApprovedSafely(nft, tokenId, auction.seller);
        bool finalizedWithTransfer = false;

        // Execution
        if (finalBid > 0 && sellerStillOwns && approvalIntact) {
            delete s_listings[nft][tokenId];

            bool transferCallOk;
            bytes memory transferData = abi.encodeWithSelector(
                bytes4(0x42842e0e),
                auction.seller,
                auction.highestBidder,
                tokenId
            );

            assembly ("memory-safe") {
                transferCallOk := call(
                    gas(),
                    nft,
                    0,
                    add(transferData, 0x20),
                    mload(transferData),
                    0,
                    0
                )
            }

            if (transferCallOk) {
                bool sellerDivested = false;
                try
                    IERC721(nft).ownerOf{gas: OWNER_OF_GAS_STIPEND}(tokenId)
                returns (address actual) {
                    // Check if the asset left the seller's wallet
                    sellerDivested = (actual != auction.seller);
                    if (!sellerDivested) {
                        emit FinalizationFailed(
                            nft,
                            tokenId,
                            auction.highestBidder,
                            "LyingNFT"
                        );
                    }
                } catch {
                    // ownerOf could not be verified (ERC721A / gas-heavy implementation).
                    // Per V13-M2 remediation, trust successful transferCallOk to preserve liveness.
                    sellerDivested = true;
                    unchecked {
                        s_ownerOfSkipCount[nft]++;
                    }
                    emit OwnerOfVerificationSkipped(
                        nft,
                        tokenId,
                        auction.highestBidder
                    );
                }
                if (sellerDivested) {
                    finalizedWithTransfer = true;
                    _handlePayout(nft, tokenId, finalBid, auction.seller, true);
                } else {
                    // Lying NFT: NFT contract fault — full refund, no bidder penalty.
                    s_pendingWithdrawals[auction.highestBidder] += finalBid;
                    s_totalPendingWithdrawals += finalBid;
                }
            } else {
                // Apply GRIEF_SLASH_BPS (10%) to deter costless denial-of-sale.
                uint256 slashAmount = (finalBid * GRIEF_SLASH_BPS) /
                    FEE_DENOMINATOR;
                uint256 refundAmount = finalBid - slashAmount;

                s_pendingWithdrawals[auction.highestBidder] += refundAmount;
                s_totalPendingWithdrawals += refundAmount;

                s_pendingWithdrawals[auction.seller] += slashAmount;
                s_totalPendingWithdrawals += slashAmount;

                emit FinalizationFailed(
                    nft,
                    tokenId,
                    auction.highestBidder,
                    "BidderGrief"
                );
            }
        } else if (finalBid > 0) {
            // Seller-attributable: burned/moved NFT or revoked approval — full refund.
            s_pendingWithdrawals[auction.highestBidder] += finalBid;
            s_totalPendingWithdrawals += finalBid;
        }

        emit AuctionFinalized(
            auction.highestBidder,
            nft,
            tokenId,
            finalBid,
            finalizedWithTransfer
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
            bytes memory data = abi.encodeWithSelector(
                IERC2981.royaltyInfo.selector,
                tokenId,
                price
            );

            address receiver;
            uint256 amount;
            bool success;

            assembly {
                // staticcall(gas, addr, argsOffset, argsSize, retOffset, retSize)
                // We limit retSize to 64 bytes to prevent memory expansion attacks
                success := staticcall(
                    gas(),
                    nft,
                    add(data, 0x20),
                    mload(data),
                    0,
                    64
                )
                if and(success, eq(returndatasize(), 64)) {
                    receiver := and(
                        mload(0),
                        0xffffffffffffffffffffffffffffffffffffffff
                    )
                    amount := mload(0x20)
                }
            }

            if (
                success && receiver != address(0) && receiver != address(this)
            ) {
                royaltyReceiver = receiver;
                royaltyAmount = amount;
                uint256 royaltyCap = (price * MAX_ROYALTY) / FEE_DENOMINATOR;
                if (royaltyAmount > royaltyCap) royaltyAmount = royaltyCap;
            }
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
            (bool sellerOk, ) = seller.call{
                value: sellerProceeds,
                gas: ROYALTY_GAS_STIPEND
            }("");
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
            auction.highestBidder = address(0);
        }
    }

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");

        require(success, "ETH transfer failed");
    }

    function _getOwnerSafely(
        address nft,
        uint256 tokenId
    ) internal view returns (address owner) {
        bytes memory data = abi.encodeWithSelector(
            IERC721.ownerOf.selector,
            tokenId
        );
        assembly {
            // staticcall(gas, addr, argsOffset, argsSize, retOffset, retSize)
            let success := staticcall(
                gas(),
                nft,
                add(data, 0x20),
                mload(data),
                0,
                32
            )

            // Check success AND that we actually got 32 bytes back
            if and(success, gt(returndatasize(), 31)) {
                owner := and(
                    mload(0),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        }
    }

    function _isApprovedSafely(
        address nft,
        uint256 tokenId,
        address seller
    ) internal view returns (bool approved) {
        address marketplace = address(this); // Pass this in for assembly

        // Check getApproved
        bytes memory d1 = abi.encodeWithSelector(
            IERC721.getApproved.selector,
            tokenId
        );
        assembly {
            let success := staticcall(
                gas(),
                nft,
                add(d1, 0x20),
                mload(d1),
                0,
                32
            )
            if and(success, gt(returndatasize(), 31)) {
                // Compare the returned address to our marketplace address
                if eq(mload(0), marketplace) {
                    approved := true
                }
            }
        }
        if (approved) return true;

        // Check isApprovedForAll
        bytes memory d2 = abi.encodeWithSelector(
            IERC721.isApprovedForAll.selector,
            seller,
            marketplace
        );
        assembly {
            let success := staticcall(
                gas(),
                nft,
                add(d2, 0x20),
                mload(d2),
                0,
                32
            )
            if and(success, gt(returndatasize(), 31)) {
                approved := iszero(iszero(mload(0)))
            }
        }
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
    /**
     * @notice Recovers ETH stranded in the contract's own pending withdrawals slot.
     * @dev Resolves Q17-NEW-1 from the V11 audit. Protects against self-stranding.
     */
    function sweepStuckPending(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Zero address");

        uint256 amount = s_pendingWithdrawals[address(this)];
        require(amount > 0, "No stuck ETH to sweep");
        s_pendingWithdrawals[address(this)] = 0;
        s_totalPendingWithdrawals -= amount;
        _safeTransferETH(to, amount);

        emit StuckPendingSwept(to, amount);
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
        bytes memory data = abi.encodeWithSelector(
            IERC165.supportsInterface.selector,
            type(IERC2981).interfaceId
        );

        bool supported;
        assembly {
            // We only need 32 bytes to read the boolean result
            let success := staticcall(
                gas(),
                nft,
                add(data, 0x20),
                mload(data),
                0,
                32
            )
            if and(success, gt(returndatasize(), 31)) {
                supported := iszero(iszero(mload(0)))
            }
        }
        return supported;
    }
}
