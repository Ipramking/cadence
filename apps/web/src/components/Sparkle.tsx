export function Sparkle({
  size = 18,
  className = "",
  color = "var(--primary)",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={color}
      aria-hidden
    >
      <path d="M12 0C12.5 6.2 17.8 11.5 24 12C17.8 12.5 12.5 17.8 12 24C11.5 17.8 6.2 12.5 0 12C6.2 11.5 11.5 6.2 12 0Z" />
    </svg>
  );
}
