export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <p className={`font-mono font-bold tracking-tight text-ink ${className}`}>
      C<span className="text-accent">0</span>n<span className="text-accent">5157</span>ency
    </p>
  );
}
