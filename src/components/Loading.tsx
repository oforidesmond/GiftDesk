export default function Loading() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-transparent">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-gray-400 border-b-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}