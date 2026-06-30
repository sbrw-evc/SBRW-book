import { Star } from 'lucide-react'

export function StarRating({ value = 0, max = 5, size = 16, interactive = false, onChange }) {
  const stars = Array.from({ length: max }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => (
        <Star
          key={star}
          size={size}
          className={`transition-colors ${
            star <= Math.round(value) ? 'star-filled fill-current' : 'star-empty'
          } ${interactive ? 'cursor-pointer hover:star-filled hover:fill-current' : ''}`}
          onClick={() => interactive && onChange?.(star)}
        />
      ))}
    </div>
  )
}
