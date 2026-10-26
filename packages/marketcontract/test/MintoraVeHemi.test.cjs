const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY; // shortest listing or offer the contract allows
const hemiUnits = (n) => ethers.parseUnits(String(n), 18);

// Returns the order id (second event arg) from a Listed / OfferMade event
async function orderId(txPromise, market, eventName) {
  const receipt = await (await txPromise).wait();
  for (const log of receipt.logs) {
    const parsed = market.interface.parseLog(log);
    if (parsed?.name === eventName) return parsed.args[1];
  }
  throw new Error(`${eventName} not emitted`);
}

async function deployFixture() {
  const [owner, treasury, seller, buyer, other] = await ethers.getSigners();

  const hemi = await (await ethers.getContractFactory("MockERC20")).deploy("Hemi", "HEMI", 18);
  const ve = await (await ethers.getContractFactory("MockVeHemi")).deploy(await hemi.getAddress());

  const Market = await ethers.getContractFactory("MintoraVeHemi");
  const market = await upgrades.deployProxy(Market, [owner.address, await ve.getAddress(), treasury.address, 500], {
    kind: "uups",
    initializer: "initialize",
  });
  const marketAddr = await market.getAddress();

  // #1: transferable, 1,000 HEMI for 100 days. #2: not transferable for another 30 days.
  await ve.createLock(seller.address, hemiUnits(1000), 100 * DAY, 0);
  await ve.createLock(seller.address, hemiUnits(500), 200 * DAY, (await time.latest()) + 30 * DAY);
  await ve.connect(seller).setApprovalForAll(marketAddr, true);

  for (const s of [buyer, other]) {
    await hemi.mint(s.address, hemiUnits(100_000));
    await hemi.connect(s).approve(marketAddr, ethers.MaxUint256);
  }

  return { Market, market, marketAddr, ve, hemi, owner, treasury, seller, buyer, other };
}

// #1 listed at 800 HEMI for 7 days
async function listedFixture() {
  const f = await deployFixture();
  const listingId = await orderId(f.market.connect(f.seller).list(1, hemiUnits(800), WEEK), f.market, "Listed");
  return { ...f, listingId };
}

// buyer offers 700 HEMI on #1 for 7 days
async function offerFixture() {
  const f = await deployFixture();
  const offerId = await orderId(f.market.connect(f.buyer).makeOffer(1, hemiUnits(700), WEEK), f.market, "OfferMade");
  return { ...f, offerId };
}

