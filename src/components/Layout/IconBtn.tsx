import { LucideIcon } from 'lucide-react';

interface IconBtnProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'warning' | 'primary';
}

const variantStyles = {
  default: 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50',
  danger: 'border-rose-300 text-rose-600 hover:border-rose-400 hover:text-rose-800 hover:bg-rose-50',
  warning: 'border-amber-300 text-amber-600 hover:border-amber-400 hover:text-amber-800 hover:bg-amber-50',
  primary: 'border-blue-300 text-blue-600 hover:border-blue-400 hover:text-blue-800 hover:bg-blue-50',
};

const disabledStyle = 'opacity-50 cursor-not-allowed hover:border-slate-300 hover:text-slate-600 hover:bg-white';

export function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  variant = 'default',
}: IconBtnProps) {
  const variantClass = variantStyles[variant];
  const baseClass = 'p-1.5 rounded-lg border transition-colors';
  const finalClass = disabled
    ? `${baseClass} ${disabledStyle}`
    : `${baseClass} ${variantClass}`;

  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={finalClass}
    >
      <Icon size={15} />
    </button>
  );
}
