import WatchlistDetail from '@app/components/Watchlists/WatchlistDetail';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';

const WatchlistDetailPage: NextPage = () => {
  const router = useRouter();
  const mediaListId = Number(router.query.mediaListId);

  if (!Number.isFinite(mediaListId)) {
    return null;
  }

  return <WatchlistDetail mediaListId={mediaListId} />;
};

export default WatchlistDetailPage;
