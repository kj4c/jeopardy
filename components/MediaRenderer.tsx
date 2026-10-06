import type { Media } from "@/lib/types";

export function MediaRenderer({
  media,
  className = "",
  autoplay = false,
  maxHeight,
}: {
  media: Media;
  className?: string;
  autoplay?: boolean;
  /** CSS length, e.g. "40vh". Images and videos shrink to fit within it. */
  maxHeight?: string;
}) {
  if (media.type === "image") {
    return (
      <img
        src={media.src}
        alt=""
        className={`max-w-full object-contain ${maxHeight ? "" : "max-h-full"} ${className}`}
        style={maxHeight ? { maxHeight } : undefined}
        draggable={false}
      />
    );
  }
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (media.start) params.set("start", String(media.start));
  if (autoplay) params.set("autoplay", "1");
  return (
    <div
      className={`aspect-video w-full overflow-hidden border border-line bg-black ${className}`}
      style={maxHeight ? { maxWidth: `calc(${maxHeight} * 16 / 9)` } : undefined}
    >
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${media.videoId}?${params}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
