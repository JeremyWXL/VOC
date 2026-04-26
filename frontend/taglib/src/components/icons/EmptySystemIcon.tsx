import type { FC } from 'react';

const EmptySystemIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    width="128"
    height="128"
    viewBox="0 0 128 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="52" y="12" width="24" height="24" rx="6" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3" fill="none" />
    <path d="M64 36V52" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3" />
    <path d="M36 52L92 52" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3" />
    <path d="M36 52V68" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3" />
    <path d="M92 52V68" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3" />
    <path d="M64 52V68" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3" />
    <rect x="20" y="68" width="32" height="28" rx="6" stroke="#D1D5DB" strokeWidth="2" fill="none" />
    <rect x="48" y="68" width="32" height="28" rx="6" stroke="#D1D5DB" strokeWidth="2" fill="none" />
    <rect x="76" y="68" width="32" height="28" rx="6" stroke="#D1D5DB" strokeWidth="2" fill="none" />
    <circle cx="36" cy="82" r="4" stroke="#9CA3AF" strokeWidth="2" fill="none" />
    <circle cx="64" cy="82" r="4" stroke="#9CA3AF" strokeWidth="2" fill="none" />
    <circle cx="92" cy="82" r="4" stroke="#9CA3AF" strokeWidth="2" fill="none" />
    <circle cx="64" cy="24" r="4" stroke="#9CA3AF" strokeWidth="2" fill="none" />
  </svg>
);

export default EmptySystemIcon;
