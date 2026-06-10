export default function ToolsLoading() {
  return (
    <div className="min-h-screen bg-bg pt-28 pb-24 px-6 animate-pulse">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <div className="h-4 w-24 bg-surface rounded-full mx-auto mb-8" />
        <div className="h-12 w-3/4 bg-surface rounded-xl mx-auto mb-5" />
        <div className="h-5 w-full bg-surface rounded-lg mx-auto mb-2" />
        <div className="h-5 w-2/3 bg-surface rounded-lg mx-auto" />
      </div>
      <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-6 h-52" />
        ))}
      </div>
    </div>
  )
}
