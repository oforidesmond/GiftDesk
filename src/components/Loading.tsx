'use client'

import { useLoading } from "@/context/LoadingContext";

export default function Loading() {
   const { isLoading, loadingMessage } = useLoading();

  if (!isLoading) return null;

 return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="flex items-center space-x-3 bg-transparent p-4 rounded-lg">
        <div className="relative">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 sm:border-[5px] border-4 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 border-4 border-gray-500 border-b-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    </div>
  );
}