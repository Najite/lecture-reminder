import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Mail, Bell, Save } from 'lucide-react';

interface EmailPreferences {
  id?: string;
  notification_email: string;
  lecture_reminders: boolean;
  daily_digest: boolean;
}

const EmailPreferences: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<EmailPreferences>({
    notification_email: '',
    lecture_reminders: true,
    daily_digest: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && profile) {
      fetchEmailPreferences();
    }
  }, [user, profile]);

  const fetchEmailPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching email preferences:', error);
        return;
      }

      if (data) {
        setPreferences({
          id: data.id,
          notification_email: data.notification_email,
          lecture_reminders: data.lecture_reminders,
          daily_digest: data.daily_digest
        });
      } else {
        // Set default email from profile
        setPreferences(prev => ({
          ...prev,
          notification_email: profile?.notification_email || profile?.email || ''
        }));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const preferenceData = {
        user_id: user.id,
        notification_email: preferences.notification_email,
        lecture_reminders: preferences.lecture_reminders,
        daily_digest: preferences.daily_digest
      };

      if (preferences.id) {
        // Update existing preferences
        const { error } = await supabase
          .from('email_preferences')
          .update(preferenceData)
          .eq('id', preferences.id);

        if (error) throw error;
      } else {
        // Insert new preferences
        const { data, error } = await supabase
          .from('email_preferences')
          .insert(preferenceData)
          .select()
          .single();

        if (error) throw error;
        setPreferences(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Preferences saved",
        description: "Your email preferences have been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Preferences
        </CardTitle>
        <CardDescription>
          Manage your notification email and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="notification-email">Notification Email</Label>
          <Input
            id="notification-email"
            type="email"
            value={preferences.notification_email}
            onChange={(e) => setPreferences(prev => ({
              ...prev,
              notification_email: e.target.value
            }))}
            placeholder="Enter your preferred email for notifications"
          />
          <p className="text-sm text-muted-foreground">
            This email will be used for all notifications. Leave empty to use your account email.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Lecture Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Receive reminders for upcoming lectures
              </p>
            </div>
            <Switch
              checked={preferences.lecture_reminders}
              onCheckedChange={(checked) => setPreferences(prev => ({
                ...prev,
                lecture_reminders: checked
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Daily Digest</Label>
              <p className="text-sm text-muted-foreground">
                Receive a daily summary of your schedule
              </p>
            </div>
            <Switch
              checked={preferences.daily_digest}
              onCheckedChange={(checked) => setPreferences(prev => ({
                ...prev,
                daily_digest: checked
              }))}
            />
          </div>
        </div>

        <Button 
          onClick={savePreferences} 
          disabled={saving}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmailPreferences;