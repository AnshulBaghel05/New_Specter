export default function InventoryLoading() {
  return (
    <div className="min-h-screen bg-bg animate-pulse">
      <div className="pt-28 pb-10 text-center px-6">
        <div className="h-6 w-48 bg-surface rounded-full mx-auto mb-6" />
        <div className="h-12 w-2/3 bg-surface rounded-xl mx-auto mb-4" />
        <div className="h-5 w-1/2 bg-surface rounded-lg mx-auto" />
      </div>
      <div className="max-w-5xl mx-auto px-6 pb-10">
        <div className="flex gap-2 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-28 bg-surface rounded-lg" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-surface border border-border rounded-2xl p-6 h-96" />
          <div className="bg-surface border border-border rounded-2xl p-6 h-96" />
        </div>
      </div>
    </div>
  )
}