describe("MintoraVeHemi", function () {
  describe("setup", function () {
    it("initializes fee, recipient and owner, and takes HEMI from veHEMI", async function () {
      const { market, ve, hemi, owner, treasury } = await loadFixture(deployFixture);
      expect(await market.owner()).to.equal(owner.address);
      expect(await market.veHemi()).to.equal(await ve.getAddress());
      expect(await market.hemi()).to.equal(await hemi.getAddress());
      expect(await market.feeRecipient()).to.equal(treasury.address);
      expect(await market.feeBps()).to.equal(500);
    });

    it("can't be initialized twice, or through the implementation", async function () {
      const { Market, market, marketAddr, ve, owner } = await loadFixture(deployFixture);
      const args = [owner.address, await ve.getAddress(), owner.address, 500];
      await expect(market.initialize(...args)).to.be.revertedWithCustomError(market, "InvalidInitialization");
      const impl = Market.attach(await upgrades.erc1967.getImplementationAddress(marketAddr));
      await expect(impl.initialize(...args)).to.be.revertedWithCustomError(market, "InvalidInitialization");
    });

    it("rejects a fee above 10% and a veHEMI without a HEMI token", async function () {
      const { Market, ve, owner } = await loadFixture(deployFixture);
      await expect(
        upgrades.deployProxy(Market, [owner.address, await ve.getAddress(), owner.address, 1001], { kind: "uups" })
      ).to.be.revertedWithCustomError(Market, "FeeTooHigh");
      const noHemi = await (await ethers.getContractFactory("MockVeHemi")).deploy(ethers.ZeroAddress);
      await expect(
        upgrades.deployProxy(Market, [owner.address, await noHemi.getAddress(), owner.address, 500], { kind: "uups" })
      ).to.be.revertedWithCustomError(Market, "ZeroAddress");
    });
  });

  describe("list", function () {
    it("records the listing with the position as it is now", async function () {
      const { market, ve, seller, listingId } = await loadFixture(listedFixture);
      const lock = await ve.getLockedBalance(1);
      const l = await market.getListing(1);
      expect(l.seller).to.equal(seller.address);
      expect(l.price).to.equal(hemiUnits(800));
      expect(l.feeBps).to.equal(500);
      expect(l.lockAmount).to.equal(lock.amount);
      expect(l.lockEnd).to.equal(lock.end);
      expect(l.id).to.equal(listingId);
      expect(await market.isListingValid(1)).to.equal(true);
    });

    it("rejects bad parameters", async function () {
      const { market, seller, other } = await loadFixture(deployFixture);
      await expect(market.connect(seller).list(1, 0, WEEK)).to.be.revertedWithCustomError(market, "InvalidPrice");
      await expect(market.connect(seller).list(1, 1, WEEK - 1)).to.be.revertedWithCustomError(market, "InvalidDuration");
      await expect(market.connect(seller).list(1, 1, 90 * DAY + 1)).to.be.revertedWithCustomError(market, "InvalidDuration");
      await expect(market.connect(other).makeOffer(1, 1, WEEK - 1)).to.be.revertedWithCustomError(market, "InvalidDuration");
      await expect(market.connect(other).makeOffer(1, 1, 90 * DAY + 1)).to.be.revertedWithCustomError(market, "InvalidDuration");
    });

    it("accepts durations from exactly 7 to exactly 90 days", async function () {
      const { market, seller, other } = await loadFixture(deployFixture);
      expect(await market.MIN_DURATION()).to.equal(WEEK);
      expect(await market.MAX_DURATION()).to.equal(90 * DAY);
      await expect(market.connect(seller).list(1, 1, WEEK)).to.emit(market, "Listed");
      await expect(market.connect(seller).list(1, 1, 90 * DAY)).to.emit(market, "Listed");
      await expect(market.connect(other).makeOffer(1, 1, WEEK)).to.emit(market, "OfferMade");
      await expect(market.connect(other).makeOffer(1, 1, 90 * DAY)).to.emit(market, "OfferMade");
    });

    it("rejects positions the caller can't sell", async function () {
      const { market, ve, seller, other, marketAddr } = await loadFixture(deployFixture);
      await expect(market.connect(other).list(1, 1, WEEK)).to.be.revertedWithCustomError(market, "NotTokenOwner");
      await expect(market.connect(seller).list(2, 1, WEEK)).to.be.revertedWithCustomError(market, "NotTransferable");

      await ve.connect(seller).setApprovalForAll(marketAddr, false);
      await expect(market.connect(seller).list(1, 1, WEEK)).to.be.revertedWithCustomError(market, "NotApproved");
      await ve.connect(seller).approve(marketAddr, 1); // single-token approval works too
      await expect(market.connect(seller).list(1, 1, WEEK)).to.emit(market, "Listed");
    });

    it("rejects expired locks", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await time.increase(101 * DAY);
      await expect(market.connect(seller).list(1, 1, WEEK)).to.be.revertedWithCustomError(market, "LockExpired");
    });

    it("relisting replaces the listing with a new id", async function () {
      const { market, seller, listingId } = await loadFixture(listedFixture);
      const tx = market.connect(seller).list(1, hemiUnits(900), WEEK);
      await expect(tx).to.emit(market, "ListingCanceled").withArgs(1, listingId, seller.address);
      const l = await market.getListing(1);
      expect(l.id).to.be.greaterThan(listingId);
      expect(l.price).to.equal(hemiUnits(900));
    });
  });

  describe("buy", function () {
    it("pays the seller minus the fee and moves the NFT to the buyer", async function () {
      const { market, ve, hemi, seller, buyer, treasury, listingId } = await loadFixture(listedFixture);
      const tx = market.connect(buyer).buy(1, listingId);
      await expect(tx).to.changeTokenBalances(hemi, [buyer, seller, treasury], [-hemiUnits(800), hemiUnits(760), hemiUnits(40)]);
      await expect(tx).to.emit(market, "Sold").withArgs(1, listingId, seller.address, buyer.address, hemiUnits(800), hemiUnits(40));
      expect(await ve.ownerOf(1)).to.equal(buyer.address);
      expect((await market.getListing(1)).seller).to.equal(ethers.ZeroAddress);
      expect(await hemi.balanceOf(await market.getAddress())).to.equal(0);
    });

    it("won't fill a listing the seller changed after the buyer saw it", async function () {
      const { market, seller, buyer, listingId } = await loadFixture(listedFixture);
      // Seller raises the price while the buy is pending
      await market.connect(seller).list(1, hemiUnits(8000), WEEK);
      await expect(market.connect(buyer).buy(1, listingId)).to.be.revertedWithCustomError(market, "ListingChanged");
    });

    it("won't fill after the seller extends the lock", async function () {
      const { market, ve, seller, buyer, listingId } = await loadFixture(listedFixture);
      await ve.connect(seller).increaseUnlockTime(1, 1460 * DAY);
      await expect(market.connect(buyer).buy(1, listingId)).to.be.revertedWithCustomError(market, "PositionChanged");
      expect(await market.isListingValid(1)).to.equal(false);
    });

    it("sells after the seller extends the lock and relists at the new unlock date", async function () {
      const { market, ve, seller, buyer } = await loadFixture(listedFixture);
      await ve.connect(seller).increaseUnlockTime(1, 1460 * DAY);
      const id = await orderId(market.connect(seller).list(1, hemiUnits(850), WEEK), market, "Listed");
      expect((await market.getListing(1)).lockEnd).to.equal((await ve.getLockedBalance(1)).end);
      await expect(market.connect(buyer).buy(1, id)).to.emit(market, "Sold");
    });

    it("still fills after HEMI is added to the lock, and the buyer gets the extra HEMI", async function () {
      const { market, ve, buyer, other, listingId } = await loadFixture(listedFixture);
      await ve.connect(other).increaseAmount(1, hemiUnits(250));
      await expect(market.connect(buyer).buy(1, listingId)).to.emit(market, "Sold");
      expect((await ve.getLockedBalance(1)).amount).to.equal(hemiUnits(1250));
      expect(await ve.ownerOf(1)).to.equal(buyer.address);
    });

    it("won't fill an expired listing", async function () {
      const { market, buyer, listingId } = await loadFixture(listedFixture);
      await time.increase(WEEK);
      await expect(market.connect(buyer).buy(1, listingId)).to.be.revertedWithCustomError(market, "ListingExpired");
    });

    it("won't fill once the lock has expired", async function () {
      const { market, ve, seller, buyer } = await loadFixture(deployFixture);
      await ve.createLock(seller.address, hemiUnits(100), 10 * DAY, 0);
      const id = await orderId(market.connect(seller).list(3, hemiUnits(50), 30 * DAY), market, "Listed");
      await time.increase(11 * DAY);
      await expect(market.connect(buyer).buy(3, id)).to.be.revertedWithCustomError(market, "LockExpired");
    });

    it("won't fill after the seller moves the NFT", async function () {
      const { market, ve, seller, buyer, other, listingId } = await loadFixture(listedFixture);
      await ve.connect(seller).transferFrom(seller.address, other.address, 1);
      await expect(market.connect(buyer).buy(1, listingId)).to.be.revertedWithCustomError(market, "SellerNotOwner");
    });

    it("cancelAll kills the listing, even if the NFT later comes back", async function () {
      const { market, ve, seller, buyer, other, listingId } = await loadFixture(listedFixture);
      await ve.connect(seller).transferFrom(seller.address, other.address, 1);
      await market.connect(seller).cancelAll();
      await ve.connect(other).transferFrom(other.address, seller.address, 1);
      await expect(market.connect(buyer).buy(1, listingId)).to.be.revertedWithCustomError(market, "ListingInvalidated");
    });

    it("rejects buying your own listing", async function () {
      const { market, seller, listingId } = await loadFixture(listedFixture);
      await expect(market.connect(seller).buy(1, listingId)).to.be.revertedWithCustomError(market, "SelfTrade");
    });

    it("rejects unknown listings", async function () {
      const { market, buyer } = await loadFixture(deployFixture);
      await expect(market.connect(buyer).buy(1, 1)).to.be.revertedWithCustomError(market, "NotListed");
    });

    it("reverts the whole trade if the buyer hasn't approved enough", async function () {
      const { market, ve, hemi, seller, buyer, listingId } = await loadFixture(listedFixture);
      await hemi.connect(buyer).approve(await market.getAddress(), hemiUnits(799));
      await expect(market.connect(buyer).buy(1, listingId)).to.be.revertedWithCustomError(hemi, "ERC20InsufficientAllowance");
      expect(await ve.ownerOf(1)).to.equal(seller.address);
    });

    it("charges the lower of the fee at listing time and the current fee", async function () {
      const { market, marketAddr, ve, hemi, owner, seller, buyer, other, treasury, listingId } = await loadFixture(listedFixture);
      await market.connect(owner).setFee(1000);
      // Listed at 5%, fee now 10%: charges 5%
      await expect(market.connect(buyer).buy(1, listingId)).to.changeTokenBalances(hemi, [seller, treasury], [hemiUnits(760), hemiUnits(40)]);

      await market.connect(owner).setFee(200);
      await ve.connect(buyer).setApprovalForAll(marketAddr, true);
      const id = await orderId(market.connect(buyer).list(1, hemiUnits(800), WEEK), market, "Listed");
      await market.connect(owner).setFee(1000);
      // Listed at 2%, fee now 10%: charges 2%
      await expect(market.connect(other).buy(1, id)).to.changeTokenBalances(hemi, [buyer, treasury], [hemiUnits(784), hemiUnits(16)]);
    });

    it("removes the buyer's own offer on the position", async function () {
      const { market, buyer, listingId } = await loadFixture(listedFixture);
      const offerId = await orderId(market.connect(buyer).makeOffer(1, hemiUnits(600), WEEK), market, "OfferMade");
      await expect(market.connect(buyer).buy(1, listingId)).to.emit(market, "OfferCanceled").withArgs(1, offerId, buyer.address);
      expect((await market.getOffer(1, buyer.address)).id).to.equal(0);
    });

    it("blocks a buyer contract from re-entering during the NFT hook", async function () {
      const { market, ve, hemi, seller, listingId } = await loadFixture(listedFixture);
      await ve.createLock(seller.address, hemiUnits(100), 50 * DAY, 0);
      const secondId = await orderId(market.connect(seller).list(3, hemiUnits(20), WEEK), market, "Listed");

      const attacker = await (await ethers.getContractFactory("ReentrantBuyer")).deploy(await market.getAddress());
      await hemi.mint(await attacker.getAddress(), hemiUnits(2000));
      await attacker.approve(ethers.MaxUint256);

      await expect(attacker.buy(1, listingId, 3, secondId)).to.be.revertedWithCustomError(market, "ReentrancyGuardReentrantCall");
      expect(await ve.ownerOf(1)).to.equal(seller.address);
      expect(await hemi.balanceOf(await attacker.getAddress())).to.equal(hemiUnits(2000));
    });
  });

  describe("cancelListing", function () {
    it("lets the seller cancel", async function () {
      const { market, seller, buyer, listingId } = await loadFixture(listedFixture);
      await expect(market.connect(seller).cancelListing(1)).to.emit(market, "ListingCanceled").withArgs(1, listingId, seller.address);
      await expect(market.connect(buyer).buy(1, listingId)).to.be.revertedWithCustomError(market, "NotListed");
    });

    it("lets the new owner clear a listing left by the previous owner, and no one else", async function () {
      const { market, ve, seller, buyer, other } = await loadFixture(listedFixture);
      await ve.connect(seller).transferFrom(seller.address, other.address, 1);
      await expect(market.connect(buyer).cancelListing(1)).to.be.revertedWithCustomError(market, "NotAuthorized");
      await expect(market.connect(other).cancelListing(1)).to.emit(market, "ListingCanceled");
    });

    it("works while paused", async function () {
      const { market, owner, seller } = await loadFixture(listedFixture);
      await market.connect(owner).pause();
      await expect(market.connect(seller).cancelListing(1)).to.emit(market, "ListingCanceled");
    });
  });

  describe("offers", function () {
    it("records the offer without taking the buyer's HEMI", async function () {
      const { market, ve, hemi, buyer, offerId } = await loadFixture(offerFixture);
      const lock = await ve.getLockedBalance(1);
      const o = await market.getOffer(1, buyer.address);
      expect(o.id).to.equal(offerId);
      expect(o.amount).to.equal(hemiUnits(700));
      expect(o.minLockAmount).to.equal(lock.amount);
      expect(o.maxLockEnd).to.equal(lock.end);
      expect(await hemi.balanceOf(buyer.address)).to.equal(hemiUnits(100_000));
      expect(await market.isOfferValid(1, buyer.address)).to.equal(true);
    });

    it("needs the HEMI and the approval up front", async function () {
      const { market, hemi, seller, buyer } = await loadFixture(deployFixture);
      await expect(market.connect(buyer).makeOffer(1, hemiUnits(200_000), WEEK)).to.be.revertedWithCustomError(market, "InsufficientFunds");
      await hemi.connect(buyer).approve(await market.getAddress(), 0);
      await expect(market.connect(buyer).makeOffer(1, hemiUnits(1), WEEK)).to.be.revertedWithCustomError(market, "InsufficientFunds");
      await expect(market.connect(seller).makeOffer(1, 1, WEEK)).to.be.revertedWithCustomError(market, "SelfTrade");
    });

    it("accepting pays the seller, moves the NFT and cancels the seller's listing", async function () {
      const { market, ve, hemi, seller, buyer, treasury, offerId } = await loadFixture(offerFixture);
      const listingId = await orderId(market.connect(seller).list(1, hemiUnits(900), WEEK), market, "Listed");

      const tx = market.connect(seller).acceptOffer(1, buyer.address, offerId);
      await expect(tx).to.changeTokenBalances(hemi, [buyer, seller, treasury], [-hemiUnits(700), hemiUnits(665), hemiUnits(35)]);
      await expect(tx).to.emit(market, "ListingCanceled").withArgs(1, listingId, seller.address);
      await expect(tx).to.emit(market, "OfferAccepted");
      expect(await ve.ownerOf(1)).to.equal(buyer.address);
      expect((await market.getOffer(1, buyer.address)).id).to.equal(0);
      expect((await market.getListing(1)).seller).to.equal(ethers.ZeroAddress);
    });

    it("won't fill an offer the buyer changed after the seller saw it", async function () {
      const { market, seller, buyer, offerId } = await loadFixture(offerFixture);
      await market.connect(buyer).makeOffer(1, hemiUnits(1), WEEK);
      await expect(market.connect(seller).acceptOffer(1, buyer.address, offerId)).to.be.revertedWithCustomError(market, "OfferChanged");
    });

    it("won't fill after the seller extends the lock, but still fills after HEMI is added", async function () {
      const { market, ve, seller, buyer, other, offerId } = await loadFixture(offerFixture);
      await ve.connect(other).increaseAmount(1, hemiUnits(100));
      expect(await market.isOfferValid(1, buyer.address)).to.equal(true);
      await ve.connect(seller).increaseUnlockTime(1, 1460 * DAY);
      await expect(market.connect(seller).acceptOffer(1, buyer.address, offerId)).to.be.revertedWithCustomError(market, "PositionChanged");
    });

    it("rejects expired, cancelled and invalidated offers", async function () {
      const { market, seller, buyer, other, offerId } = await loadFixture(offerFixture);
      await expect(market.connect(other).acceptOffer(1, buyer.address, offerId)).to.be.revertedWithCustomError(market, "NotTokenOwner");

      await market.connect(buyer).cancelAll();
      await expect(market.connect(seller).acceptOffer(1, buyer.address, offerId)).to.be.revertedWithCustomError(market, "OfferInvalidated");

      const id2 = await orderId(market.connect(buyer).makeOffer(1, hemiUnits(10), WEEK), market, "OfferMade");
      await time.increase(WEEK);
      await expect(market.connect(seller).acceptOffer(1, buyer.address, id2)).to.be.revertedWithCustomError(market, "OfferExpired");

      const id3 = await orderId(market.connect(buyer).makeOffer(1, hemiUnits(10), WEEK), market, "OfferMade");
      await market.connect(buyer).cancelOffer(1);
      await expect(market.connect(seller).acceptOffer(1, buyer.address, id3)).to.be.revertedWithCustomError(market, "NoOffer");
    });

    it("can be made on a locked-in position but only accepted once it's transferable", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      const id = await orderId(market.connect(buyer).makeOffer(2, hemiUnits(300), 60 * DAY), market, "OfferMade");
      expect(await market.isOfferValid(2, buyer.address)).to.equal(false);
      await expect(market.connect(seller).acceptOffer(2, buyer.address, id)).to.be.revertedWithCustomError(market, "NotTransferable");
      await time.increase(31 * DAY);
      await expect(market.connect(seller).acceptOffer(2, buyer.address, id)).to.emit(market, "OfferAccepted");
    });

    it("isOfferValid turns false when the buyer pulls their approval", async function () {
      const { market, hemi, buyer } = await loadFixture(offerFixture);
      await hemi.connect(buyer).approve(await market.getAddress(), 0);
      expect(await market.isOfferValid(1, buyer.address)).to.equal(false);
    });
  });

  describe("pause", function () {
    it("stops listing, buying, offering and accepting", async function () {
      const { market, owner, seller, buyer, offerId } = await loadFixture(offerFixture);
      await market.connect(owner).pause();
      await expect(market.connect(seller).list(1, 1, WEEK)).to.be.revertedWithCustomError(market, "EnforcedPause");
      await expect(market.connect(buyer).buy(1, 1)).to.be.revertedWithCustomError(market, "EnforcedPause");
      await expect(market.connect(buyer).makeOffer(1, 1, WEEK)).to.be.revertedWithCustomError(market, "EnforcedPause");
      await expect(market.connect(seller).acceptOffer(1, buyer.address, offerId)).to.be.revertedWithCustomError(market, "EnforcedPause");
      await expect(market.connect(buyer).cancelOffer(1)).to.emit(market, "OfferCanceled");
    });
  });

  describe("views", function () {
    it("report a withdrawn (burned) position as invalid without reverting", async function () {
      const { market, ve, seller, buyer } = await loadFixture(deployFixture);
      await ve.createLock(seller.address, hemiUnits(100), 2 * DAY, 0);
      await market.connect(seller).list(3, hemiUnits(50), 30 * DAY);
      await market.connect(buyer).makeOffer(3, hemiUnits(40), 30 * DAY);
      await time.increase(3 * DAY);
      await ve.connect(seller).withdraw(3);
      expect(await market.isListingValid(3)).to.equal(false);
      expect(await market.isOfferValid(3, buyer.address)).to.equal(false);
    });
  });

  describe("owner", function () {
    it("restricts admin functions to the owner", async function () {
      const { Market, market, hemi, other } = await loadFixture(deployFixture);
      const m = market.connect(other);
      await expect(m.setFee(100)).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
      await expect(m.setFeeRecipient(other.address)).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
      await expect(m.pause()).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
      await expect(m.rescueERC20(await hemi.getAddress(), other.address, 1)).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
      const newImpl = await (await Market.deploy()).getAddress();
      await expect(m.upgradeToAndCall(newImpl, "0x")).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
    });

    it("caps the fee at 10%", async function () {
      const { market, owner } = await loadFixture(deployFixture);
      await expect(market.connect(owner).setFee(1001)).to.be.revertedWithCustomError(market, "FeeTooHigh");
      await expect(market.connect(owner).setFee(1000)).to.emit(market, "FeeUpdated").withArgs(500, 1000);
    });

    it("rescues tokens sent by mistake", async function () {
      const { market, hemi, owner, buyer, other } = await loadFixture(deployFixture);
      await hemi.connect(buyer).transfer(await market.getAddress(), hemiUnits(5));
      await expect(market.connect(owner).rescueERC20(await hemi.getAddress(), other.address, hemiUnits(5))).to.changeTokenBalance(hemi, other, hemiUnits(5));
    });

    it("transfers ownership in two steps", async function () {
      const { market, owner, other } = await loadFixture(deployFixture);
      await market.connect(owner).transferOwnership(other.address);
      expect(await market.owner()).to.equal(owner.address);
      await market.connect(other).acceptOwnership();
      expect(await market.owner()).to.equal(other.address);
    });

    it("upgrades and keeps open listings", async function () {
      const { Market, market, marketAddr, buyer, listingId } = await loadFixture(listedFixture);
      await upgrades.upgradeProxy(marketAddr, Market, { kind: "uups", redeployImplementation: "always" });
      expect((await market.getListing(1)).id).to.equal(listingId);
      await expect(market.connect(buyer).buy(1, listingId)).to.emit(market, "Sold");
    });
  });
});
