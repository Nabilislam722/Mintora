import pkg from "hardhat";
const { ethers, upgrades } = pkg;

async function main() {
  const proxyAddress = "0xf93AF302727E0ef59522Cd9Ff19Ba6b5BB7755"; 

  console.log("Checking for storage compatibility...");
  
  const Mintora = await ethers.getContractFactory("Mintora");

  console.log("Upgrading the proxy at:", proxyAddress);

  const upgraded = await upgrades.upgradeProxy(proxyAddress, Mintora);

  await upgraded.waitForDeployment();

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("-----------------------------------------");
  console.log("✅ Upgrade complete!");
  console.log("Proxy (Frontend address):", proxyAddress);
  console.log("New Logic (Implementation):", implementationAddress);
  console.log("-----------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});