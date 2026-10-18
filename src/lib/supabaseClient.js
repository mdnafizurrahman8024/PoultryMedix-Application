import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in poultry-medix/.env.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Call from the browser console or app code to verify access to the documents table. */
export async function checkSupabaseConnection() {
  try {
    const { error } = await supabase.from("documents").select("*").limit(1);

    if (error) {
      console.error("Supabase connection check failed:", error.message);
      return false;
    }

    console.log("Supabase connected; documents table is reachable.");
    return true;
  } catch (error) {
    console.error(
      "Supabase connection check failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
