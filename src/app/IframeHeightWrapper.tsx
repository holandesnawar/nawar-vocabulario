'use client';

import { useIframeHeight } from './hooks/useIframeHeight';

/**
 * Wrapper cliente que activa el hook de comunicación de altura con el iframe
 * padre (Circle). Es necesario porque layout.tsx es un Server Component
 * y los hooks solo funcionan en Client Components.
 */
export default function IframeHeightWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  useIframeHeight();
  return <>{children}</>;
}
