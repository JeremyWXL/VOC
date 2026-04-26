import type { FC } from 'react';

const NoResultIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    width="96"
    height="96"
    viewBox="0 0 96 96"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="40" cy="40" r="22" stroke="#D1D5DB" strokeWidth="2.5" fill="none" />
    <path
      d="M56 56L72 72"
      stroke="#D1D5DB"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M40 30V50M30 40H50"
      stroke="#E5E7EB"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="66" cy="66" r="12" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="3 3" fill="none" />
  </svg>
);

export default NoResultIcon;
