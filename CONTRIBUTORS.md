# Contributing to Mintora

Thanks for your interest in contributing to Mintora, an NFT marketplace built for Bitcoin L2 networks (Hemi).

## Project structure

Mintora is a Yarn workspaces monorepo:

```
Mintora/
├── apps/
│   ├── client/          # Vite + React frontend
│   └── server/          # Express + MongoDB backend, on-chain crawler
└── packages/
    └── marketcontract/  # Hardhat Solidity contract (NftMarketplace.sol)
```

### apps/client

- `src/pages/` — route-level pages (`Home`, `Collections`, `CollectionDetails`, `NftDetails`, `Profile`, `Create`, `Genisis`, `Settings`, `activity`, `faq`, `welcome`)
- `src/components/ui/` — shared UI primitives (shadcn/Radix-based)
- `src/hooks/` — data hooks (`use-nfts`, `use-collections`, `use-wallet`, `use-users`, `use-toast`, `use-mobile`)
- `src/lib/` — `web3.jsx` (wagmi/contract config), `hemi.js`, `uploadToR2.js`, `queryClient.js`, `navItems.js`
- Stack: React 18, Vite, wagmi + RainbowKit, Tailwind, Framer Motion, wouter, TanStack Query

### apps/server

- `index.js` — Express API entrypoint
- `crawler.js` — polls Hemi via ethers.js v6 and indexes on-chain events (uses stateless `queryFilter`/`getLogs` polling, not server-side `contract.on()` filters)
- `sync.js` — backs the root `yarn list <contract_address>` command to register/sync a new NFT collection
- `models/` — Mongoose schemas (`NFT`, `Collection`, `Activity`, `User`, `Featured`, `SyncState`)
- `routes/upload.js` — Cloudflare R2 upload endpoint
- `lib/r2.js` — R2 client config

### packages/marketcontract

- `contracts/NftMarketplace.sol` — upgradeable marketplace contract (OpenZeppelin), deployed to Hemi mainnet (chainId `43111`)
- `scripts/deploy.js` / `scripts/upgrade.js` — Hardhat deploy/upgrade scripts via `@openzeppelin/hardhat-upgrades`
- No automated test suite currently exists — see "Making changes" below

## Getting set up

Requirements: Node.js, Yarn, a MongoDB instance, and a Cloudflare R2 bucket.

```bash
git clone https://github.com/Nabilislam722/Mintora.git
cd Mintora
yarn install
```

Create `apps/server/.env` (see `apps/server/.env.example`) — it needs at least:

```
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_URL=
DATABASE_URL=
```

Run the server, client, and crawler together:

```bash
yarn dev
```

Newly listed collections won't appear until indexed:

```bash
yarn list <nft_contract_address>
```

## Making changes

- **Frontend-only** (a page, a hook, a UI component): work in `apps/client`, run `yarn workspace client dev`.
- **Backend/indexing**: work in `apps/server`. If it touches on-chain reads, run the crawler (`yarn workspace server crawler`) against a testnet or forked RPC before opening a PR — there's no automated test suite yet, so manual verification against real chain data is the main safety net.
- **Smart contract**: work in `packages/marketcontract`. The contract is upgradeable (proxy pattern) — call out any storage-layout-breaking change explicitly in your PR, and run `npx hardhat compile` at minimum before submitting. A PR that adds Hardhat tests for the contract is especially welcome.

## Pull requests

1. Fork the repo and branch off `main`.
2. Keep PRs scoped to one concern (frontend, backend, or contract) — it's easier to review.
3. Describe what changed and why, and call out any new environment variables or migration steps.
4. Link any related issue.

## Reporting bugs / requesting features

Open a GitHub issue with:
- What you expected vs. what happened
- Steps to reproduce, including wallet/network used (Mintora targets Hemi mainnet, chainId `43111`)
- Screenshots or console/server logs where useful

## License

Mintora is MIT licensed — see [LICENSE](LICENSE). By contributing, you agree your contributions are licensed under the same terms.