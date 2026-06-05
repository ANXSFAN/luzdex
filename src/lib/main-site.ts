import "server-only";

const MAIN_SITE_URL = (process.env.MAIN_SITE_URL || "").replace(/\/$/, "");

export interface MainSiteProduct {
  id: string;
  slug: string;
  modelNumber: string;
  content: Record<string, { name?: string; description?: string }>;
  images: { url: string }[];
}

/** Pull the full product catalog from the main site (read-only, paginated). */
export async function fetchMainSiteProducts(): Promise<MainSiteProduct[]> {
  if (!MAIN_SITE_URL) throw new Error("MAIN_SITE_URL 未配置");

  const all: MainSiteProduct[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(
      `${MAIN_SITE_URL}/api/products?all=true&page=${page}&pageSize=100`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`主站返回 ${res.status}`);
    const data = await res.json();
    all.push(...((data.products as MainSiteProduct[]) || []));
    totalPages = data.totalPages || 1;
    page++;
  } while (page <= totalPages);

  return all;
}

export function productName(content: MainSiteProduct["content"]): string {
  return content?.zh?.name || content?.en?.name || "";
}
