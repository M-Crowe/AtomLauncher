import React from 'react';
import type { Account } from '../types/account';
import { PixelAvatar } from './PixelAvatar';

interface AccountCardProps {
  account: Account | null;
  onClick: () => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, onClick }) => {
  const username = account?.name || 'USERNAME';
  const isMicrosoft = account?.accountType === 'microsoft';

  return (
    <div
      data-testid="top-account-card"
      onClick={onClick}
      className="
        h-full w-full
        flex items-center justify-end gap-3.5
        cursor-pointer select-none
        group
        transition-opacity hover:opacity-85 active:opacity-70
      "
      title="点击切换与管理账号"
    >
      {/* 玩家名称与类型标签 (纯文本排列，无任何多余边框与底框，完美契合图二) */}
      <div className="flex flex-col items-end justify-center min-w-0">
        <span
          data-testid="account-card-username"
          className="
            font-fusion text-[20px] font-bold tracking-wider text-dirt-80
            group-hover:text-btn-primary-bg transition-colors
            truncate max-w-[170px] text-right uppercase leading-tight
          "
        >
          {username}
        </span>
        <span
          data-testid="account-card-type-badge"
          className={`
            font-fusion text-[10px] font-medium tracking-tight mt-0.5
            ${isMicrosoft ? 'text-emerald-700' : 'text-stone-60'}
          `}
        >
          {isMicrosoft ? '[微软正版]' : '[离线]'}
        </span>
      </div>

      {/* 像素头像方块 (对齐图二右侧方块) */}
      <div className="shrink-0 transition-transform group-hover:scale-105">
        <PixelAvatar
          skinUrl={account?.skinUrl}
          size={44}
          className="border-2 border-border-hard shadow-[2px_2px_0_0_rgba(0,0,0,0.25)]"
        />
      </div>
    </div>
  );
};
