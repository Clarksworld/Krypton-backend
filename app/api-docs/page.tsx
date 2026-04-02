import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "./react-swagger";

export const metadata = {
  title: "API Docs | Krypton Backend",
  description: "Interactive API documentation for Krypton Backend.",
};

export default async function IndexPage() {
  const spec = await getApiDocs();
  return (
    <main style={{ padding: "0" }}>
      <ReactSwagger spec={spec} />
    </main>
  );
}
