import { z } from "zod";

/**
 * Screwtape.ai action provider for Coinbase AgentKit.
 *
 * Shaped so it can be copied into coinbase/agentkit at
 * typescript/agentkit/src/action-providers/screwtape/.
 *
 * In this standalone package the AgentKit decorators are optional: if
 * @coinbase/agentkit is not installed, the functions still work as a plain client.
 */

const BASE = "https://screwtape.ai";

export const CheckSellerSchema = z.object({
  seller_url: z.string().url().describe("Public https URL of the seller or paid endpoint you are about to pay."),
  intended_amount: z.number().optional().describe("Amount in US dollars you intend to pay."),
  agent_id: z.string().optional().describe("Optional tag for the agent making this call."),
});

export const TrustScoreSchema = z.object({
  subject_kind: z.enum(["payer", "agent", "caller"]).describe("What you are scoring."),
  subject_value: z.string().describe("The payer, agent or caller identifier to score."),
  agent_id: z.string().optional().describe("Optional tag for the reporting agent."),
});

export type ScrewtapeProviderOptions = {
  /** Payment-capable fetch. After the free allowance, this should retry a 402 with a signed payment header. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
  userAgent?: string;
};

async function postJson(
  path: string,
  body: Record<string, unknown>,
  opts: ScrewtapeProviderOptions,
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": opts.userAgent ?? "screwtape-agentkit-plugin/0.1.0",
  };
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(`${opts.baseUrl ?? BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    /* leave as text */
  }
  return { status: response.status, json: parsed };
}

export function formatCheck(result: { status: number; json: any }): string {
  const body = result.json && typeof result.json === "object" ? result.json : {};
  if (result.status === 402) {
    return [
      "PAYMENT REQUIRED: the free allowance is used. Retry with a payment-capable fetch (@x402/fetch or the official x402 Python client).",
      body.how_to_pay?.guidance ?? body.next_action ?? "See https://screwtape.ai/llms.txt",
      `Price: $${body.how_to_pay?.price_usd ?? "0.005"} per call.`,
    ].join(" ");
  }
  if (result.status !== 200) {
    return `Check failed (${result.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`;
  }
  const verdict = String(body.verdict ?? body.decision ?? "review").toUpperCase();
  const reasons = Array.isArray(body.reasons) ? body.reasons.join("; ") : "no reasons given";
  const receipt = body.receipt_id ? ` Receipt: ${body.receipt_id}.` : "";
  const cue = verdict === "ALLOW" ? "Safe to pay." : verdict === "BLOCK" ? "Do not pay." : "Ask a person before paying.";
  return `${cue} ${verdict}: ${reasons}.${receipt}`;
}

export async function checkSeller(args: z.infer<typeof CheckSellerSchema>, opts: ScrewtapeProviderOptions = {}) {
  return postJson(
    "/v1/payment-check",
    {
      seller_url: args.seller_url,
      intended_amount: args.intended_amount,
      agent_id: args.agent_id,
    },
    opts,
  );
}

export async function trustScore(args: z.infer<typeof TrustScoreSchema>, opts: ScrewtapeProviderOptions = {}) {
  return postJson(
    "/v1/trust-score",
    {
      subject: { kind: args.subject_kind, value: args.subject_value },
      agent_id: args.agent_id,
    },
    opts,
  );
}

/** Factory used with AgentKitConfig.actionProviders. */
export function screwtapeActionProvider(opts: ScrewtapeProviderOptions = {}) {
  return {
    name: "screwtape",
    supportsNetwork: () => true,
    getActions: () => [
      {
        name: "screwtape_check_seller",
        description:
          "Call this BEFORE paying any seller or paid API. Returns allow, review or block with reasons and a signed receipt id. Only pay when the answer starts with 'Safe to pay'.",
        schema: CheckSellerSchema,
        invoke: async (args: z.infer<typeof CheckSellerSchema>) => formatCheck(await checkSeller(args, opts)),
      },
      {
        name: "screwtape_trust_score",
        description:
          "Score whether a paying agent looks risky before you accept their payment. Returns a score, risk, allow/review/block and reasons.",
        schema: TrustScoreSchema,
        invoke: async (args: z.infer<typeof TrustScoreSchema>) => {
          const result = await trustScore(args, opts);
          if (result.status !== 200) return formatCheck(result);
          const body = result.json;
          return `Trust score ${body.score} (${body.risk ?? "unknown"} risk). Verdict: ${body.verdict ?? body.decision}. ${(body.reasons || []).join("; ")}`;
        },
      },
    ],
  };
}

export default screwtapeActionProvider;
