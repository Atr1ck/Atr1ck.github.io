export default function Loading() {
  return (
    <div className="grid min-h-[clamp(18rem,60vh,36rem)] w-full place-items-center px-4" role="status" aria-live="polite">
      <div className="flex flex-col items-center text-center text-base-content">
        <div className="relative grid h-20 w-20 place-items-center" aria-hidden="true">
          <span className="absolute inset-1 rounded-full border border-base-content/10" />
          <span className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-primary border-t-primary motion-reduce:animate-none" />
          <span className="absolute inset-3 animate-[spin_1.8s_linear_infinite_reverse] rounded-full border border-transparent border-b-base-content/30 motion-reduce:animate-none" />
          <img className="h-11 w-11 rounded-full border border-base-300 object-cover shadow-sm" src="/images/avatar.jpg" alt="" />
        </div>
        <p className="mt-4 text-sm font-medium">内容加载中</p>
        <div className="mt-2 flex h-2 items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/65 [animation-delay:180ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/35 [animation-delay:360ms]" />
        </div>
      </div>
      <span className="sr-only">正在加载页面内容</span>
    </div>
  );
}
