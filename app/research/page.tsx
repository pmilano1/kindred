import { PageHeader } from '@/components/ui';
import ResearchQueueClient from '@/components/ResearchQueueClient';

export default function ResearchQueuePage() {
  return (
    <>
      <PageHeader
        title="Research Queue"
        subtitle="People prioritized for research"
        icon="ClipboardList"
      />
      <div className="content-wrapper">
        <ResearchQueueClient />
      </div>
    </>
  );
}

