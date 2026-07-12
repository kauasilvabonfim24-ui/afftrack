import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://dsgxkhpeomdadzfkfadu.supabase.co';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_BdTgJVPErF9ta0z5vZZLLQ_V5nuSAqM';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  // Get OneSignal configuration from database
  const { data: configData, error: configError } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'onesignal_app_id')
    .single();
    
  const { data: restKeyData, error: restKeyError } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'onesignal_rest_api_key')
    .single();
    
  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'onesignal_subscription_id')
    .single();
    
  if (configError || restKeyError || subscriptionError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch OneSignal config' }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
  
  const { linkName, commission, todayClicks, totalClicks } = await req.json();
  
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${restKeyData.value}`,
    },
    body: JSON.stringify({
      app_id: configData.value,
      include_subscription_ids: [subscriptionData.value],
      headings: { pt: "🔥 Novo clique!", en: "🔥 Novo clique!" },
      contents: {
        pt: `🎯 ${linkName} | Hoje: ${todayClicks} cliques · Total: ${totalClicks} · 💰 R$ ${commission} possível`,
        en: `🎯 ${linkName} | Hoje: ${todayClicks} cliques · Total: ${totalClicks} · 💰 R$ ${commission} possível`,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return new Response(JSON.stringify({ error: err }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  return new Response(JSON.stringify({ ok: true }), { 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });
});