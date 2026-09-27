import React from 'react';
import type { Account } from '../types/account';
import { PixelAvatar } from './PixelAvatar';

interface AccountCardProps {
  account: Account | null;
  onClick: () => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, onClick }) => {
  const username = account?.name || 'Player';
  const isMicrosoft = account?.accountType === 'microsoft';

  return (
    <button
      type="button"
      data-testid="top-account-card"
      onClick={onClick}
      className="
        h-full w-full
        flex items-center justify-between
        px-3.5 py-2
        bg-surface-card hover:bg-dirt-20/40 active:bg-dirt-20/60
        ring-2 ring-inset ring-surface-slot hover:ring-grass-80
        shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]
        cursor-pointer select-none transition-all
        group text-left
      "
      title="点击管理与切换 Minecraft 账户"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <PixelAvatar skinUrl={account?.skinUrl} size={38} className="group-hover:scale-105 transition-transform" />
        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <div className="flex items-center gap-1.5">
            <span
              data-testid="account-card-username"
              className="font-fusion text-sm font-bold text-stone-100 truncate tracking-wide"
            >
              {username}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              data-testid="account-card-type-badge"
              className={`
                font-fusion text-[10px] px-1.5 py-0.2 rounded-xs font-medium tracking-tight whitespace-nowrap
                ${isMicrosoft
                  ? 'bg-emerald-700/80 text-emerald-100 ring-1 ring-emerald-500/50'
                  : 'bg-stone-700/80 text-stone-200 ring-1 ring-stone-500/50'
                }
              `}
            >
              {isMicrosoft ? '[微软正版]' : '[离线]'}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 pl-2 text-stone-60 group-hover:text-btn-primary-bg font-fusion text-xs transition-colors">
        ▼
      </div>
    </button>
  );
};
