export function Rosette({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="rosette" aria-hidden="true">
      <circle cx="20" cy="20" r="18" stroke="#c89b3c" strokeWidth="1.4" />
      <circle cx="20" cy="20" r="12.5" stroke="#c89b3c" strokeWidth="1" strokeDasharray="2 2.4" />
      <path d="M20 10 L22.5 17.5 L20 25 L17.5 17.5 Z" fill="#c89b3c" />
    </svg>
  );
}
