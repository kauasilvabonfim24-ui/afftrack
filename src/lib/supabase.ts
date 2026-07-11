import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dsgxkhpeomdadzfkfadu.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_BdTgJVPErF9ta0z5vZZLLQ_V5nuSAqM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
