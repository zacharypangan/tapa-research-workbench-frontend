import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { useWorkbenchAuth } from '../../auth-context';

interface ProtectedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
}

export function ProtectedImage({ src, alt, ...props }: ProtectedImageProps) {
  const { apiFetch } = useWorkbenchAuth();
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    let active = true;
    let createdUrl = '';
    apiFetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`Image request returned ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) setObjectUrl('');
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [apiFetch, src]);

  if (!objectUrl) {
    return <div className={`${props.className || ''} grid place-items-center bg-slate-100 text-[10px] font-bold uppercase text-slate-400`}>Loading image</div>;
  }
  return <img src={objectUrl} alt={alt} {...props} />;
}

interface ProtectedDownloadProps {
  url: string;
  filename: string;
  className?: string;
  children: ReactNode;
}

export function ProtectedDownload({ url, filename, className, children }: ProtectedDownloadProps) {
  const { apiFetch } = useWorkbenchAuth();
  const [isDownloading, setIsDownloading] = useState(false);

  const download = async () => {
    setIsDownloading(true);
    try {
      const response = await apiFetch(url);
      if (!response.ok) throw new Error(`Download returned ${response.status}`);
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setIsDownloading(false);
    }
  };

  return <button type="button" disabled={isDownloading} onClick={() => void download()} className={className}>{children}</button>;
}
