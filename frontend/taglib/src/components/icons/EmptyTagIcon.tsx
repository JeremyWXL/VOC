import type { FC } from 'react';

const EmptyTagIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    width="128"
    height="128"
    viewBox="0 0 128 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16 56L64 16L112 56V104C112 107.314 109.314 110 106 110H22C18.686 110 16 107.314 16 104V56Z"
      stroke="#D1D5DB"
      strokeWidth="2"
      strokeDasharray="6 4"
      fill="none"
    />
    <circle cx="64" cy="52" r="12" stroke="#D1D5DB" strokeWidth="2" fill="none" />
    <path d="M58 52H70M64 46V58" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
    <path
      d="M40 80H88M40 92H72"
      stroke="#E5E7EB"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default EmptyTagIcon;
