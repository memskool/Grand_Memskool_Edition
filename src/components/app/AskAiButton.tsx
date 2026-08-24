import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AskAiButton({
  lessonId,
  assignmentId,
  missedWorkId,
  subjectId,
  intent = "EXPLAIN",
  label = "Ask AI",
}: {
  lessonId?: string;
  assignmentId?: string;
  missedWorkId?: string;
  subjectId?: string;
  intent?: string;
  label?: string;
}) {
  return (
    <Button asChild size="sm" variant="outline" className="rounded-full">
      <Link
        to="/ai-tutor"
        preload="intent"
        search={{
          intent,
          ...(lessonId ? { lesson: lessonId } : {}),
          ...(assignmentId ? { assignment: assignmentId } : {}),
          ...(missedWorkId ? { missed: missedWorkId } : {}),
          ...(subjectId ? { subject: subjectId } : {}),
        }}
      >
        <Bot className="size-4" /> {label}
      </Link>
    </Button>
  );
}
