import { LegalPage } from '@/components/legal-page';
import { TERMS } from '@/constants/legal';

export default function Termos() {
  return <LegalPage doc={TERMS} current="terms" />;
}
