import PersonPageClient from '@/components/PersonPageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="content-wrapper px-4 py-6">
      <PersonPageClient personId={id} />
    </div>
  );
}
