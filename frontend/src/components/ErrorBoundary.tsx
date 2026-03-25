import { Component, type ReactNode } from 'react';

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
    // Keep this in UI only; production users can screenshot the message.
    // eslint-disable-next-line no-console
    console.error('App crashed:', error);
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

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle size={24} className="text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">حدث خطأ غير متوقع</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {this.state.error?.message || 'يرجى تحديث الصفحة أو الاتصال بالدعم'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => { this.setState({ hasError: false, error: null }); globalThis.location.reload(); }}
          >
            <RefreshCw size={14} /> تحديث الصفحة
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
