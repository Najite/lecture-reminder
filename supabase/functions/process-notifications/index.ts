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
    console.log("Processing pending notifications...");
    
    // Get pending notifications that are due
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select(`
        *,
        lecture:lecture_id (
          title,
          scheduled_at,
          location,
          meeting_url,
          course:course_id (
            title,
            course_code
          )
        ),
        profile:recipient_id (
          full_name
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);

    if (notificationsError) {
      console.error("Error fetching notifications:", notificationsError);
      throw notificationsError;
    }

    console.log(`Found ${notifications?.length || 0} pending notifications`);

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending notifications to process" }),
        { 
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders 
          } 
        }
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (const notification of notifications) {
      try {
        // Prepare email data for EmailJS
        const emailData = {
          service_id: 'service_3ux4e79',
          template_id: 'template_3smtuc7',
          user_id: 'iqrbya988WpE1wUcR',
          template_params: {
            to_email: notification.email,
            student_name: notification.profile?.full_name || 'Student',
            subject: notification.subject,
            message: notification.message,
            lecture_title: notification.lecture?.title || '',
            course_title: notification.lecture?.course?.title || '',
            course_code: notification.lecture?.course?.course_code || '',
            lecture_time: notification.lecture?.scheduled_at ? 
              new Date(notification.lecture.scheduled_at).toLocaleString() : '',
            location: notification.lecture?.location || 'Online',
            meeting_url: notification.lecture?.meeting_url || ''
          }
        };

        // Send email via EmailJS API
        const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailData)
        });

        if (emailResponse.ok) {
          // Update notification status to sent
          await supabase
            .from('notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          successCount++;
          console.log(`✅ Notification sent successfully to ${notification.email}`);
        } else {
          const errorText = await emailResponse.text();
          console.error(`❌ Failed to send notification to ${notification.email}:`, errorText);
          
          // Update notification status to failed
          await supabase
            .from('notifications')
            .update({
              status: 'failed',
              error_message: errorText
            })
            .eq('id', notification.id);
          
          failCount++;
        }
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Update notification status to failed
        await supabase
          .from('notifications')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', notification.id);
        
        failCount++;
      }
    }

    console.log(`Processed notifications: ${successCount} successful, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: `Processed ${notifications.length} notifications`,
        successful: successCount,
        failed: failCount
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        }
      }
    );

  } catch (error: any) {
    console.error("Error in process-notifications function:", error);
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