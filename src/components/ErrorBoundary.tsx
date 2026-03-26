import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

const hardReloadWithCacheClear = async () => {
  try {
    // Clear browser cache storage when available to avoid stale bundles.
    if ('caches' in globalThis) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch (e) {
    console.warn('[ErrorBoundary] Failed to clear cache storage', e);
  }

  try {
    globalThis.localStorage?.clear();
    globalThis.sessionStorage?.clear();
  } catch (e) {
    console.warn('[ErrorBoundary] Failed to clear web storage', e);
  }

  const url = new URL(globalThis.location.href);
  url.searchParams.set('_rb', String(Date.now()));
  globalThis.location.replace(url.toString());
};

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
            onClick={() => { this.setState({ hasError: false, error: null }); void hardReloadWithCacheClear(); }}
          >
            <RefreshCw size={14} /> مسح الكاش وإعادة التحميل
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
