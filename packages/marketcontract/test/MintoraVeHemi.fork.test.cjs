// Runs MintoraVeHemi against the real veHEMI on a fork of Hemi mainnet. Opt-in, since it needs an RPC:
//   HEMI_FORK_URL=https://rpc.hemi.network/rpc npx hardhat test test/MintoraVeHemi.fork.test.cjs
const { expect } = require("chai");
const { ethers, upgrades, network } = require("hardhat");

const VE_HEMI = "0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89";
const DAY = 24 * 60 * 60;
const hemiUnits = (n) => ethers.parseUnits(String(n), 18);

const VE_ABI = [
  "function HEMI() view returns (address)",
  "function createLock(uint256 amount, uint256 lockDuration) returns (uint256)",
  "function increaseAmount(uint256 tokenId, uint256 amount)",
  "function increaseUnlockTime(uint256 tokenId, uint256 lockDuration)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const offerData = (buyer, offerId, maxFeeBps = 500) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256", "uint16"], [buyer, offerId, maxFeeBps]);

describe("MintoraVeHemi on a Hemi mainnet fork", function () {
  this.timeout(600_000);
  let ve, hemi, market, marketAddr, owner, treasury, seller, buyer, other;

  // Writes `amount` into HEMI's balance mapping, finding its slot by trying the usual layouts
  async function setHemiBalance(account, amount) {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const hemiAddr = await hemi.getAddress();
    const ozV5Namespace = 0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00n;
    for (const base of [...Array(20).keys()].map(BigInt).concat(ozV5Namespace)) {
      const slot = ethers.keccak256(coder.encode(["address", "uint256"], [account, base]));
      const prev = await network.provider.send("eth_getStorageAt", [hemiAddr, slot, "latest"]);
      await network.provider.send("hardhat_setStorageAt", [hemiAddr, slot, ethers.toBeHex(amount, 32)]);
      if ((await hemi.balanceOf(account)) === amount) return;
      await network.provider.send("hardhat_setStorageAt", [hemiAddr, slot, prev]);
    }
    throw new Error("HEMI balance slot not found");
  }

  async function lock(signer, amount, days) {
    const receipt = await (await ve.connect(signer).createLock(hemiUnits(amount), days * DAY)).wait();
    // HEMI's ERC-20 Transfer shares the event signature, so only read veHEMI's own logs
    const minted = receipt.logs.find((l) => l.address.toLowerCase() === VE_HEMI.toLowerCase());
    return ve.interface.parseLog(minted).args.tokenId;
  }

  async function listAndApprove(tokenId, price, cap) {
    const receipt = await (await market.connect(seller).list(tokenId, hemiUnits(price), 7 * DAY, hemiUnits(cap))).wait();
    await ve.connect(seller).approve(marketAddr, tokenId);
    return receipt.logs.map((l) => market.interface.parseLog(l)).find((e) => e?.name === "Listed").args.listingId;
  }

  before(async function () {
    // hardhat.config.cjs forks Hemi when HEMI_FORK_URL is set
    if (!process.env.HEMI_FORK_URL) this.skip();
    // Calls at the fork block itself need Hemi's hardfork history, so run everything on a local block after it
    await network.provider.send("hardhat_mine", ["0x1"]);

    [owner, treasury, seller, buyer, other] = await ethers.getSigners();
    ve = new ethers.Contract(VE_HEMI, VE_ABI, ethers.provider);
    hemi = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", await ve.HEMI());

    const Market = await ethers.getContractFactory("MintoraVeHemi");
    market = await upgrades.deployProxy(Market, [owner.address, VE_HEMI, treasury.address, 500], { kind: "uups" });
    marketAddr = await market.getAddress();

    for (const s of [seller, buyer, other]) {
      await setHemiBalance(s.address, hemiUnits(10_000));
      await hemi.connect(s).approve(VE_HEMI, ethers.MaxUint256);
      await hemi.connect(s).approve(marketAddr, ethers.MaxUint256);
    }
  });

  it("lists, then approves, and sells a real position", async function () {
    const tokenId = await lock(seller, 1000, 365);
    const receipt = await (await market.connect(seller).list(tokenId, hemiUnits(800), 7 * DAY, hemiUnits(1010))).wait();
    const listingId = receipt.logs.map((l) => market.interface.parseLog(l)).find((e) => e?.name === "Listed").args.listingId;
    expect(await market.isListingValid(tokenId)).to.equal(false);

    await ve.connect(seller).approve(marketAddr, tokenId);
    expect(await market.isListingValid(tokenId)).to.equal(true);
    await expect(market.connect(buyer).buy(tokenId, listingId)).to.changeTokenBalances(
      hemi,
      [buyer, seller, treasury],
      [-hemiUnits(800), hemiUnits(760), hemiUnits(40)]
    );
    expect(await ve.ownerOf(tokenId)).to.equal(buyer.address);
  });

  it("accepts an offer when the holder sends the position with it, through veHEMI's reentrancy guard", async function () {
    const tokenId = await lock(seller, 500, 200);
    await market.connect(buyer).makeOffer(tokenId, hemiUnits(400), 7 * DAY);
    const offerId = (await market.getOffer(tokenId, buyer.address)).id;

    await expect(
      ve.connect(seller).safeTransferFrom(seller.address, marketAddr, tokenId, offerData(buyer.address, offerId))
    ).to.changeTokenBalances(hemi, [buyer, seller, treasury], [-hemiUnits(400), hemiUnits(380), hemiUnits(20)]);
    expect(await ve.ownerOf(tokenId)).to.equal(buyer.address);
  });

  it("clears the market's approval when a position moves, so the listing doesn't fill when it comes back", async function () {
    const tokenId = await lock(seller, 100, 100);
    const listingId = await listAndApprove(tokenId, 90, 101);
    await ve.connect(seller).transferFrom(seller.address, other.address, tokenId);
    await ve.connect(other).transferFrom(other.address, seller.address, tokenId);
    expect(await ve.getApproved(tokenId)).to.equal(ethers.ZeroAddress);
    await expect(market.connect(buyer).buy(tokenId, listingId)).to.be.revertedWithCustomError(market, "NotApproved");
  });

  it("stops a listing once a top-up passes its cap, or the lock is extended", async function () {
    const capped = await lock(seller, 1000, 365);
    const cappedId = await listAndApprove(capped, 800, 1010);
    await ve.connect(other).increaseAmount(capped, hemiUnits(10));
    expect(await market.isListingValid(capped)).to.equal(true);
    await ve.connect(other).increaseAmount(capped, 1n);
    await expect(market.connect(buyer).buy(capped, cappedId)).to.be.revertedWithCustomError(market, "PositionChanged");

    const extended = await lock(seller, 1000, 365);
    const extendedId = await listAndApprove(extended, 800, 1010);
    await ve.connect(seller).increaseUnlockTime(extended, 730 * DAY);
    await expect(market.connect(buyer).buy(extended, extendedId)).to.be.revertedWithCustomError(market, "PositionChanged");
  });
});
