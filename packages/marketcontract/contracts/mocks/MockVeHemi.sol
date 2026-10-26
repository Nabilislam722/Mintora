// SPDX-License-Identifier: MIT
pragma solidity ^0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev Test-only stand-in for veHEMI. It records the HEMI address but doesn't actually lock tokens, and keeps
///      the rules the marketplace depends on: anyone can add HEMI to a lock, only the owner can extend it, locks
///      never shrink, transfers are blocked until `transferableAfter`, and withdrawing an expired lock burns the NFT.
contract MockVeHemi is ERC721 {
    struct LockedBalance {
        int128 amount;
        uint64 end;
    }

    uint256 private constant MAX_TIME = 1461 days;

    address public immutable HEMI;
    mapping(uint256 => LockedBalance) private _locked;
    mapping(uint256 => uint256) public transferableAfter;
    uint256 public nextTokenId = 1;

    error NotTransferable();
    error NotOwner();
    error LockExpired();
    error LockNotExpired();
    error NewLockDurationNotGreater();

    constructor(address hemi_) ERC721("veHEMI", "veHEMI") {
        HEMI = hemi_;
    }

    function createLock(
        address to,
        uint256 amount,
        uint256 duration,
        uint256 transferableAfter_
    ) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _locked[tokenId] = LockedBalance(int128(int256(amount)), uint64(block.timestamp + duration));
        transferableAfter[tokenId] = transferableAfter_;
        _mint(to, tokenId);
    }

    function increaseAmount(uint256 tokenId, uint256 amount) external {
        if (_locked[tokenId].end <= block.timestamp) revert LockExpired();
        _locked[tokenId].amount += int128(int256(amount));
    }

    function increaseUnlockTime(uint256 tokenId, uint256 duration) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        uint64 end = uint64(block.timestamp + duration);
        if (end <= _locked[tokenId].end) revert NewLockDurationNotGreater();
        _locked[tokenId].end = end;
    }

    function withdraw(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (block.timestamp < _locked[tokenId].end) revert LockNotExpired();
        delete _locked[tokenId];
        delete transferableAfter[tokenId];
        _burn(tokenId);
    }

    function getLockedBalance(uint256 tokenId) external view returns (LockedBalance memory) {
        return _locked[tokenId];
    }

    function isTransferable(uint256 tokenId) public view returns (bool) {
        return transferableAfter[tokenId] <= block.timestamp;
    }

    function balanceOfNFT(uint256 tokenId) external view returns (uint256) {
        LockedBalance memory lock = _locked[tokenId];
        if (lock.end <= block.timestamp) return 0;
        return (uint256(int256(lock.amount)) * (lock.end - block.timestamp)) / MAX_TIME;
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        if (!isTransferable(tokenId)) revert NotTransferable();
        super.transferFrom(from, to, tokenId);
    }
}
