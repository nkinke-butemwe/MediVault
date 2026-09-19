// src/components/DashboardSkeleton.tsx
// Full-screen "skeleton" placeholder shaped like the dashboard (sidebar,
// header bar and a few content cards) using grey pulsing blocks.
//
// It is shown the moment the user clicks Logout so the screen reacts
// instantly, instead of looking frozen while the logout request and the
// move to the login page finish.

// One grey pulsing block. Pass width/height/shape classes in "className".
function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-slate-200 animate-pulse ${className}`} />
}

export default function DashboardSkeleton() {
  return (
    <div
      className="min-h-screen bg-[#f4f7fc] flex"
      role="status"
      aria-busy="true"
      aria-label="Logging out"
    >
      {/* Sidebar placeholder */}
      <aside className="w-64 bg-[#0f3b5c] flex-shrink-0 p-4 space-y-6 hidden md:block">
        {/* Logo row */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-white/20 animate-pulse" />
            <div className="h-2 w-16 rounded bg-white/10 animate-pulse" />
          </div>
        </div>

        {/* User card */}
        <div className="h-16 rounded-xl bg-white/10 animate-pulse" />

        {/* Nav items */}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 rounded-xl bg-white/10 animate-pulse" />
          ))}
        </div>
      </aside>

      {/* Main area placeholder */}
      <div className="flex-1 flex flex-col">
        {/* Header bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <SkeletonBlock className="h-6 w-6 rounded-lg" />
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-4 w-40 rounded" />
            <SkeletonBlock className="h-8 w-8 rounded-full" />
          </div>
        </div>

        {/* Page content */}
        <div className="p-6 space-y-6">
          {/* Page title */}
          <div className="space-y-2">
            <SkeletonBlock className="h-7 w-64 rounded-lg" />
            <SkeletonBlock className="h-4 w-80 max-w-full rounded" />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} className="h-24 rounded-2xl" />
            ))}
          </div>

          {/* Large content cards */}
          <SkeletonBlock className="h-40 rounded-2xl" />
          <SkeletonBlock className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
