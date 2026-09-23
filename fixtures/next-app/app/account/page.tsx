import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountPanel } from './panel';

// Signed-in page: without the fake session cookie it redirects to /login.
export default async function Account() {
  const session = (await cookies()).get('session');
  if (session?.value !== 'ok') redirect('/login');
  return (
    <>
      <h1>Account</h1>
      <AccountPanel />
    </>
  );
}
