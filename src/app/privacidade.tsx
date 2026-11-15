import { LegalPage } from '@/components/legal-page';
import { PRIVACY } from '@/constants/legal';

export default function Privacidade() {
  return <LegalPage doc={PRIVACY} current="privacy" />;
}
