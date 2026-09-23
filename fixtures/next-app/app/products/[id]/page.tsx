// Dynamic route: discovery skips it; pass concrete URLs through the routes input.
export default async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1>Product {id}</h1>;
}
