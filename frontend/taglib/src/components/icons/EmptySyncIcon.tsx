import type { FC } from 'react';

const EmptySyncIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    width="128"
    height="128"
    viewBox="0 0 128 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M28 48C28 34.745 38.745 24 52 24H56"
      stroke="#D1D5DB"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M100 80C100 93.255 89.255 104 76 104H72"
      stroke="#D1D5DB"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M44 32L56 24L48 14"
      stroke="#D1D5DB"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M84 96L72 104L80 114"
      stroke="#D1D5DB"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="64" cy="64" r="20" stroke="#D1D5DB" strokeWidth="2" fill="none" />
    <path
      d="M64 52V64L72 72"
      stroke="#9CA3AF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="64" cy="64" r="2" fill="#9CA3AF" />
  </svg>
);

export default EmptySyncIcon;
