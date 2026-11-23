import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.errorMessage || 'An unexpected UI error occurred.'}
            </p>
            <Button
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Reload application
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
