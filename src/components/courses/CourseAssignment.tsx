import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Course {
  id: string;
  title: string;
  course_code: string;
  department: string;
  level: string;
}

interface Lecturer {
  id: string;
  full_name: string;
  email: string;
  department: string;
}

interface CourseAssignmentProps {
  onSuccess?: () => void;
}

const CourseAssignment: React.FC<CourseAssignmentProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLecturer, setSelectedLecturer] = useState('');

  useEffect(() => {
    fetchCourses();
    fetchLecturers();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, course_code, department, level')
        .order('title');

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

  const fetchLecturers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .eq('role', 'lecturer')
        .order('full_name');

      if (error) throw error;
      setLecturers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourse || !selectedLecturer) {
      toast({
        title: "Error",
        description: "Please select both a course and a lecturer",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('courses')
        .update({ lecturer_id: selectedLecturer })
        .eq('id', selectedCourse);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lecturer assigned to course successfully",
      });

      setSelectedCourse('');
      setSelectedLecturer('');
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

  const selectedCourseData = courses.find(c => c.id === selectedCourse);
  const filteredLecturers = selectedCourseData
    ? lecturers.filter(l => l.department === selectedCourseData.department)
    : lecturers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign Lecturer to Course</CardTitle>
        <CardDescription>Select an existing course and assign a lecturer</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAssign} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course">Select Course</Label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.course_code} - {course.title} ({course.department}, {course.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lecturer">Select Lecturer</Label>
            <Select
              value={selectedLecturer}
              onValueChange={setSelectedLecturer}
              disabled={!selectedCourse}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedCourse ? "Choose a lecturer" : "Select a course first"} />
              </SelectTrigger>
              <SelectContent>
                {filteredLecturers.map((lecturer) => (
                  <SelectItem key={lecturer.id} value={lecturer.id}>
                    {lecturer.full_name} ({lecturer.department})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCourseData && filteredLecturers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No lecturers found in {selectedCourseData.department} department
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading || !selectedCourse || !selectedLecturer} className="w-full">
            {loading ? 'Assigning...' : 'Assign Lecturer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CourseAssignment;
