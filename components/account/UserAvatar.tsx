'use client'

interface UserAvatarProps {
  avatarUrl: string | null | undefined
  email: string | null | undefined
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-24 h-24 text-3xl',
}

/**
 * User avatar component with fallback to initial
 */
export function UserAvatar({ avatarUrl, email, size = 'md', className = '' }: UserAvatarProps) {
  const sizeClass = sizeClasses[size]
  const initial = (email?.[0] || '?').toUpperCase()

  return (
    <div className={`rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden ${sizeClass} ${className}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  )
}

export default UserAvatar
