'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import type { MovieVideo } from '@/lib/api/types';

/** Shows a thumbnail first and loads the YouTube player only after a click. */
export function Trailer({ video }: { video: MovieVideo }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
      {playing ? (
        <iframe
          src={`${video.embedUrl}${video.embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
          title={video.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group size-full"
          aria-label={`Play ${video.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail */}
          <img
            src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
            alt=""
            className="size-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-xl transition-transform group-hover:scale-110">
              <Play className="ml-1 size-7 fill-white" aria-hidden />
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-left text-sm font-medium text-white">
            {video.name}
          </span>
        </button>
      )}
    </div>
  );
}
