const { ethers, upgrades } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = "0xf93AF302727E0ef59522Cd9D9Ff19Ba6b5BB7755";
  const Mintora = await ethers.getContractFactory("Mintora");
  
  console.log("Downloading storage layout from blockchain...");
  
  if (!upgrades) {
    throw new Error("Plugin failed to load properly. Check hardhat.config.cjs.");
  }
  
  await upgrades.forceImport(PROXY_ADDRESS, Mintora);
  console.log("✅ Proxy registered successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});