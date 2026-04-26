import type { FC } from 'react';

const LogoIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="32" height="32" rx="8" fill="#4F7BF7" />
    <path
      d="M6 12L10 20L14 12"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="19" cy="16" r="4" stroke="white" strokeWidth="1.8" fill="none" />
    <path
      d="M23 12C24.5 13.5 25 14.5 25 16C25 17.5 24.5 18.5 23 20"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M8 22H22"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export default LogoIcon;
