import { Accessible } from './accessible';

// Clean page: the runtime check should report nothing here.
export default function Home() {
  return (
    <>
      <h1>Orders</h1>
      <Accessible />
    </>
  );
}
