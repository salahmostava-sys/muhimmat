import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Loading(props: { className?: string; minHeightClassName?: string }) {
  const { className = '', minHeightClassName = 'min-h-[300px]' } = props;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(id);
  }, []);

  if (timedOut) {
    return (
      <div className={`${minHeightClassName} flex flex-col items-center justify-center gap-3 ${className}`}>
        <p className="text-sm text-muted-foreground">Request Timeout - Please Refresh</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className={`${minHeightClassName} flex items-center justify-center ${className}`}>
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );
}

