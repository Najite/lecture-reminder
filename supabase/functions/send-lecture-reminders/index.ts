import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailJSPayload {
  service_id: string;
  template_id: string;
  user_id: string;
  template_params: {
    to_email: string;
    student_name: string;
    lecture_title: string;
    course_title: string;
    lecture_time: string;
    location: string;
    meeting_url?: string;
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const emailjsServiceId = Deno.env.get("EMAILJS_SERVICE_ID")!;
const emailjsTemplateId = Deno.env.get("EMAILJS_TEMPLATE_ID")!;
const emailjsPublicKey = Deno.env.get("EMAILJS_PUBLIC_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting lecture reminder process...");
    
    // Get lectures that are scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const { data: lectures, error: lecturesError } = await supabase
      .from('lectures')
      .select(`
        *,
        courses!inner(*)
      `)
      .gte('scheduled_at', tomorrowStart.toISOString())
      .lt('scheduled_at', tomorrowEnd.toISOString())
      .eq('is_cancelled', false);

    if (lecturesError) {
      console.error("Error fetching lectures:", lecturesError);
      throw lecturesError;
    }

    console.log(`Found ${lectures?.length || 0} lectures for tomorrow`);

    if (!lectures || lectures.length === 0) {
      return new Response(
        JSON.stringify({ message: "No lectures scheduled for tomorrow" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let totalReminders = 0;
    let successfulReminders = 0;

    for (const lecture of lectures) {
      try {
        // Get enrolled students for this course
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select(`
            *,
            profiles!inner(*)
          `)
          .eq('course_id', lecture.course_id)
          .eq('is_active', true);

        if (enrollmentsError) {
          console.error("Error fetching enrollments:", enrollmentsError);
          continue;
        }

        console.log(`Found ${enrollments?.length || 0} students for lecture: ${lecture.title}`);

        for (const enrollment of enrollments || []) {
          totalReminders++;
          
          // Get student's email preferences
          const { data: emailPref, error: emailPrefError } = await supabase
            .from('email_preferences')
            .select('*')
            .eq('user_id', enrollment.profiles.id)
            .single();

          // Use notification_email from preferences or fall back to profile email
          const studentEmail = emailPref?.notification_email || enrollment.profiles.notification_email || enrollment.profiles.email;
          
          // Skip if lecture reminders are disabled
          if (emailPref && !emailPref.lecture_reminders) {
            console.log(`Skipping reminder for ${studentEmail} - lecture reminders disabled`);
            continue;
          }

          // Format lecture time
          const lectureTime = new Date(lecture.scheduled_at).toLocaleString();

          // Prepare EmailJS payload
          const emailPayload: EmailJSPayload = {
            service_id: emailjsServiceId,
            template_id: emailjsTemplateId,
            user_id: emailjsPublicKey,
            template_params: {
              to_email: studentEmail,
              student_name: enrollment.profiles.full_name,
              lecture_title: lecture.title,
              course_title: lecture.courses.title,
              lecture_time: lectureTime,
              location: lecture.location || "Online",
              meeting_url: lecture.meeting_url
            }
          };

          // Send email via EmailJS API
          const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailPayload)
          });

          if (emailResponse.ok) {
            successfulReminders++;
            console.log(`Reminder sent successfully to ${studentEmail}`);
            
            // Create notification record
            await supabase.from('notifications').insert({
              recipient_id: enrollment.profiles.id,
              lecture_id: lecture.id,
              subject: `Reminder: ${lecture.title} tomorrow`,
              message: `Don't forget about your ${lecture.courses.title} lecture tomorrow at ${lectureTime}`,
              email: studentEmail,
              status: 'sent',
              scheduled_for: new Date().toISOString(),
              sent_at: new Date().toISOString()
            });
          } else {
            const errorText = await emailResponse.text();
            console.error(`Failed to send reminder to ${studentEmail}:`, errorText);
            
            // Create failed notification record
            await supabase.from('notifications').insert({
              recipient_id: enrollment.profiles.id,
              lecture_id: lecture.id,
              subject: `Reminder: ${lecture.title} tomorrow`,
              message: `Don't forget about your ${lecture.courses.title} lecture tomorrow at ${lectureTime}`,
              email: studentEmail,
              status: 'failed',
              scheduled_for: new Date().toISOString(),
              error_message: errorText
            });
          }
        }
      } catch (error) {
        console.error(`Error processing lecture ${lecture.title}:`, error);
      }
    }

    console.log(`Sent ${successfulReminders}/${totalReminders} reminders successfully`);

    return new Response(
      JSON.stringify({
        message: `Processed ${totalReminders} reminders, ${successfulReminders} sent successfully`,
        totalReminders,
        successfulReminders
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error("Error in send-lecture-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

serve(handler);