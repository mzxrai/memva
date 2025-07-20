import { RiCloseLine } from 'react-icons/ri'
import clsx from 'clsx'

interface UploadedImage {
  id: string
  file: File
  preview: string
}

interface ImagePreviewProps {
  images: UploadedImage[]
  onRemove: (id: string) => void
}

export function ImagePreview({ images, onRemove }: ImagePreviewProps) {
  if (images.length === 0) {
    return null
  }

  return (
    <div 
      className="flex flex-wrap gap-2 mb-2"
      role="region"
      aria-label="Image previews"
    >
      {images.map((image) => (
        <div 
          key={image.id}
          className={clsx(
            "relative group",
            "w-16 h-16",
            "rounded-lg overflow-hidden",
            "border border-zinc-700",
            "bg-zinc-800/50"
          )}
        >
          <img
            src={image.preview}
            alt={image.file.name}
            className="w-full h-full object-cover"
          />
          
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className={clsx(
              "absolute top-0 right-0",
              "p-1",
              "bg-zinc-900/90 backdrop-blur-sm",
              "text-zinc-400 hover:text-zinc-100",
              "opacity-0 group-hover:opacity-100",
              "transition-all duration-150",
              "rounded-bl-lg"
            )}
            aria-label={`Remove ${image.file.name}`}
          >
            <RiCloseLine className="w-3 h-3" />
          </button>
          
          <div 
            className={clsx(
              "absolute bottom-0 left-0 right-0",
              "px-1 py-0.5",
              "bg-zinc-900/90 backdrop-blur-sm",
              "text-zinc-400 text-[10px] font-mono",
              "truncate",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-150"
            )}
          >
            {image.file.name}
          </div>
        </div>
      ))}
    </div>
  )
}