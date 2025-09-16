import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LectureCard from './LectureCard';
import { Calendar, BookOpen } from 'lucide-react';

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

interface Course {
  id: string;
  title: string;
  course_code: string;
}

interface LectureListProps {
  refreshTrigger?: number;
}

const LectureList: React.FC<LectureListProps> = ({ refreshTrigger }) => {
  const { profile, isAdmin, isLecturer } = useAuth();
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchCourses = async () => {
    try {
      let query = supabase
        .from('courses')
        .select('id, title, course_code')
        .eq('is_active', true);

      if (isLecturer && !isAdmin) {
        query = query.eq('lecturer_id', profile?.id);
      }

      const { data, error } = await query.order('title');

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

  const fetchLectures = async () => {
    try {
      let query = supabase
        .from('lectures')
        .select(`
          *,
          course:course_id (
            id,
            title,
            course_code,
            color
          )
        `);

      if (isLecturer && !isAdmin) {
        // Get lecturer's course IDs first
        const { data: lecturerCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('lecturer_id', profile?.id);
        
        const courseIds = lecturerCourses?.map(c => c.id) || [];
        query = query.in('course_id', courseIds);
      }

      if (selectedCourse !== 'all') {
        query = query.eq('course_id', selectedCourse);
      }

      const { data, error } = await query.order('scheduled_at', { ascending: true });

      if (error) throw error;
      setLectures(data || []);
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

  useEffect(() => {
    fetchCourses();
  }, [profile]);

  useEffect(() => {
    fetchLectures();
  }, [profile, selectedCourse, refreshTrigger]);

  const upcomingLectures = lectures.filter(lecture => 
    new Date(lecture.scheduled_at) >= new Date() && !lecture.is_cancelled
  );

  const pastLectures = lectures.filter(lecture => 
    new Date(lecture.scheduled_at) < new Date() || lecture.is_cancelled
  );

  if (loading) {
    return <div className="flex justify-center p-8">Loading lectures...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Lectures</h3>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.course_code} - {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upcoming Lectures */}
      {upcomingLectures.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-muted-foreground">Upcoming Lectures</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcomingLectures.map((lecture) => (
              <LectureCard 
                key={lecture.id} 
                lecture={lecture} 
                onUpdate={fetchLectures}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Lectures */}
      {pastLectures.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-muted-foreground">Past Lectures</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pastLectures.map((lecture) => (
              <LectureCard 
                key={lecture.id} 
                lecture={lecture} 
                onUpdate={fetchLectures}
              />
            ))}
          </div>
        </div>
      )}

      {lectures.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No lectures found</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LectureList;