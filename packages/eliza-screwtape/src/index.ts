/**
 * ElizaOS plugin: ask Screwtape.ai whether a seller is safe to pay, and whether a paying agent looks risky,
 * before the character sends a payment.
 */
const BASE = "https://screwtape.ai";

type PluginOpts = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
};

async function callScrewtape(path: string, body: Record<string, unknown>, opts: PluginOpts = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "screwtape-eliza-plugin/0.1.0",
  };
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(`${opts.baseUrl ?? BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

function sellerText(result: { status: number; json: any }): string {
  const body = result.json || {};
  if (result.status === 402) {
    return `The free allowance is used. Pay $0.005 per call with a payment-capable client (see https://screwtape.ai/llms.txt). ${body.how_to_pay?.guidance ?? body.next_action ?? ""}`;
  }
  if (result.status !== 200) return `Screwtape.ai check failed (${result.status}). Do not pay.`;
  const verdict = String(body.verdict ?? body.decision ?? "review").toUpperCase();
  const reasons = Array.isArray(body.reasons) ? body.reasons.join("; ") : "no reasons given";
  const cue = verdict === "ALLOW" ? "Safe to pay." : verdict === "BLOCK" ? "Do not pay." : "Ask a person before paying.";
  return `${cue} ${verdict}: ${reasons}.${body.receipt_id ? ` Receipt: ${body.receipt_id}.` : ""}`;
}

export const checkSellerAction = {
  name: "SCREWTAPE_CHECK_SELLER",
  similes: ["CHECK_SELLER", "SELLER_SAFE_TO_PAY", "PRE_PAYMENT_CHECK"],
  description:
    "Call this BEFORE paying any seller or paid API. Returns allow, review or block with reasons and a signed receipt. Only pay on allow.",
  validate: async () => true,
  handler: async (_runtime: unknown, message: { content?: { text?: string; seller_url?: string; intended_amount?: number } }) => {
    const text = message.content?.text ?? "";
    const url = message.content?.seller_url ?? text.match(/https?:\/\/\S+/)?.[0];
    if (!url) return { success: false, text: "Need a seller URL to check." };
    const result = await callScrewtape("/v1/payment-check", {
      seller_url: url,
      intended_amount: message.content?.intended_amount,
      agent_id: "eliza",
    });
    return { success: result.status === 200, text: sellerText(result) };
  },
  examples: [
    [
      { user: "{{user1}}", content: { text: "Is https://seller.example/pay safe to pay 0.05?" } },
      { user: "{{agent}}", content: { text: "I will check the seller with Screwtape.ai before paying.", action: "SCREWTAPE_CHECK_SELLER" } },
    ],
  ],
};

export const trustScoreAction = {
  name: "SCREWTAPE_TRUST_SCORE",
  similes: ["SCORE_PAYER", "PAYER_RISK"],
  description: "Score whether a paying agent looks risky before you accept their payment.",
  validate: async () => true,
  handler: async (_runtime: unknown, message: { content?: { text?: string; subject?: string } }) => {
    const value = message.content?.subject ?? message.content?.text ?? "";
    if (!value) return { success: false, text: "Need a payer or agent identifier to score." };
    const result = await callScrewtape("/v1/trust-score", {
      subject: { kind: "agent", value: String(value).slice(0, 200) },
      agent_id: "eliza",
    });
    if (result.status !== 200) return { success: false, text: sellerText(result) };
    const body = result.json;
    return {
      success: true,
      text: `Trust score ${body.score} (${body.risk ?? "unknown"} risk). Verdict: ${body.verdict ?? body.decision}. ${(body.reasons || []).join("; ")}`,
    };
  },
  examples: [],
};

export const screwtapePlugin = {
  name: "@screwtapeai/plugin-screwtape",
  description: "Check a seller with Screwtape.ai before an agent pays, and score paying-agent risk.",
  actions: [checkSellerAction, trustScoreAction],
};

export default screwtapePlugin;
