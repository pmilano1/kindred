import ResearchQueueClient from '@/components/ResearchQueueClient';
import { PageHeader } from '@/components/ui';

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
