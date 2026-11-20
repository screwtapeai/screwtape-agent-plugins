# Screwtape.ai agent plugins

Open-source plugins that ask [Screwtape.ai](https://screwtape.ai) whether a seller is safe to pay, and whether a paying agent looks risky, **before** your agent sends a payment.

- `packages/agentkit-screwtape` — a Coinbase AgentKit action provider
- `packages/eliza-screwtape` — an ElizaOS plugin

Both call Screwtape.ai `payment-check` ($0.005) and `trust-score` ($0.02). They use the shared free allowance first (3 calls a day with no key, 10 with a free key). After that they can pay per call automatically if you pass a payment-capable fetch. See each package README.

Public contact: support@screwtape.ai

## License

MIT
