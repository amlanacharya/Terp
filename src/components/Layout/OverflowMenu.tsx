import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, LucideIcon } from 'lucide-react';

interface OverflowMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'warning' | 'primary';
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
}

const variantTextColors = {
  default: 'text-slate-700 hover:bg-slate-50',
  danger: 'text-rose-600 hover:bg-rose-50',
  warning: 'text-amber-600 hover:bg-amber-50',
  primary: 'text-blue-600 hover:bg-blue-50',
};

export function OverflowMenu({ items }: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (onClick: () => void) => {
    onClick();
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="More actions"
        className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 bg-white rounded-2xl shadow-lg z-50 border border-slate-200 py-1 min-w-max">
          {items.map((item, idx) => {
            const Icon = item.icon;
            const textColor = variantTextColors[item.variant || 'default'];
            const isDisabled = item.disabled ?? false;

            return (
              <button
                key={idx}
                onClick={() => handleItemClick(item.onClick)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : `${textColor} cursor-pointer`
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
