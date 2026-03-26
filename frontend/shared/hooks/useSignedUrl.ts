import { useEffect, useState } from 'react';
import { supabase } from '@services/supabase/client';

export const extractStoragePath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (!value.startsWith('http')) return value;
  const marker = '/storage/v1/object/public/';
  const index = value.indexOf(marker);
  if (index === -1) return null;
  const rest = value.slice(index + marker.length);
  const firstSlash = rest.indexOf('/');
  if (firstSlash === -1) return null;
  return rest.slice(firstSlash + 1);
};

export const useSignedUrl = (bucket: string, path: string | null | undefined) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [hookError, setHookError] = useState<Error | null>(null);

  if (hookError) {
    throw hookError;
  }

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (!path) {
        setSignedUrl(null);
        setHookError(null);
        return;
      }
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
      if (!isMounted) return;
      if (error) {
        console.error(error);
        setSignedUrl(null);
        setHookError(error);
        return;
      }
      setHookError(null);
      setSignedUrl(data.signedUrl);
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [bucket, path]);

  return signedUrl;
};

export default useSignedUrl;