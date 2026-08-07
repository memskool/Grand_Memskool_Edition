-- Automation/trigger-only functions: no direct API access at all
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_classroom_attendance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_missed_work_release() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_absence_to_missed_work() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_resource_to_absentees() FROM PUBLIC, anon, authenticated;

-- Access-check helpers used inside RLS policies: signed-in users only, never anonymous
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_enrolled(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teaches_class(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.session_class_id(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teaches_class(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.session_class_id(uuid) TO authenticated, service_role;