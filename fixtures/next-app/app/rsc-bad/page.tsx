// A Server Component: it never runs in the browser, so only axe can see these issues.
export default function RscBad() {
  return (
    <>
      <h1>Server-rendered issues</h1>
      <img src="/missing.png" width={16} height={16} />
      <button type="button" />
    </>
  );
}
