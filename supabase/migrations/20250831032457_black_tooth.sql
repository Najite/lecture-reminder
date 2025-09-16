/*
  # Automatic Email Notification System

  1. New Functions
    - `schedule_lecture_notifications` - Creates notification records when lectures are scheduled
    - `send_due_notifications` - Processes and sends notifications that are due
    - `process_lecture_reminders` - Sends 1-minute reminders for lectures

  2. Triggers
    - Auto-schedule notifications when lectures are created or updated
    - Auto-schedule 1-minute reminders

  3. Security
    - Functions are security definer to allow system operations
*/

-- Function to schedule notifications when a lecture is created/updated
CREATE OR REPLACE FUNCTION schedule_lecture_notifications()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_record RECORD;
  student_email TEXT;
  notification_time TIMESTAMPTZ;
  reminder_time TIMESTAMPTZ;
BEGIN
  -- Only process if this is a new lecture or the scheduled time changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at) THEN
    
    -- Calculate notification times
    notification_time := NEW.scheduled_at - INTERVAL '24 hours'; -- 24 hours before
    reminder_time := NEW.scheduled_at - INTERVAL '1 minute'; -- 1 minute before
    
    -- Get all enrolled students for this course
    FOR enrollment_record IN 
      SELECT 
        e.student_id,
        p.full_name,
        p.email,
        p.notification_email,
        ep.notification_email as pref_email,
        ep.lecture_reminders
      FROM enrollments e
      JOIN profiles p ON e.student_id = p.id
      LEFT JOIN email_preferences ep ON e.student_id = ep.user_id
      WHERE e.course_id = NEW.course_id 
        AND e.is_active = true
    LOOP
      -- Determine which email to use
      student_email := COALESCE(
        enrollment_record.pref_email,
        enrollment_record.notification_email,
        enrollment_record.email
      );
      
      -- Only create notifications if student has lecture reminders enabled (default true)
      IF COALESCE(enrollment_record.lecture_reminders, true) THEN
        
        -- Schedule 24-hour advance notification
        INSERT INTO notifications (
          lecture_id,
          recipient_id,
          email,
          subject,
          message,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          enrollment_record.student_id,
          student_email,
          'New Lecture Scheduled: ' || NEW.title,
          'A new lecture "' || NEW.title || '" has been scheduled for ' || 
          TO_CHAR(NEW.scheduled_at, 'Day, DD Mon YYYY at HH24:MI') || 
          CASE 
            WHEN NEW.location IS NOT NULL THEN ' at ' || NEW.location
            ELSE ''
          END ||
          CASE 
            WHEN NEW.meeting_url IS NOT NULL THEN '. Meeting URL: ' || NEW.meeting_url
            ELSE ''
          END,
          notification_time,
          'pending'
        );
        
        -- Schedule 1-minute reminder (only if lecture is more than 1 minute away)
        IF NEW.scheduled_at > NOW() + INTERVAL '1 minute' THEN
          INSERT INTO notifications (
            lecture_id,
            recipient_id,
            email,
            subject,
            message,
            scheduled_for,
            status
          ) VALUES (
            NEW.id,
            enrollment_record.student_id,
            student_email,
            'Lecture Starting Soon: ' || NEW.title,
            'Your lecture "' || NEW.title || '" is starting in 1 minute!' ||
            CASE 
              WHEN NEW.location IS NOT NULL THEN ' Location: ' || NEW.location
              ELSE ''
            END ||
            CASE 
              WHEN NEW.meeting_url IS NOT NULL THEN ' Meeting URL: ' || NEW.meeting_url
              ELSE ''
            END,
            reminder_time,
            'pending'
          );
        END IF;
        
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process and send due notifications
CREATE OR REPLACE FUNCTION send_due_notifications()
RETURNS void AS $$
DECLARE
  notification_record RECORD;
  api_url TEXT := 'https://btkbqkyfdmbwboutvxda.supabase.co/functions/v1/process-notifications';
BEGIN
  -- Call the edge function to process notifications
  PERFORM net.http_post(
    url := api_url,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic notification scheduling
DROP TRIGGER IF EXISTS lecture_notification_trigger ON lectures;
CREATE TRIGGER lecture_notification_trigger
  AFTER INSERT OR UPDATE OF scheduled_at ON lectures
  FOR EACH ROW
  EXECUTE FUNCTION schedule_lecture_notifications();

-- Create a function that can be called by cron to process notifications
CREATE OR REPLACE FUNCTION process_pending_notifications()
RETURNS void AS $$
BEGIN
  PERFORM send_due_notifications();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;