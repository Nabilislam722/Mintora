import hre from "hardhat";
const { ethers, upgrades } = hre;

async function main() {
  const Marketplace = await ethers.getContractFactory("NftMarketplace");

  console.log("🚀 Initializing Deployment via Bun...");
  console.log("📡 Deploying Proxy + Logic + ProxyAdmin...");

  const proxy = await upgrades.deployProxy(Marketplace, [], {
    initializer: "initialize",
    kind: "uups",
  });

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("-------------------------------------------------");
  console.log(`✅ SUCCESS!`);
  console.log(`📍 Proxy Address (The one users use): ${proxyAddress}`);
  console.log(`🧠 Logic Address (The one with code):  ${implementationAddress}`);
  console.log("-------------------------------------------------");
  console.log("Next step: Verify these on the Hemi Block Explorer.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});