import { Suspense } from 'react';
import SignInForm from '@/components/SignInForm';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="text-center mt-10">Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}