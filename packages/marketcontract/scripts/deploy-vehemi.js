import hre from "hardhat";
const { ethers, upgrades } = hre;

const VE_HEMI = "0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89"; // the contract reads HEMI from veHEMI.HEMI()
const FEE_BPS = 500; // 5%, matches LISTING_FEE_BPS in the client

async function main() {
  const [deployer] = await ethers.getSigners();
  // Owner can pause, set fees and upgrade: move it to a multisig after deploying
  const owner = process.env.VEHEMI_OWNER || deployer.address;
  const feeRecipient = process.env.VEHEMI_FEE_RECIPIENT || deployer.address;

  const Market = await ethers.getContractFactory("MintoraVeHemi");

  console.log("📡 Deploying MintoraVeHemi proxy + implementation...");
  console.log(`   owner: ${owner}  fee recipient: ${feeRecipient}  fee: ${FEE_BPS / 100}%`);

  const proxy = await upgrades.deployProxy(Market, [owner, VE_HEMI, feeRecipient, FEE_BPS], {
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
  console.log(`🪙 Payment token (from veHEMI):       ${await proxy.hemi()}`);
  console.log("-------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
