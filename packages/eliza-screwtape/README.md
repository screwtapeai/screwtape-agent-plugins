# @screwtapeai/plugin-screwtape

An [ElizaOS](https://elizaos.ai) plugin that calls [Screwtape.ai](https://screwtape.ai) **before** your agent pays a seller.

Actions:

- `SCREWTAPE_CHECK_SELLER` — is this seller safe to pay?
- `SCREWTAPE_TRUST_SCORE` — is this paying agent risky?

Uses the shared free allowance first (3 calls a day with no key, 10 with a free key). After that, pass a payment-capable `fetch` so the agent can pay $0.005 / $0.02 per call. Details: https://screwtape.ai/llms.txt

## Install

```bash
npm install @screwtapeai/plugin-screwtape
```

```ts
import { screwtapePlugin } from "@screwtapeai/plugin-screwtape";

const character = {
  plugins: [screwtapePlugin],
};
```

Only pay a seller when the check returns **allow**.
