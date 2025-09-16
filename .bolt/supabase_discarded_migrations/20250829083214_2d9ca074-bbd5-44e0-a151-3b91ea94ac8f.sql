-- Add department and level fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN department TEXT,
ADD COLUMN level TEXT CHECK (level IN ('ND 1', 'ND 2', 'HND 1', 'HND 2'));

-- Add level and department fields to courses table for automatic assignment
ALTER TABLE public.courses 
ADD COLUMN department TEXT,
ADD COLUMN level TEXT CHECK (level IN ('ND 1', 'ND 2', 'HND 1', 'HND 2'));

-- Create function to automatically enroll students in courses based on their level and department
CREATE OR REPLACE FUNCTION public.auto_enroll_student_in_courses()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-enroll if the profile is for a student and has level/department
  IF NEW.role = 'student' AND NEW.level IS NOT NULL AND NEW.department IS NOT NULL THEN
    INSERT INTO public.enrollments (student_id, course_id)
    SELECT NEW.id, c.id
    FROM public.courses c
    WHERE c.department = NEW.department 
      AND c.level = NEW.level
      AND c.is_active = true
    ON CONFLICT DO NOTHING; -- Prevent duplicate enrollments
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-enrollment on profile updates
CREATE TRIGGER auto_enroll_trigger
  AFTER INSERT OR UPDATE OF level, department ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_enroll_student_in_courses();

-- Update the handle_new_user function to include department and level from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    department,
    level
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'student'::user_role
    ),
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'level'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;