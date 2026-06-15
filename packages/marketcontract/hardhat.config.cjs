require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("@openzeppelin/hardhat-upgrades"); // Must be here
require("dotenv/config");

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
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