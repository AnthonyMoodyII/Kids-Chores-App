import { Trophy, Star } from 'lucide-react';
import { cardSurface } from '../lib/constants';

interface MilestoneModalProps {
  title: string;
  isMilestone: boolean;
}

export function MilestoneModal({ title, isMilestone }: MilestoneModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-md">
      <div className={`${cardSurface} max-w-sm animate-in zoom-in p-10 text-center duration-300`}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          {isMilestone ? <Trophy /> : <Star />}
        </div>
        <h2 className="text-xl font-black text-slate-900">
          {isMilestone ? 'Milestone!' : 'Good job!'}
        </h2>
        <p className="mt-2 text-slate-500">You checked off "{title}"!</p>
      </div>
    </div>
  );
}
