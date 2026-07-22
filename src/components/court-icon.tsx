"use client";

interface CourtIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export default function CourtIcon({ size = 48, color = "currentColor", className = "" }: CourtIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer court boundary - perspective trapezoid */}
      <path
        d="M16 8 L48 8 L56 56 L8 56 Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Top boundary line */}
      <line x1="16" y1="8" x2="48" y2="8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {/* Bottom boundary line */}
      <line x1="8" y1="56" x2="56" y2="56" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {/* Left side line */}
      <line x1="16" y1="8" x2="8" y2="56" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {/* Right side line */}
      <line x1="48" y1="8" x2="56" y2="56" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {/* Center net line - dashed */}
      <line x1="12" y1="32" x2="52" y2="32" stroke={color} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />

      {/* Left singles line */}
      <line x1="18" y1="12" x2="11" y2="52" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

      {/* Right singles line */}
      <line x1="46" y1="12" x2="53" y2="52" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

      {/* Top service line */}
      <line x1="19" y1="18" x2="45" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

      {/* Bottom service line */}
      <line x1="15" y1="46" x2="49" y2="46" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

      {/* Center service line */}
      <line x1="32" y1="18" x2="32" y2="46" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
