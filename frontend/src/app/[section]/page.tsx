import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/common/coming-soon";
import { COMING_SOON } from "@/lib/constants";

// Only the placeholder sections listed in COMING_SOON exist; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(COMING_SOON).map((section) => ({ section }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return { title: COMING_SOON[section]?.title };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = COMING_SOON[section];
  if (!page) notFound();
  return <ComingSoon title={page.title} description={page.description} />;
}
