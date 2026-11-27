import type { Metadata } from 'next'
import { LoadingScreen } from '@/components/loading-screen'

export const metadata: Metadata = {
  title: 'Loading — Thapar Connect',
  description: 'Preparing your Thapar Connect experience.',
}

export default function LoadingPage() {
  return <LoadingScreen />
}
