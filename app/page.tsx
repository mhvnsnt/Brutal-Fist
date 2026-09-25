'use client';

import dynamic from 'next/dynamic';

const BrutalFistPreview = dynamic(() => import('../src/App'), { ssr: false });

export default function HomePage() {
  return <BrutalFistPreview />;
}
