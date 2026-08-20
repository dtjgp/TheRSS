import { Star } from 'lucide-react'

export function SaveStar({ isSaved }: { readonly isSaved: boolean }) {
  return (
    <Star
      aria-hidden="true"
      className="save-button__icon"
      data-save-star
      fill={isSaved ? 'currentColor' : 'none'}
      focusable="false"
      strokeWidth={1.75}
    />
  )
}
