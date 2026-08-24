import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = { children: ReactNode };
type State = { error: Error | null };

function isStaleBundleError(error: Error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed/i.test(
    error.message,
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Memskool] page crash", error, info.componentStack);
    reportLovableError(error, { boundary: "app_shell", componentStack: info.componentStack });
  }

  private retry = () => {
    const error = this.state.error;
    if (error && isStaleBundleError(error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  override render() {
    if (!this.state.error) return this.props.children;

    const stale = isStaleBundleError(this.state.error);
    const devDetail = import.meta.env.DEV ? this.state.error.message : null;

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {stale
            ? "The app updated while this tab was open. Refresh to load the latest Virtual Classroom."
            : "Something went wrong on our end. You can try again without leaving Memskool."}
        </p>
        {devDetail ? (
          <p className="mt-3 max-w-lg font-mono text-xs text-muted-foreground">{devDetail}</p>
        ) : null}
        <Button className="mt-6 rounded-full" onClick={this.retry}>
          {stale ? "Refresh" : "Try again"}
        </Button>
      </div>
    );
  }
}
