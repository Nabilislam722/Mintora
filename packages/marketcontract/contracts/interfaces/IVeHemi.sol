// SPDX-License-Identifier: MIT
pragma solidity ^0.8.38;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @notice The parts of Hemi's veHEMI contract (0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89) the marketplace uses.
interface IVeHemi is IERC721 {
    struct LockedBalance {
        int128 amount;
        uint64 end;
    }

    /// @dev The HEMI token veHEMI locks. Immutable in veHEMI, so the marketplace takes its payment token from here.
    function HEMI() external view returns (address);

    function getLockedBalance(uint256 tokenId) external view returns (LockedBalance memory);

    /// @dev True once `transferableAfter[tokenId]` has passed. Also true for burned ids, so pair it with ownerOf.
    function isTransferable(uint256 tokenId) external view returns (bool);

    function balanceOfNFT(uint256 tokenId) external view returns (uint256);
}
