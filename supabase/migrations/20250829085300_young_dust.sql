/*
  # Auto-enroll students in courses for their level

  1. New Functions
    - `auto_enroll_student_in_courses()` - Automatically enrolls students in courses matching their department and level
    - `auto_enroll_students_in_new_course()` - Enrolls all eligible students when a new course is created

  2. Triggers
    - Auto-enroll trigger on profiles table for INSERT and UPDATE of level/department
    - Auto-enroll trigger on courses table for INSERT

  3. Security
    - Functions execute with security definer privileges
    - Maintains existing RLS policies on enrollments table
*/

-- Function to auto-enroll a student in courses matching their department and level
CREATE OR REPLACE FUNCTION auto_enroll_student_in_courses()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the user is a student and has both department and level set
  IF NEW.role = 'student' AND NEW.department IS NOT NULL AND NEW.level IS NOT NULL THEN
    -- Insert enrollments for all active courses matching the student's department and level
    INSERT INTO enrollments (student_id, course_id)
    SELECT NEW.id, c.id
    FROM courses c
    WHERE c.department = NEW.department 
      AND c.level = NEW.level 
      AND c.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.student_id = NEW.id AND e.course_id = c.id
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-enroll students when a new course is created
CREATE OR REPLACE FUNCTION auto_enroll_students_in_new_course()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the course is active and has both department and level set
  IF NEW.is_active = true AND NEW.department IS NOT NULL AND NEW.level IS NOT NULL THEN
    -- Insert enrollments for all students matching the course's department and level
    INSERT INTO enrollments (student_id, course_id)
    SELECT p.id, NEW.id
    FROM profiles p
    WHERE p.role = 'student'
      AND p.department = NEW.department 
      AND p.level = NEW.level
      AND NOT EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.student_id = p.id AND e.course_id = NEW.id
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-enrolling students when their profile is updated
DROP TRIGGER IF EXISTS auto_enroll_trigger ON profiles;
CREATE TRIGGER auto_enroll_trigger
  AFTER INSERT OR UPDATE OF level, department ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_student_in_courses();

-- Create trigger for auto-enrolling students when a new course is created
CREATE TRIGGER auto_enroll_course_trigger
  AFTER INSERT ON courses
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_students_in_new_course();