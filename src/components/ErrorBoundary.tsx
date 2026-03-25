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
