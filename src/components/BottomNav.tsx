import {useState} from 'react';

import HomeIcon from '../assets/home.svg?react';
import SettingsIcon from '../assets/settings.svg?react';
import ToolsIcon from '../assets/tools.svg?react';

type NavValue = "home" | "settings" | "tools";

const items: { label: string; value: NavValue; icon: typeof HomeIcon }[] = [
    { label: '首页', value: 'home', icon: HomeIcon},
    { label: '设置', value: 'settings', icon: SettingsIcon},
    { label: '工具', value: 'tools', icon: ToolsIcon}
];

export default function BottomNav() {
    const [active, setActive] = useState<NavValue>('home');
    const [pending, setPending] = useState<NavValue>('home');

    const handleNavClick = (value: NavValue) => {
        setPending(value);
        setActive(value);
    };

    const indexMap: Record<NavValue, number> = {
        home: 0,
        settings: 1,
        tools: 2
    }

    return (
        <nav className="relative flex w-full h-full items-center justify-between px-16">
            <div
                className="
                absolute flex h-15 left-16 right-16 z-0
                top-1/2 -translate-y-1/2
                pointer-events-none
                "
            >
                <div
                    className="
                    h-15 w-1/3 flex-none 
                    transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(${indexMap[pending] * 100}%)` }}
                >
                    <div className="
                    mx-auto h-15 w-19 
                    bg-btn-primary-bg 
                    ring-2 ring-inset ring-border-hard shadow-[0px_3px_0_0_var(--color-stone-100)]
                    "/>
                </div>
            </div>
            {items.map((item) => {
                const isActive = active === item.value;
                const Icon = item.icon;

                return (
                    <button
                        className={`
                            relative flex flex-col flex-1 items-center justify-center gap-0 z-10
                            transition-colors duration-300 ease-in-out
                            cursor-pointer
                            ${isActive
                                ?"text-btn-primary-text"
                                :"text-text-muted"
                            }
                            `}
                        key = {item.value}
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