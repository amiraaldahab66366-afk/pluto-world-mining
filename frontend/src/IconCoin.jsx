import React from 'react'

export default function IconCoin({ size = 28, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="g1" x1="0" x2="1">
          <stop offset="0" stopColor="#FFD24C" />
          <stop offset="1" stopColor="#FFB84D" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#g1)" stroke="#F2A900" strokeWidth="0.5" />
      <circle cx="12" cy="12" r="6.2" fill="rgba(255,255,255,0.06)" />
      <path d="M9.5 11.2c0-.8.6-1.2 2.5-1.6 1.2-.3 1.5-.5 1.5-1 0-.6-.6-1-1.6-1-.9 0-1.3.2-1.7.4" stroke="#8a5a00" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6 7.4v9" stroke="#8a5a00" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
