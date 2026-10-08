import { useState, useEffect } from 'react';

export type SettingsCategory = 'java' | 'game' | 'download' | 'launcher';

type Listener = () => void;
let globalActiveCategory: SettingsCategory = 'java';
const categoryListeners = new Set<Listener>();

const VALID_CATEGORIES: ReadonlySet<SettingsCategory> = new Set(['java', 'game', 'download', 'launcher']);

export function getActiveCategory(): SettingsCategory {
  return globalActiveCategory;
}

export function setActiveCategory(cat: SettingsCategory): void {
  if (!VALID_CATEGORIES.has(cat)) {
    return;
  }
  if (globalActiveCategory !== cat) {
    globalActiveCategory = cat;
    categoryListeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Error in category listener:', err);
      }
    });
  }
}

export function resetActiveCategory(): void {
  setActiveCategory('java');
}

export function useSettingsCategory(): [SettingsCategory, (cat: SettingsCategory) => void] {
  const [cat, setCat] = useState<SettingsCategory>(globalActiveCategory);
  useEffect(() => {
    const handler = () => setCat(globalActiveCategory);
    categoryListeners.add(handler);
    return () => {
      categoryListeners.delete(handler);
    };
  }, []);
  return [cat, setActiveCategory];
}
