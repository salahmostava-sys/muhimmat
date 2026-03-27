import { Component, type ReactNode } from 'react';
import { logError } from '@shared/lib/logger';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    logError('App crashed', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || String(this.state.error);
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-card border border-border rounded-2xl shadow-card p-6 space-y-3">
          <h1 className="text-lg font-bold">حدث خطأ أثناء تشغيل الصفحة</h1>
          <p className="text-sm text-muted-foreground">
            لو الشاشة كانت بيضاء، صوّر هذه الرسالة وأرسلها لنا.
          </p>
          <pre className="text-xs overflow-auto max-h-[50vh] rounded-xl bg-muted/40 p-4 whitespace-pre-wrap break-words">
            {message}
          </pre>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm"
              onClick={() => globalThis.location.reload()}
              type="button"
            >
              إعادة تحميل
            </button>
            <button
              className="px-4 py-2 rounded-xl border border-border text-sm"
              onClick={() => this.setState({ error: null })}
              type="button"
            >
              تجاهل
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
