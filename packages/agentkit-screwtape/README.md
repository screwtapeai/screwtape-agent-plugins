# @screwtapeai/agentkit-screwtape

A Coinbase AgentKit action provider that calls [Screwtape.ai](https://screwtape.ai) **before** your agent pays a seller.

Actions:

- `screwtape_check_seller` — is this seller safe to pay? (`POST /v1/payment-check`, $0.005 after the free allowance)
- `screwtape_trust_score` — is this paying agent risky? (`POST /v1/trust-score`, $0.02 after the free allowance)

The human-facing description is a pre-payment safety check. Technical payment terms for agents are in [Screwtape.ai llms.txt](https://screwtape.ai/llms.txt).

## Install

```bash
npm install @screwtapeai/agentkit-screwtape
```

## Use

```ts
import { AgentKit } from "@coinbase/agentkit";
import { screwtapeActionProvider } from "@screwtapeai/agentkit-screwtape";

const agentkit = await AgentKit.from({
  actionProviders: [screwtapeActionProvider()],
});
```

To pay per call after the free allowance, pass a payment-capable `fetch` (for example the official `@x402/fetch` wrapper) as `fetchImpl`. See the comments in `src/screwtapeActionProvider.ts` and https://screwtape.ai/llms.txt.

Only pay a seller when `screwtape_check_seller` returns **allow**.
