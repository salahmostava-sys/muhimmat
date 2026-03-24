import { useState, useEffect } from 'react';

const useSignedUrl = (endpoint) => {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUrl = async () => {
            try {
                setLoading(true);
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error('Failed to fetch signed URL');
                const data = await response.json();
                setUrl(data.url);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUrl();

        // Cleanup function to prevent state updates if component unmounts
        return () => {
            setUrl(null);
            setLoading(false);
            setError(null);
        };
    }, [endpoint]);

    return { url, loading, error };
};

export default useSignedUrl;