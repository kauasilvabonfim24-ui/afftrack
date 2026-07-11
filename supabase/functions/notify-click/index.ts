import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const { linkName, commission, todayClicks, totalClicks } = await req.json();
  await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "os_v2_app_gc2nxi4t5rcwxihnvkyucovlj4s2cqxwjbuui6vblxbb6n72jsyjep3kog5i4s6zmmlaqxybsh5u7yimgjcjynauxptti62jmrhopeq",
    },
    body: JSON.stringify({
      app_id: "30b4dba3-93ec-456b-a0ed-aab1413aab4f",
      include_subscription_ids: ["39ae6460-ed41-488c-8b2f-f56cc55d3709"],
      headings: { pt: "🔥 Novo clique!", en: "🔥 Novo clique!" },
      contents: {
        pt: `🎯 ${linkName} | Hoje: ${todayClicks} cliques · Total: ${totalClicks} · 💰 R$ ${commission} possível`,
        en: `🎯 ${linkName} | Hoje: ${todayClicks} cliques · Total: ${totalClicks} · 💰 R$ ${commission} possível`,
      },
    }),
  });
  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
