import { Suspense } from 'react';
import SignInForm from '@/components/SignInForm';
import Loading from '@/components/Loading';

export default function SignInPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SignInForm />
    </Suspense>
  );
}