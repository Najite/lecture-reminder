import { createClient } from 'npm:@supabase/supabase-js@2.56.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("Checking for lectures starting in 1 minute...");
    
    // Call the database function to send reminder notifications
    const { error } = await supabase.rpc('send_lecture_reminder_notifications');
    
    if (error) {
      console.error("Error calling reminder function:", error);
      throw error;
    }

    console.log("Lecture reminder check completed successfully");

    return new Response(
      JSON.stringify({ message: "Lecture reminder check completed" }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        }
      }
    );

  } catch (error: any) {
    console.error("Error in check-lecture-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        }
      }
    );
  }
});