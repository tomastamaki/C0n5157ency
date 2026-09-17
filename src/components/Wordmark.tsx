export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <p className={`font-mono font-bold tracking-tight text-slate-900 dark:text-slate-50 ${className}`}>
      C<span className="text-[#D85A30] dark:text-[#F0997B]">0</span>n
      <span className="text-[#D85A30] dark:text-[#F0997B]">5157</span>ency
    </p>
  );
}
