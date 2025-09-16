import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import emailjs from '@emailjs/browser';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ExternalLink, 
  Send,
  Users,
  Edit,
  Trash2
} from 'lucide-react';

interface Lecture {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  meeting_url: string;
  is_cancelled: boolean;
  course: {
    id: string;
    title: string;
    course_code: string;
    color: string;
  };
}

interface LectureCardProps {
  lecture: Lecture;
  onUpdate?: () => void;
}

const LectureCard: React.FC<LectureCardProps> = ({ lecture, onUpdate }) => {
  const [sendingReminder, setSendingReminder] = useState(false);
  const { toast } = useToast();

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const isLectureToday = (dateString: string) => {
    const lectureDate = new Date(dateString);
    const today = new Date();
    return lectureDate.toDateString() === today.toDateString();
  };

  const isLecturePast = (dateString: string) => {
    const lectureDate = new Date(dateString);
    const now = new Date();
    return lectureDate < now;
  };

  const sendLectureReminder = async () => {
    setSendingReminder(true);
    try {
      // Get enrolled students for this course
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          profiles!enrollments_student_id_fkey(
            id,
            full_name,
            email,
            notification_email
          )
        `)
        .eq('course_id', lecture.course.id)
        .eq('is_active', true);

      if (enrollmentsError) {
        throw enrollmentsError;
      }

      if (!enrollments || enrollments.length === 0) {
        toast({
          title: "No students enrolled",
          description: "There are no students enrolled in this course.",
          variant: "destructive",
        });
        return;
      }

      // Get email preferences for each student (for notification email only)
      const studentIds = enrollments.map(e => e.student_id);
      const { data: emailPreferences } = await supabase
        .from('email_preferences')
        .select('user_id, notification_email')
        .in('user_id', studentIds);

      const emailPrefsMap = new Map(
        emailPreferences?.map(pref => [pref.user_id, pref]) || []
      );

      // Send emails to ALL students (reminders are mandatory)
      const emailsSent = [];
      const notifications = [];
      const dateTime = formatDateTime(lecture.scheduled_at);
      
      for (const enrollment of enrollments) {
        const profile = enrollment.profiles;
        const emailPref = emailPrefsMap.get(enrollment.student_id);

        // Use notification email from preferences or fall back to profile email
        const studentEmail = emailPref?.notification_email || profile.notification_email || profile.email;
        console.log(`📧 Sending mandatory reminder to ${profile.full_name} at ${studentEmail}`);

        try {
          // Send email via EmailJS
          await emailjs.send(
            'service_3ux4e79', // EmailJS service ID
            'template_3smtuc7', // Your template ID
            {
              to_email: studentEmail,
              student_name: profile.full_name,
              lecture_title: lecture.title,
              course_title: `${lecture.course.course_code} - ${lecture.course.title}`,
              lecture_date: dateTime.date,
              lecture_time: dateTime.time,
              duration_minutes: lecture.duration_minutes,
              location: lecture.location || 'Online',
              meeting_url: lecture.meeting_url || '',
              description: lecture.description || ''
            },
            'iqrbya988WpE1wUcR' // Your public key
          );

          emailsSent.push(studentEmail);
          console.log(`✅ Email sent successfully to ${studentEmail}`);

          // Create notification record for successful send
          notifications.push({
            lecture_id: lecture.id,
            recipient_id: enrollment.student_id,
            email: studentEmail,
            subject: `Reminder: ${lecture.title}`,
            message: `Lecture reminder sent for ${lecture.course.course_code} - ${lecture.title} on ${dateTime.date} at ${dateTime.time}`,
            status: 'sent',
            sent_at: new Date().toISOString(),
            scheduled_for: new Date().toISOString()
          });

        } catch (emailError) {
          console.error(`❌ Failed to send email to ${studentEmail}:`, emailError);
          
          // Create notification record for failed send
          notifications.push({
            lecture_id: lecture.id,
            recipient_id: enrollment.student_id,
            email: studentEmail,
            subject: `Reminder: ${lecture.title}`,
            message: `Failed to send lecture reminder for ${lecture.course.course_code} - ${lecture.title}`,
            status: 'failed',
            error_message: emailError.message || 'Unknown error',
            scheduled_for: new Date().toISOString()
          });
        }
      }

      if (emailsSent.length === 0) {
        toast({
          title: "No emails sent",
          description: "No reminders were sent. Check student preferences or try again.",
          variant: "destructive",
        });
        return;
      }

      // Insert notification records into the database
      if (notifications.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (insertError) {
          console.error('Error saving notification records:', insertError);
        }
      }

      toast({
        title: "Reminders sent!",
        description: `Email reminders sent to ${emailsSent.length} student(s).`,
      });

    } catch (error: any) {
      console.error('Error sending lecture reminder:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send lecture reminders.",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(false);
    }
  };

  const dateTime = formatDateTime(lecture.scheduled_at);
  const isToday = isLectureToday(lecture.scheduled_at);
  const isPast = isLecturePast(lecture.scheduled_at);

  return (
    <Card className={`${isToday ? 'border-primary bg-primary/5' : ''} ${isPast ? 'opacity-75' : ''}`}>
      <div
        className="h-2 rounded-t-lg"
        style={{ backgroundColor: lecture.course.color }}
      />
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{lecture.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lecture.course.course_code} - {lecture.course.title}
            </p>
          </div>
          <div className="flex gap-2">
            {isToday && (
              <Badge variant="warning">Today</Badge>
            )}
            {isPast && (
              <Badge variant="secondary">Past</Badge>
            )}
            {lecture.is_cancelled && (
              <Badge variant="destructive">Cancelled</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {lecture.description && (
            <p className="text-sm text-muted-foreground">
              {lecture.description}
            </p>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              {dateTime.date} at {dateTime.time}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="mr-2 h-4 w-4" />
              {lecture.duration_minutes} minutes
            </div>
            {lecture.location && (
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                {lecture.location}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={sendLectureReminder}
              disabled={sendingReminder}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {sendingReminder ? 'Sending...' : 'Send Reminder'}
            </Button>
            
            {lecture.meeting_url && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(lecture.meeting_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Join Meeting
              </Button>
            )}
            
            <Button variant="ghost" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="sm">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LectureCard;