import { useState, type ReactNode } from 'react';

export default function GraphDownload({ url, filename, className, children }: {
  url: string;
  filename: string;
  className?: string;
  children: ReactNode;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download could not be completed (${response.status}). Please retry.`);
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Download could not be completed. Please retry.');
    } finally {
      setDownloading(false);
    }
  };

  return <span><button type="button" disabled={downloading} onClick={() => void download()} className={className}>{downloading ? 'Downloading…' : children}</button>{error && <span role="alert" className="mt-2 block text-sm text-red-700">{error}</span>}</span>;
}
