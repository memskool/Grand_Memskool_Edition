REVOKE EXECUTE ON FUNCTION public.route_absence_to_missed_work() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.route_resource_to_absentees() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_missed_work_release() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;