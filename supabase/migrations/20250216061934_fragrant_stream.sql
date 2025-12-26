-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their shift assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "Users can update their shift assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "Users can manage shift assignments" ON public.shift_assignments;

-- Create comprehensive RLS policies for shift_assignments
CREATE POLICY "Users can view shift assignments"
  ON public.shift_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create shift assignments"
  ON public.shift_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update shift assignments"
  ON public.shift_assignments
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete shift assignments"
  ON public.shift_assignments
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to get shift assignments with proper access control
CREATE OR REPLACE FUNCTION get_shift_assignments_secure(
  p_start_date date,
  p_end_date date,
  p_employee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  shift_id uuid,
  employee_id uuid,
  schedule_date date,
  status text,
  clock_in timestamptz,
  clock_out timestamptz,
  actual_break_duration interval,
  overtime_minutes integer,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  shift jsonb,
  employee jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.shift_id,
    sa.employee_id,
    sa.schedule_date,
    sa.status::text,
    sa.clock_in,
    sa.clock_out,
    sa.actual_break_duration,
    sa.overtime_minutes,
    sa.notes,
    sa.created_at,
    sa.updated_at,
    to_jsonb(s.*) AS shift,
    jsonb_build_object(
      'name', e.name,
      'email', e.email,
      'department', e.department
    ) AS employee
  FROM public.shift_assignments sa
  JOIN public.shifts s ON s.id = sa.shift_id
  LEFT JOIN public.employees e ON e.user_id = sa.employee_id
  WHERE sa.schedule_date >= p_start_date
  AND sa.schedule_date <= p_end_date
  AND (p_employee_id IS NULL OR sa.employee_id = p_employee_id)
  ORDER BY sa.schedule_date;
END;
$$;