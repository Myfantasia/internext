import React from 'react';

interface LogoMarkProps {
  className?: string;
  size?: number;
}

// Clean digital recreation of the Internext Business System mark — a
// faceted diamond built from four interlocking chevrons (echoing the
// original print logo's blue-toned "IBS" geometry) rather than a literal
// reproduction of the photographed logo. Works on light and dark grounds.
export const LogoMark: React.FC<LogoMarkProps> = ({ className = '', size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="Internext Business System"
  >
    <polygon points="20,2 36,20 20,16" fill="#0ea5e9" />
    <polygon points="20,2 4,20 20,16" fill="#0369a1" />
    <polygon points="20,38 36,20 20,24" fill="#0284c7" />
    <polygon points="20,38 4,20 20,24" fill="#0b3d91" />
  </svg>
);

interface LogoProps {
  variant?: 'full' | 'mark';
  size?: number;
  className?: string;
  titleClassName?: string;
  taglineClassName?: string;
  /** Extra classes for the wordmark, e.g. to hide it on narrow screens. */
  textClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'full', size = 36, className = '', titleClassName = 'text-white', taglineClassName = 'text-cyan-400', textClassName = '' }) => {
  if (variant === 'mark') {
    return <LogoMark size={size} className={className} />;
  }
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <div className={textClassName}>
        <div className={`font-black leading-tight tracking-tight ${titleClassName}`} style={{ fontSize: size * 0.42 }}>
          INTERNEXT
        </div>
        <div className={`text-[9px] uppercase tracking-wider font-bold -mt-0.5 ${taglineClassName}`}>
          We Make Technology Happen
        </div>
      </div>
    </div>
  );
};
