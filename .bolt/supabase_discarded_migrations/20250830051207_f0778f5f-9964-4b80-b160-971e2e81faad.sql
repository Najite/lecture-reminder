-- Enable RLS on all tables that need it
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Fix function search paths
CREATE OR REPLACE FUNCTION public.auto_enroll_student_in_courses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.auto_enroll_students_in_new_course()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;