// src/components/PWAInstallModal.tsx
'use client';
import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

// Extend Window interface for MSStream and standalone
interface ExtendedWindow extends Window {
  MSStream?: unknown;
  standalone?: boolean; // iOS standalone mode
}

export default function PWAInstallModal() {
  const [showModal, setShowModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as ExtendedWindow).MSStream;
    setIsIOS(isIOSDevice);
    console.log('iOS Detection:', isIOSDevice);

    // Detect standalone mode (PWA installed)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window as ExtendedWindow).standalone === true;
    setIsStandalone(isStandaloneMode);
    console.log('Standalone Mode:', isStandaloneMode);

    // Handle beforeinstallprompt for non-iOS browsers
    if (!isIOSDevice && !isStandaloneMode) {
      const handler = (e: Event) => {
        e.preventDefault();
        console.log('beforeinstallprompt fired');
        setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  useEffect(() => {
    // Skip if modal shown or in standalone mode
    if (sessionStorage.getItem('pwaModalShown') || isStandalone) {
      console.log('Modal skipped: sessionStorage or standalone');
      return;
    }

    // Show modal after 5 seconds if installPrompt or iOS
    if (installPrompt || (isIOS && !isStandalone)) {
      console.log('Scheduling modal display');
      const timer = setTimeout(() => {
        console.log('Showing modal');
        setShowModal(true);
        sessionStorage.setItem('pwaModalShown', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [installPrompt, isIOS, isStandalone]);

  const handleInstall = async () => {
    if (installPrompt) {
      console.log('Triggering install prompt');
      (installPrompt as any).prompt();
      const { outcome } = await (installPrompt as any).userChoice;
      console.log('Install prompt outcome:', outcome);
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        setShowModal(false);
      }
    } else if (isIOS) {
      console.log('Showing iOS instructions');
      alert(
        'To install Gift Desk on iOS:\n1. Tap the Share icon (square with an arrow) in Safari.\n2. Select "Add to Home Screen".\n3. Tap "Add" in the top-right corner.'
      );
      setShowModal(false);
    }
  };

  const handleClose = () => {
    console.log('Closing modal');
    setShowModal(false);
    sessionStorage.setItem('pwaModalShown', 'true');
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Install Gift Desk</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <p className="text-gray-600 mb-6">
          Install Gift Desk as an app for quick access and offline use at your events!
        </p>
        <button
          onClick={handleInstall}
          className="flex items-center justify-center w-full p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
          {isIOS ? 'Add to Home Screen' : 'Install App'}
        </button>
      </div>
    </div>
  );
}