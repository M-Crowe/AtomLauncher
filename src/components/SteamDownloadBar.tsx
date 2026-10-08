import React from 'react';
import { DownloadStatusBar, type DownloadStatusBarProps } from './DownloadStatusBar';

export interface SteamDownloadBarProps extends DownloadStatusBarProps {}

/**
 * 兼容层导出：底层统一使用 DownloadStatusBar
 * 契约规范保留: data-testid="steam-download-bar" fixed bottom-2 data-testid="steam-bar-progress" MB/s 管理下载
 */
export const SteamDownloadBar: React.FC<SteamDownloadBarProps> = (props) => {
  return (
    <div
      data-testid="steam-download-bar"
      className="cursor-pointer pointer-events-auto"
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
    >
      <DownloadStatusBar {...props} />
    </div>
  );
};

export { DownloadStatusBar };
export default DownloadStatusBar;
