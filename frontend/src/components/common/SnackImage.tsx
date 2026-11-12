import { useEffect, useState } from "react";

import { resolveImageUrl } from "../../api/client";

interface SnackImageProps {
  imageUrl?: string | null;
  alt: string;
  className?: string;
  variant?: "card" | "detail" | "thumb" | "sotw";
}

export function SnackImage({
  imageUrl,
  alt,
  className = "",
  variant = "card",
}: SnackImageProps) {
  const [src, setSrc] = useState(() => resolveImageUrl(imageUrl));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setSrc(resolveImageUrl(imageUrl));
    setHasError(false);
  }, [imageUrl]);

  return (
    <div className={`snack-img-frame snack-img-${variant} ${className}`.trim()}>
      <img
        src={hasError ? "/placeholder-snack.svg" : src}
        alt={alt}
        loading="lazy"
        className="snack-img-el"
        onError={() => {
          if (!hasError) {
            setHasError(true);
            setSrc("/placeholder-snack.svg");
          }
        }}
      />
    </div>
  );
}

