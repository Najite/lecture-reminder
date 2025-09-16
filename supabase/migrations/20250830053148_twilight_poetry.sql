/*
  # Create notification triggers for lectures

  1. New Functions
    - `send_lecture_scheduled_notifications()` - Sends notifications when a lecture is scheduled
    - `send_lecture_reminder_notifications()` - Sends notifications 1 minute before lecture starts

  2. New Triggers
    - Trigger on lecture insert to send immediate notifications
    - Scheduled function to check for lectures starting in 1 minute

  3. Security
    - Functions execute with security definer privileges
*/

-- Function to send notifications when a lecture is scheduled
CREATE OR REPLACE FUNCTION send_lecture_scheduled_notifications()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_record RECORD;
  student_email TEXT;
  lecture_time TEXT;
BEGIN
  -- Format lecture time
  lecture_time := to_char(NEW.scheduled_at, 'Day, Month DD, YYYY at HH12:MI AM');
  
  -- Get all enrolled students for this course
  FOR enrollment_record IN
    SELECT 
      e.student_id,
      p.full_name,
      p.email,
      p.notification_email,
      c.title as course_title,
      c.course_code,
      ep.notification_email as pref_email,
      ep.lecture_reminders
    FROM enrollments e
    JOIN profiles p ON e.student_id = p.id
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN email_preferences ep ON ep.user_id = p.id
    WHERE e.course_id = NEW.course_id 
    AND e.is_active = true
  LOOP
    -- Skip if lecture reminders are disabled
    IF enrollment_record.lecture_reminders IS FALSE THEN
      CONTINUE;
    END IF;
    
    -- Determine which email to use
    student_email := COALESCE(
      enrollment_record.pref_email,
      enrollment_record.notification_email,
      enrollment_record.email
    );
    
    -- Insert notification record
    INSERT INTO notifications (
      recipient_id,
      lecture_id,
      subject,
      message,
      email,
      status,
      scheduled_for
    ) VALUES (
      enrollment_record.student_id,
      NEW.id,
      'New Lecture Scheduled: ' || NEW.title,
      'A new lecture "' || NEW.title || '" has been scheduled for ' || enrollment_record.course_title || 
      ' (' || enrollment_record.course_code || ') on ' || lecture_time || 
      CASE 
        WHEN NEW.location IS NOT NULL THEN '. Location: ' || NEW.location
        ELSE ''
      END ||
      CASE 
        WHEN NEW.meeting_url IS NOT NULL THEN '. Meeting URL: ' || NEW.meeting_url
        ELSE ''
      END,
      student_email,
      'pending',
      NOW()
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send reminder notifications 1 minute before lecture
CREATE OR REPLACE FUNCTION send_lecture_reminder_notifications()
RETURNS void AS $$
DECLARE
  lecture_record RECORD;
  enrollment_record RECORD;
  student_email TEXT;
  lecture_time TEXT;
BEGIN
  -- Get lectures starting in the next minute
  FOR lecture_record IN
    SELECT 
      l.*,
      c.title as course_title,
      c.course_code
    FROM lectures l
    JOIN courses c ON l.course_id = c.id
    WHERE l.scheduled_at BETWEEN NOW() + INTERVAL '1 minute' AND NOW() + INTERVAL '2 minutes'
    AND l.is_cancelled = false
  LOOP
    -- Format lecture time
    lecture_time := to_char(lecture_record.scheduled_at, 'HH12:MI AM');
    
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
      LEFT JOIN email_preferences ep ON ep.user_id = p.id
      WHERE e.course_id = lecture_record.course_id 
      AND e.is_active = true
    LOOP
      -- Skip if lecture reminders are disabled
      IF enrollment_record.lecture_reminders IS FALSE THEN
        CONTINUE;
      END IF;
      
      -- Determine which email to use
      student_email := COALESCE(
        enrollment_record.pref_email,
        enrollment_record.notification_email,
        enrollment_record.email
      );
      
      -- Insert reminder notification record
      INSERT INTO notifications (
        recipient_id,
        lecture_id,
        subject,
        message,
        email,
        status,
        scheduled_for
      ) VALUES (
        enrollment_record.student_id,
        lecture_record.id,
        'Lecture Starting Soon: ' || lecture_record.title,
        'Your lecture "' || lecture_record.title || '" for ' || lecture_record.course_title || 
        ' (' || lecture_record.course_code || ') is starting at ' || lecture_time || 
        CASE 
          WHEN lecture_record.location IS NOT NULL THEN '. Location: ' || lecture_record.location
          ELSE ''
        END ||
        CASE 
          WHEN lecture_record.meeting_url IS NOT NULL THEN '. Join here: ' || lecture_record.meeting_url
          ELSE ''
        END,
        student_email,
        'pending',
        NOW()
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for when lectures are scheduled
CREATE OR REPLACE TRIGGER lecture_scheduled_notification_trigger
  AFTER INSERT ON lectures
  FOR EACH ROW
  EXECUTE FUNCTION send_lecture_scheduled_notifications();

-- Create trigger for when lectures are updated (rescheduled)
CREATE OR REPLACE TRIGGER lecture_updated_notification_trigger
  AFTER UPDATE OF scheduled_at ON lectures
  FOR EACH ROW
  WHEN (OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at)
  EXECUTE FUNCTION send_lecture_scheduled_notifications();