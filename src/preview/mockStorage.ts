import type { Bucket } from '@/lib/storageApi';

const DEMO_BUCKET: Bucket = {
  id: 'bucket-company',
  name: 'company',
  public: false,
  display_name: 'Company files',
  access: {
    audience: 'company',
    readers: 'company',
    writers: 'company',
    can_write: true,
    grants_enabled: true,
    shareable: true,
    description: 'Shared with your company',
  },
};

export const demoBuckets: Bucket[] = [DEMO_BUCKET];

export const demoItems = [
  {
    name: 'Design',
    id: null as string | null,
    metadata: {},
    folder_id: 'folder-design',
  },
  {
    name: 'Engineering',
    id: null as string | null,
    metadata: {},
    folder_id: 'folder-eng',
  },
  {
    name: 'Brand guidelines.pdf',
    id: 'file-brand',
    metadata: { size: 2_450_000, mimetype: 'application/pdf', lastModified: '2026-03-01T10:00:00Z' },
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    name: 'Launch checklist.md',
    id: 'file-launch',
    metadata: { size: 12_400, mimetype: 'text/markdown', lastModified: '2026-03-10T14:22:00Z' },
    updated_at: '2026-03-10T14:22:00Z',
  },
  {
    name: 'Q1 report.xlsx',
    id: 'file-q1',
    metadata: {
      size: 890_000,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: '2026-02-15T09:00:00Z',
    },
    updated_at: '2026-02-15T09:00:00Z',
  },
];
