import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type DropUploadOverlayProps = {
  visible: boolean;
};

export function DropUploadOverlay({ visible }: DropUploadOverlayProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5"
      aria-hidden
    >
      <div className="flex flex-col items-center gap-2 rounded-lg bg-background/90 px-6 py-4 shadow-sm">
        <Upload className="h-8 w-8 text-primary" />
        <p className="text-sm font-medium">{t('dropUploadOverlay')}</p>
      </div>
    </div>
  );
}
