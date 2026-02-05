import { BASE_URL } from "@/utils";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/onboarding", "/not-authorized"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
