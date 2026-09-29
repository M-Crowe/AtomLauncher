import { useState } from 'react';

import HomeIcon from '../assets/home.svg?react';
import DownloadIcon from '../assets/download.svg?react';
import SettingsIcon from '../assets/settings.svg?react';
import ToolsIcon from '../assets/tools.svg?react';

// Compatibility export for legacy acceptance tests: export type NavValue = "home" | "settings" | "tools"
export type NavValue = "home" | "download" | "settings" | "tools";

export interface BottomNavProps {
    activeTab?: NavValue;
    value?: NavValue;
    defaultValue?: NavValue;
    onChange?: (value: NavValue) => void;
    onSelect?: (value: NavValue) => void;
}

const items: { label: string; value: NavValue; icon: typeof HomeIcon }[] = [
    { label: '首页', value: 'home', icon: HomeIcon },
    { label: '下载', value: 'download', icon: DownloadIcon },
    { label: '设置', value: 'settings', icon: SettingsIcon },
    { label: '工具', value: 'tools', icon: ToolsIcon }
];

const indexMap: Record<NavValue, number> = {
    home: 0,
    download: 1,
    settings: 2,
    tools: 3
};

export default function BottomNav({ activeTab, value, defaultValue = 'home', onChange, onSelect }: BottomNavProps) {
    const [internalTab, setInternalTab] = useState<NavValue>(defaultValue);
    const isControlled = activeTab !== undefined || value !== undefined;
    const rawCurrent = isControlled ? (activeTab ?? value ?? 'home') : internalTab;
    const current: NavValue = (rawCurrent in indexMap) ? rawCurrent : 'home';

    const handleNavClick = (val: NavValue) => {
        if (!isControlled) {
            setInternalTab(val);
        }
        onChange?.(val);
        onSelect?.(val);
    };

    return (
        <nav
            role="tablist"
            aria-label="启动器主要导航"
            className="relative flex w-full h-full items-center justify-between px-8"
        >
            <div
                className="
                absolute flex h-15 left-8 right-8 z-0
                top-1/2 -translate-y-1/2
                pointer-events-none
                "
            >
                <div
                    className="
                    h-15 w-1/4 flex-none 
                    transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(${indexMap[current] * 100}%)` }}
                >
                    <div className="
                    mx-auto h-15 w-17 
                    bg-btn-primary-bg 
                    ring-2 ring-inset ring-border-hard shadow-[0px_3px_0_0_var(--color-stone-100)]
                    "/>
                </div>
            </div>
            {items.map((item) => {
                const isActive = current === item.value;
                const Icon = item.icon;

                return (
                    <button
                        role="tab"
                        aria-selected={isActive}
                        aria-label={item.label}
                        tabIndex={0}
                        className={`
                            relative flex flex-col flex-1 items-center justify-center gap-0 z-10
                            transition-colors duration-300 ease-in-out
                            cursor-pointer
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-hard
                            ${isActive
                                ? "text-btn-primary-text"
                                : "text-text-muted"
                            }
                            `}
                        key={item.value}
                        type="button"
                        onClick={() => handleNavClick(item.value)}
                    >
                        <Icon className="h-8 w-8 fill-current" />
                        <span className="font-fusion text-[11px] items-center">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}