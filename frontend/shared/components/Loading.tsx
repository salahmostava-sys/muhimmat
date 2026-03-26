import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@shared/components/ui/button';

type LoadingProps = Readonly<{
  className?: string;
  minHeightClassName?: string;
  resetKey?: string;
}>;

export default function Loading(props: LoadingProps) {
  const { className = '', minHeightClassName = 'min-h-[300px]', resetKey = 'default' } = props;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Reset timeout state whenever navigation changes the reset key.
    setTimedOut(false);
    const id = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(id);
  }, [resetKey]);

  if (timedOut) {
    return (
      <div className={`${minHeightClassName} flex flex-col items-center justify-center gap-3 ${className}`}>
        <p className="text-sm text-muted-foreground">Request Timeout - Please Refresh</p>
        <Button variant="outline" size="sm" onClick={() => globalThis.location.reload()} className="gap-2">
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

