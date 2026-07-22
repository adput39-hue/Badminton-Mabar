"use client";

interface Props {
  size?: number;
  className?: string;
}

export default function ShuttlecockIcon({ size = 48, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cork */}
      <path
        d="M26 20 C26 14 29 11 32 11 C35 11 38 14 38 20 L38 24 C38 26 36 28 32 28 C28 28 26 26 26 24 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Feather skirt - outer outline */}
      <path
        d="M28 28 C22 34 14 46 12 50 C12 52 16 53 20 52 C24 51 28 48 32 48 C36 48 40 51 44 52 C48 53 52 52 52 50 C50 46 42 34 36 28"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Feather lines */}
      <line x1="20" y1="34" x2="16" y2="50" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="26" y1="32" x2="22" y2="50" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="32" y1="32" x2="32" y2="50" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="38" y1="32" x2="42" y2="50" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="44" y1="34" x2="48" y2="50" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* Bottom edge */}
      <path
        d="M16 50 C20 47 26 48 32 48 C38 48 44 47 48 50"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
