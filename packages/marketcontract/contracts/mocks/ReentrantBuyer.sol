// SPDX-License-Identifier: MIT
pragma solidity ^0.8.38;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {MintoraVeHemi} from "../MintoraVeHemi.sol";

/// @dev Test-only buyer contract that tries to buy a second listing from inside the NFT receive hook.
contract ReentrantBuyer is IERC721Receiver {
    MintoraVeHemi private immutable market;
    uint256 private reenterTokenId;
    uint256 private reenterListingId;

    constructor(MintoraVeHemi market_) {
        market = market_;
    }

    function approve(uint256 amount) external {
        market.hemi().approve(address(market), amount);
    }

    function buy(uint256 tokenId, uint256 listingId, uint256 reenterTokenId_, uint256 reenterListingId_) external {
        reenterTokenId = reenterTokenId_;
        reenterListingId = reenterListingId_;
        market.buy(tokenId, listingId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (reenterTokenId != 0) market.buy(reenterTokenId, reenterListingId);
        return IERC721Receiver.onERC721Received.selector;
    }
}
