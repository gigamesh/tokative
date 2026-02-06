import { DashboardContent } from "@/components/DashboardContent";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardLoading() {
  return (
    <div className="min-h-content bg-tiktok-dark">
      <header className="border-b border-gray-800 bg-tiktok-gray/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Tokative</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </main>
    </div>
  );
}
