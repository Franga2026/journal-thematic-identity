import type { ReactNode } from 'react';
import Header from '../../components/layout/Header';
import StatsBar from '../../components/layout/StatsBar';
import TabNavigation from '../../components/layout/TabNavigation';
import Footer from '../../components/layout/Footer';

interface Props { children: ReactNode; }

export default function AppLayout({ children }: Props): JSX.Element {
  return (
    <div className="app">
      <Header />
      <StatsBar />
      <TabNavigation />
      <main className="main-content" role="main">
        {children}
      </main>
      <Footer />
    </div>
  );
}
