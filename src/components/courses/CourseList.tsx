import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Users, BookOpen } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  course_code: string;
  description: string;
  department: string;
  level: string;
  color: string;
  is_active: boolean;
  lecturer_id: string;
  lecturer_name?: string;
  enrollment_count?: number;
}

interface CourseListProps {
  refreshTrigger?: number;
}

const CourseList: React.FC<CourseListProps> = ({ refreshTrigger }) => {
  const { profile, isAdmin, isLecturer } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = async () => {
    try {
      let query = supabase
        .from('courses')
        .select(`
          id,
          title,
          course_code,
          description,
          department,
          level,
          color,
          is_active,
          lecturer_id,
          profiles!courses_lecturer_id_fkey(full_name)
        `);

      if (isLecturer && !isAdmin) {
        query = query.eq('lecturer_id', profile?.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Get enrollment counts
      const coursesWithCounts = await Promise.all(
        (data || []).map(async (course) => {
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id)
            .eq('is_active', true);

          return {
            ...course,
            lecturer_name: course.profiles?.full_name,
            enrollment_count: count || 0
          };
        })
      );

      setCourses(coursesWithCounts);
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

  const toggleCourseStatus = async (courseId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_active: !currentStatus })
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Course ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      fetchCourses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [profile, refreshTrigger]);

  if (loading) {
    return <div className="flex justify-center p-8">Loading courses...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Courses</h3>
      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No courses found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Card key={course.id} className="relative">
              <div
                className="h-2 rounded-t-lg"
                style={{ backgroundColor: course.color }}
              />
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{course.course_code}</p>
                  </div>
                  <Badge variant={course.is_active ? "success" : "secondary"}>
                    {course.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {course.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{course.department}</Badge>
                    <Badge variant="outline">{course.level}</Badge>
                  </div>

                  {course.lecturer_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4" />
                      <span>{course.lecturer_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    <span>{course.enrollment_count} students enrolled</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant={course.is_active ? "warning" : "success"}
                      size="sm"
                      onClick={() => toggleCourseStatus(course.id, course.is_active)}
                    >
                      {course.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    {(isAdmin || course.lecturer_id === profile?.id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCourseStatus(course.id, true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseList;