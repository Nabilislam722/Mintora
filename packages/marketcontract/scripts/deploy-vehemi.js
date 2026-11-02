// Deploys MintoraVeHemi behind a UUPS proxy on Hemi, then verifies it on Blockscout (explorer.hemi.xyz) and
// Routescan.
//
//   npx hardhat run scripts/deploy-vehemi.js --network hemi
//
// Optional settings, read from .env:
//   VEHEMI_OWNER          owner of the marketplace (pause, fees, upgrades). Defaults to the deployer.
//   VEHEMI_FEE_RECIPIENT  where fees go. Defaults to the deployer.
//   VEHEMI_PROXY          skip deploying and only verify this proxy, e.g. if an explorer was down.
//
// To rehearse on a local fork of Hemi, which deploys nothing and spends nothing:
//   HEMI_FORK_URL=https://rpc.hemi.network/rpc npx hardhat run scripts/deploy-vehemi.js
import hre from "hardhat";
const { ethers, upgrades, network } = hre;

const VE_HEMI = "0x371d3718D5b7F75EAb050FAe6Da7DF3092031c89"; // the contract reads HEMI from veHEMI.HEMI()
const FEE_BPS = 500; // 5%, matches LISTING_FEE_BPS in the client
const HEMI_CHAIN_ID = 43111n;
const CONFIRMATIONS = 5; // lets the explorers index the deployment before verifying
const VERIFY_ATTEMPTS = 5;
const VERIFY_RETRY_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const live = chainId === HEMI_CHAIN_ID;
  const fork = network.name === "hardhat" && network.config.forking?.enabled;
  if (!live && !fork) {
    throw new Error(
      `Run this with --network hemi, or set HEMI_FORK_URL to rehearse on a fork (got ${network.name}, chain ${chainId})`
    );
  }
  // Calls at the fork block itself fail without Hemi's hardfork history, so work on a local block after it
  if (fork) await network.provider.send("hardhat_mine", ["0x1"]);

  const proxyAddress = process.env.VEHEMI_PROXY || (await deploy(live));
  if (!ethers.isAddress(proxyAddress)) throw new Error(`VEHEMI_PROXY is not an address: ${proxyAddress}`);

  if (!live) {
    console.log("\nFork rehearsal finished. Nothing was deployed to Hemi, so verification is skipped.");
    return;
  }
  await verify(proxyAddress);
}

async function deploy(live) {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.VEHEMI_OWNER || deployer.address;
  const feeRecipient = process.env.VEHEMI_FEE_RECIPIENT || deployer.address;
  for (const [name, value] of [["VEHEMI_OWNER", owner], ["VEHEMI_FEE_RECIPIENT", feeRecipient]]) {
    if (!ethers.isAddress(value)) throw new Error(`${name} is not an address: ${value}`);
  }

  // Fail before spending gas if veHEMI isn't where we expect it
  if ((await ethers.provider.getCode(VE_HEMI)) === "0x") throw new Error(`No contract at veHEMI address ${VE_HEMI}`);
  const ve = new ethers.Contract(VE_HEMI, ["function HEMI() view returns (address)"], ethers.provider);
  const hemi = await ve.HEMI();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("-------------------------------------------------");
  console.log(`Network:        ${live ? "Hemi mainnet" : "local fork of Hemi"}`);
  console.log(`Deployer:       ${deployer.address} (${ethers.formatEther(balance)} ETH)`);
  console.log(`Owner:          ${owner}`);
  console.log(`Fee recipient:  ${feeRecipient}`);
  console.log(`Fee:            ${FEE_BPS / 100}%`);
  console.log(`veHEMI:         ${VE_HEMI}`);
  console.log(`HEMI:           ${hemi}`);
  console.log("-------------------------------------------------");
  if (balance === 0n) throw new Error("The deployer has no ETH for gas");
  if (live) {
    console.log("Deploying to Hemi mainnet in 10 seconds. Press Ctrl+C to abort.");
    await sleep(10_000);
  }

  console.log("📡 Deploying MintoraVeHemi proxy + implementation...");
  const Market = await ethers.getContractFactory("MintoraVeHemi");
  const proxy = await upgrades.deployProxy(Market, [owner, VE_HEMI, feeRecipient, FEE_BPS], {
    initializer: "initialize",
    kind: "uups",
  });
  await proxy.waitForDeployment();
  if (live) {
    console.log(`Waiting for ${CONFIRMATIONS} confirmations...`);
    await proxy.deploymentTransaction().wait(CONFIRMATIONS);
  }

  const proxyAddress = await proxy.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  // Read the settings back through the proxy, so a bad initialization is caught now rather than by users
  const checks = [
    ["owner", await proxy.owner(), owner],
    ["veHemi", await proxy.veHemi(), VE_HEMI],
    ["hemi", await proxy.hemi(), hemi],
    ["feeRecipient", await proxy.feeRecipient(), feeRecipient],
    ["feeBps", await proxy.feeBps(), FEE_BPS],
  ];
  for (const [name, actual, expected] of checks) {
    if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
      throw new Error(`Deployed proxy has ${name} = ${actual}, expected ${expected}`);
    }
  }

  console.log("-------------------------------------------------");
  console.log(`✅ Deployed!`);
  console.log(`📍 Proxy Address (The one users use): ${proxyAddress}`);
  console.log(`🧠 Logic Address (The one with code):  ${implementationAddress}`);
  console.log("-------------------------------------------------");
  return proxyAddress;
}

async function verify(proxyAddress) {
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  // Blockscout recognises the standard proxy by its bytecode and links it, so only the implementation is sent
  console.log("\n🔎 Verifying on Blockscout (explorer.hemi.xyz)...");
  const blockscout = await retry("Blockscout", () => hre.run("verify:blockscout", { address: implementationAddress }));

  // Given the proxy, the upgrades plugin verifies the implementation and the proxy, then links them
  console.log("\n🔎 Verifying on Routescan...");
  const routescan = await retry("Routescan", () => hre.run("verify:verify", { address: proxyAddress }));

  console.log("-------------------------------------------------");
  console.log(`Blockscout: ${blockscout ? "✅ verified" : "❌ failed"}  https://explorer.hemi.xyz/address/${proxyAddress}`);
  console.log(`Routescan:  ${routescan ? "✅ verified" : "❌ failed"}`);
  if (!blockscout || !routescan) {
    console.log(`\nTo retry verification without redeploying, set VEHEMI_PROXY=${proxyAddress} and run this again.`);
    process.exitCode = 1;
  }
}

// Explorers can take a while to index a new deployment, so failed attempts are retried
async function retry(label, attempt) {
  for (let i = 1; i <= VERIFY_ATTEMPTS; i++) {
    try {
      await attempt();
      return true;
    } catch (error) {
      console.warn(`${label} attempt ${i}/${VERIFY_ATTEMPTS} failed: ${error.message}`);
      if (i < VERIFY_ATTEMPTS) await sleep(VERIFY_RETRY_MS);
    }
  }
  return false;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
