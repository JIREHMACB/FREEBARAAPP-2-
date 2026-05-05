import React from 'react';

interface User {
  id: number;
  name: string;
  avatarUrl?: string;
}

interface MentionPickerProps {
  results: User[];
  onSelect: (user: User) => void;
  className?: string;
}

export default function MentionPicker({ results, onSelect, className = "" }: MentionPickerProps) {
  if (results.length === 0) return null;

  return (
    <div className={`absolute z-50 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto ${className}`}>
      <div className="p-2 bg-slate-50 border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mentionner quelqu'un</span>
      </div>
      {results.map(user => (
        <button
          key={user.id}
          type="button"
          onClick={() => onSelect(user)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 text-left transition-colors border-b border-slate-50 last:border-0"
        >
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                {user.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900">{user.name}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
