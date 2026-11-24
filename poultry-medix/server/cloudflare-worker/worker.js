/**
 * Cloudflare Worker Proxy for OpenRouter Free Tier
 * Deploy on Cloudflare Workers (e.g. zundeck-free-proxy)
 *
 * Environment variables required in Cloudflare Worker:
 * - OPENROUTER_FREE_KEY : Your OpenRouter API key
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("ZunDeck Proxy is Running!", {
        status: 200,
        headers: corsHeaders,
      });
    }

    try {
      const body = await request.json();

      if (!body.model || !body.model.endsWith(":free")) {
        return new Response(
          JSON.stringify({
            error: "Only :free models are allowed on the free tier.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const apiUrl = "https://openrouter.ai" + "/api/v1/chat/completions";

      const openRouterResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENROUTER_FREE_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://zundeck.app",
          "X-Title": "ZunDeck & PoultryMedix",
        },
        body: JSON.stringify(body),
      });

      const responseText = await openRouterResponse.text();

      return new Response(responseText, {
        status: openRouterResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message || "Internal Proxy Error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};
