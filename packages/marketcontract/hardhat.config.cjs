require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("@openzeppelin/hardhat-upgrades"); // Must be here
require("dotenv/config");

const settings = {
  viaIR: true,
  optimizer: {
    enabled: true,
    runs: 200,
  },
};

// The veHEMI marketplace builds with the latest compiler. Hemi runs Cancun opcodes but not Osaka's CLZ,
// so pin the EVM target instead of using 0.8.38's default (osaka).
const veHemi = { version: "0.8.38", settings: { ...settings, evmVersion: "cancun" } };

module.exports = {
  solidity: {
    // Mintora (NftMarketplace.sol) stays on the compiler it was deployed with
    compilers: [{ version: "0.8.24", settings }],
    overrides: {
      "contracts/MintoraVeHemi.sol": veHemi,
      "contracts/interfaces/IVeHemi.sol": veHemi,
      "contracts/mocks/MockERC20.sol": veHemi,
      "contracts/mocks/MockVeHemi.sol": veHemi,
      "contracts/mocks/ReentrantBuyer.sol": veHemi,
    },
  },
  etherscan: {
    apiKey: {
      hemi: "routescan",
    },
    customChains: [
      {
        network: "hemi",
        chainId: 43111,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/mainnet/evm/43111/etherscan",
          browserURL: "https://routescan.io",
        },
      },
    ],
  },
  networks: {
    hemi: {
      url: "https://rpc.hemi.network/rpc",
      accounts: [process.env.WALLET_PRIVATE_KEY],
    },
  },
};