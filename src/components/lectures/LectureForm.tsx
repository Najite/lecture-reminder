import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Course {
  id: string;
  title: string;
  course_code: string;
}

interface LectureFormProps {
  onSuccess?: () => void;
}

const LECTURE_TYPES = [
  'Introduction',
  'Theory Session',
  'Practical Session',
  'Lab Session',
  'Tutorial',
  'Workshop',
  'Review Session',
  'Exam Preparation',
  'Guest Lecture',
  'Project Discussion',
  'Case Study',
  'Group Discussion',
  'Presentation',
  'Assessment',
  'Revision Class'
];

const LectureForm: React.FC<LectureFormProps> = ({ onSuccess }) => {
  const { profile, isAdmin, isLecturer } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [useCustomTitle, setUseCustomTitle] = useState(false);

  const getDefaultDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    course_id: '',
    title: '',
    description: '',
    scheduled_at: getDefaultDateTime(),
    duration_minutes: 60,
    location: '',
    meeting_url: ''
  });

  useEffect(() => {
    fetchCourses();
  }, [profile]);

  const fetchCourses = async () => {
    try {
      let query = supabase
        .from('courses')
        .select('id, title, course_code')
        .eq('is_active', true);

      if (isLecturer && !isAdmin) {
        query = query.eq('lecturer_id', profile?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCourseChange = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    setSelectedCourse(course || null);
    setFormData({ ...formData, course_id: courseId, title: '' });
    setUseCustomTitle(false);
    setCustomTitle('');
  };

  const handleLectureTypeChange = (type: string) => {
    if (type === 'custom') {
      setUseCustomTitle(true);
      setFormData({ ...formData, title: customTitle });
    } else {
      setUseCustomTitle(false);
      const title = selectedCourse
        ? `${selectedCourse.course_code} - ${type}`
        : type;
      setFormData({ ...formData, title });
    }
  };

  const handleCustomTitleChange = (value: string) => {
    setCustomTitle(value);
    if (useCustomTitle) {
      setFormData({ ...formData, title: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('lectures').insert([{
        ...formData,
        scheduled_at: new Date(formData.scheduled_at).toISOString()
      }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lecture scheduled successfully",
      });

      setFormData({
        course_id: '',
        title: '',
        description: '',
        scheduled_at: getDefaultDateTime(),
        duration_minutes: 60,
        location: '',
        meeting_url: ''
      });
      setSelectedCourse(null);
      setCustomTitle('');
      setUseCustomTitle(false);

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule New Lecture</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course_id">Course</Label>
            <Select value={formData.course_id} onValueChange={handleCourseChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.course_code} - {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lecture_type">Lecture Type</Label>
            <Select
              onValueChange={handleLectureTypeChange}
              disabled={!formData.course_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.course_id ? "Select lecture type" : "Select a course first"} />
              </SelectTrigger>
              <SelectContent>
                {LECTURE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Title</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {useCustomTitle && (
            <div className="space-y-2">
              <Label htmlFor="custom_title">Custom Lecture Title</Label>
              <Input
                id="custom_title"
                value={customTitle}
                onChange={(e) => handleCustomTitleChange(e.target.value)}
                placeholder="Enter custom title"
                required
              />
            </div>
          )}

          {!useCustomTitle && formData.title && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Lecture Title:</p>
              <p className="text-sm text-muted-foreground">{formData.title}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Date & Time</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input
                id="duration_minutes"
                type="number"
                min="15"
                max="480"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Room/Building"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting_url">Meeting URL</Label>
              <Input
                id="meeting_url"
                type="url"
                value={formData.meeting_url}
                onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                placeholder="https://zoom.us/..."
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Scheduling...' : 'Schedule Lecture'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default LectureForm;