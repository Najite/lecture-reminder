import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmailPreferences from '@/components/EmailPreferences';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, 
  Calendar, 
  Clock,
  CheckCircle,
  Search,
  Eye,
  UserPlus,
  Settings,
  MapPin,
  ExternalLink
} from 'lucide-react';

interface StudentStats {
  enrolledCourses: number;
  upcomingLectures: number;
  completedLectures: number;
  totalHours: number;
}

interface Enrollment {
  id: string;
  course: {
    id: string;
    title: string;
    course_code: string;
    description: string;
    color: string;
    lecturer: {
      full_name: string;
    };
  };
  enrolled_at: string;
  is_active: boolean;
}

interface Lecture {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  meeting_url: string;
  course: {
    title: string;
    course_code: string;
    color: string;
  };
  is_cancelled: boolean;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<StudentStats>({ 
    enrolledCourses: 0, 
    upcomingLectures: 0, 
    completedLectures: 0, 
    totalHours: 0 
  });
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [upcomingLectures, setUpcomingLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch student's enrollments
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          *,
          course:course_id (
            *,
            lecturer:lecturer_id (full_name)
          )
        `)
        .eq('student_id', user?.id)
        .eq('is_active', true);

      setEnrollments(enrollmentsData || []);

      const courseIds = (enrollmentsData || []).map(e => e.course.id);

      // Fetch upcoming lectures for enrolled courses
      const { data: lecturesData } = await supabase
        .from('lectures')
        .select(`
          *,
          course:course_id (title, course_code, color)
        `)
        .in('course_id', courseIds)
        .gte('scheduled_at', new Date().toISOString())
        .eq('is_cancelled', false)
        .order('scheduled_at', { ascending: true })
        .limit(5);

      setUpcomingLectures(lecturesData || []);

      // Calculate stats
      const { count: upcomingCount } = await supabase
        .from('lectures')
        .select('id', { count: 'exact' })
        .in('course_id', courseIds)
        .gte('scheduled_at', new Date().toISOString())
        .eq('is_cancelled', false);

      const { count: completedCount } = await supabase
        .from('lectures')
        .select('id', { count: 'exact' })
        .in('course_id', courseIds)
        .lt('scheduled_at', new Date().toISOString())
        .eq('is_cancelled', false);

      // Calculate total hours from completed lectures
      const { data: completedLectures } = await supabase
        .from('lectures')
        .select('duration_minutes')
        .in('course_id', courseIds)
        .lt('scheduled_at', new Date().toISOString())
        .eq('is_cancelled', false);

      const totalMinutes = (completedLectures || []).reduce((sum, lecture) => {
        return sum + (lecture.duration_minutes || 0);
      }, 0);

      setStats({
        enrolledCourses: enrollmentsData?.length || 0,
        upcomingLectures: upcomingCount || 0,
        completedLectures: completedCount || 0,
        totalHours: Math.round(totalMinutes / 60),
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

  const isLectureToday = (dateString: string) => {
    const lectureDate = new Date(dateString);
    const today = new Date();
    return lectureDate.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <DashboardLayout title="Student Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Student Dashboard" 
      subtitle="Track your courses and upcoming lectures"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enrolledCourses}</div>
            <p className="text-xs text-muted-foreground">
              Active enrollments
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingLectures}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled lectures
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedLectures}</div>
            <p className="text-xs text-muted-foreground">
              Lectures attended
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours}</div>
            <p className="text-xs text-muted-foreground">
              Total hours
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="courses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="lectures">Upcoming Lectures</TabsTrigger>
          <TabsTrigger value="preferences">Email Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Courses</CardTitle>
                  <CardDescription>Courses you're enrolled in</CardDescription>
                </div>
                <Button variant="gradient" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Browse
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: enrollment.course.color }}
                      />
                      <div>
                        <p className="font-medium">{enrollment.course.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {enrollment.course.course_code} • {enrollment.course.lecturer.full_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="info">
                        Enrolled
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {enrollments.length === 0 && (
                  <div className="text-center py-8">
                    <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No courses enrolled yet</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Browse Courses
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lectures">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Upcoming Lectures</CardTitle>
                  <CardDescription>Your scheduled classes with detailed information</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingLectures.map((lecture) => {
                  const dateTime = formatDateTime(lecture.scheduled_at);
                  const isToday = isLectureToday(lecture.scheduled_at);
                  return (
                    <div key={lecture.id} className={`p-4 rounded-lg border ${isToday ? 'border-primary bg-primary/5' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div 
                            className="w-4 h-4 rounded-full mt-1"
                            style={{ backgroundColor: lecture.course.color }}
                          />
                          <div className="space-y-1">
                            <p className="font-medium">{lecture.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {lecture.course.course_code} - {lecture.course.title}
                            </p>
                            <div className="space-y-1">
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
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isToday && (
                            <Badge variant="warning">
                              Today
                            </Badge>
                          )}
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
                        </div>
                      </div>
                    </div>
                  );
                })}
                {upcomingLectures.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No upcoming lectures</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <EmailPreferences />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default StudentDashboard;