import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import CourseForm from '@/components/courses/CourseForm';
import CourseList from '@/components/courses/CourseList';
import LectureForm from '@/components/lectures/LectureForm';
import LectureList from '@/components/lectures/LectureList';
import { 
  BookOpen, 
  Calendar, 
  Users, 
  Clock,
  Plus,
  Eye,
  Edit,
  CalendarPlus
} from 'lucide-react';

interface LecturerStats {
  totalCourses: number;
  totalLectures: number;
  totalStudents: number;
  upcomingLectures: number;
}

interface Course {
  id: string;
  title: string;
  course_code: string;
  description: string;
  color: string;
  is_active: boolean;
  _count?: {
    enrollments: number;
  };
}

interface Lecture {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  course: {
    title: string;
    course_code: string;
    color: string;
  };
  is_cancelled: boolean;
}

const LecturerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<LecturerStats>({ 
    totalCourses: 0, 
    totalLectures: 0, 
    totalStudents: 0, 
    upcomingLectures: 0 
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [upcomingLectures, setUpcomingLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch lecturer's courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select(`
          *,
          enrollments(count)
        `)
        .eq('lecturer_id', user?.id)
        .eq('is_active', true);

      setCourses(coursesData || []);

      // Fetch lecturer's lectures
      const { data: lecturesData } = await supabase
        .from('lectures')
        .select(`
          *,
          course:course_id (title, course_code, color)
        `)
        .in('course_id', (coursesData || []).map(c => c.id))
        .gte('scheduled_at', new Date().toISOString())
        .eq('is_cancelled', false)
        .order('scheduled_at', { ascending: true })
        .limit(5);

      setUpcomingLectures(lecturesData || []);

      // Calculate stats
      const totalCourses = coursesData?.length || 0;
      
      const { count: totalLectures } = await supabase
        .from('lectures')
        .select('id', { count: 'exact' })
        .in('course_id', (coursesData || []).map(c => c.id));

      const { count: upcomingCount } = await supabase
        .from('lectures')
        .select('id', { count: 'exact' })
        .in('course_id', (coursesData || []).map(c => c.id))
        .gte('scheduled_at', new Date().toISOString())
        .eq('is_cancelled', false);

      const totalStudents = (coursesData || []).reduce((sum, course) => {
        return sum + (course.enrollments?.length || 0);
      }, 0);

      setStats({
        totalCourses,
        totalLectures: totalLectures || 0,
        totalStudents,
        upcomingLectures: upcomingCount || 0,
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <DashboardLayout title="Lecturer Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Lecturer Dashboard" 
      subtitle="Manage your courses and lectures"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCourses}</div>
            <p className="text-xs text-muted-foreground">
              Active courses
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lectures</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLectures}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Enrolled students
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingLectures}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled lectures
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="lectures">Lectures</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* My Courses */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Courses</CardTitle>
                    <CardDescription>Courses you're teaching</CardDescription>
                  </div>
                  {/* <Button variant="gradient" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Course
                  </Button> */}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {courses.map((course) => (
                    <div key={course.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: course.color }}
                        />
                        <div>
                          <p className="font-medium">{course.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {course.course_code} • {course._count?.enrollments || 0} students
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={course.is_active ? "success" : "secondary"}>
                          {course.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Lectures */}
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Lectures</CardTitle>
                    <CardDescription>Your scheduled lectures</CardDescription>
                  </div>
                  <Button variant="gradient" size="sm">
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingLectures.map((lecture) => {
                    const dateTime = formatDateTime(lecture.scheduled_at);
                    return (
                      <div key={lecture.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: lecture.course.color }}
                          />
                          <div>
                            <p className="font-medium">{lecture.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {lecture.course.course_code} • {dateTime.date} at {dateTime.time}
                            </p>
                            {lecture.location && (
                              <p className="text-xs text-muted-foreground">📍 {lecture.location}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="info">
                            {lecture.duration_minutes}m
                          </Badge>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          <CourseForm onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
          <CourseList refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="lectures" className="space-y-6">
          <LectureForm onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
          <LectureList refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default LecturerDashboard;