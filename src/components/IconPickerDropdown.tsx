import { useState } from 'react';
import { btnBase, btnPress } from '../lib/constants';

const EMOJI_OPTIONS = [
  '🎮','📺','🌙','🍕','🎬','🛒','🍦','🎉','🏆','⭐',
  '🎁','🎯','🎲','🎸','🎨','🚀','🦄','🌈','🍰','🎪',
  '🏄','🤿','🎠','🎡','🎢','🎭','🎵','🎤','🎧','🎻',
  '🏀','⚽','🎾','🏊','🚴','🛹','🎿','🎳','🏓','🥋',
  '🍫','🍿','🥤','🍩','🧁','🍪','🍓','🍉','🍭','🥳',
  '🛋','📚','✈️','🚢','🏰','🌊','🏔','🌺','🦋','🐶',
];

type AccentColor = 'indigo' | 'emerald' | 'amber';

interface IconPickerDropdownProps {
  accentColor: AccentColor;
  customIcons: string[];
  onSelect: (icon: string) => void;
  onClose: () => void;
  removeCustomIcon: (url: string) => void;
  saveCustomIcon: (url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const ACCENT = {
  indigo: {
    border: 'border-indigo-100',
    hover: 'hover:border-indigo-300 hover:bg-indigo-50',
    emojiHover: 'hover:bg-indigo-50',
    inputRing: 'ring-indigo-400/30 focus:border-indigo-300 focus:ring-2',
    btnBg: 'bg-indigo-600',
    uploadHover: 'hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700',
    linkColor: 'text-indigo-600 hover:text-indigo-700',
  },
  emerald: {
    border: 'border-emerald-100',
    hover: 'hover:border-emerald-300 hover:bg-emerald-50',
    emojiHover: 'hover:bg-emerald-50',
    inputRing: 'ring-emerald-400/30 focus:border-emerald-300 focus:ring-2',
    btnBg: 'bg-emerald-600',
    uploadHover: 'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
    linkColor: 'text-emerald-600 hover:text-emerald-700',
  },
  amber: {
    border: 'border-amber-100',
    hover: 'hover:border-amber-300 hover:bg-amber-50',
    emojiHover: 'hover:bg-amber-50',
    inputRing: 'ring-amber-400/30 focus:border-amber-300 focus:ring-2',
    btnBg: 'bg-amber-500',
    uploadHover: 'hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700',
    linkColor: 'text-amber-600 hover:text-amber-700',
  },
} as const;

export function IconPickerDropdown({
  accentColor,
  customIcons,
  onSelect,
  onClose,
  removeCustomIcon,
  saveCustomIcon,
  fileInputRef,
}: IconPickerDropdownProps) {
  const [urlIconInput, setUrlIconInput] = useState('');
  const [urlIconError, setUrlIconError] = useState('');

  const ac = ACCENT[accentColor];

  const handleSelect = (icon: string) => {
    onSelect(icon);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border ${ac.border} bg-white p-3 shadow-2xl`}>
        {/* Custom imported icons */}
        {customIcons.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Imported icons</p>
            <div className="flex flex-wrap gap-1">
              {customIcons.map(url => (
                <div key={url} className="group relative">
                  <button
                    type="button"
                    onClick={() => handleSelect(url)}
                    className={`${btnBase} flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white ${ac.hover}`}
                    title={url}
                  >
                    <img src={url} className="h-6 w-6 object-contain" alt="icon" />
                  </button>
                  <button
                    type="button"
                    onClick={ev => { ev.stopPropagation(); removeCustomIcon(url); }}
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover:flex"
                    title="Remove"
                  >×</button>
                </div>
              ))}
            </div>
            <hr className="my-2 border-slate-100" />
          </div>
        )}

        {/* Emoji grid */}
        <div className="mb-2 grid grid-cols-10 gap-0.5">
          {EMOJI_OPTIONS.map(em => (
            <button
              key={em}
              type="button"
              onClick={() => handleSelect(em)}
              className={`${btnBase} rounded-lg p-0.5 text-xl ${ac.emojiHover}`}
            >{em}</button>
          ))}
        </div>

        {/* URL import */}
        <div className="border-t border-slate-100 pt-2">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Import icon from URL</p>
          <div className="flex gap-1">
            <input
              type="url"
              placeholder="https://..."
              className={`flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none ${ac.inputRing}`}
              value={urlIconInput}
              onChange={ev => { setUrlIconInput(ev.target.value); setUrlIconError(''); }}
              onClick={ev => ev.stopPropagation()}
            />
            <button
              type="button"
              onClick={ev => {
                ev.stopPropagation();
                const url = urlIconInput.trim();
                if (!url.startsWith('http')) { setUrlIconError('Must start with http'); return; }
                saveCustomIcon(url);
                handleSelect(url);
                setUrlIconInput('');
              }}
              className={`${btnBase} ${btnPress} shrink-0 rounded-lg ${ac.btnBg} px-2 py-1 text-xs font-black text-white`}
            >Use</button>
          </div>
          {urlIconError && <p className="mt-1 text-[10px] text-red-500">{urlIconError}</p>}
        </div>

        {/* File upload */}
        <div className="border-t border-slate-100 pt-2">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Or upload an image file</p>
          <button
            type="button"
            onClick={ev => { ev.stopPropagation(); fileInputRef.current?.click(); }}
            className={`${btnBase} ${btnPress} flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ${ac.uploadHover}`}
          >
            📁 Upload PNG / image file
          </button>
        </div>

        {/* Magnific link */}
        <a
          href="https://www.magnific.com/icons/copy-paste"
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-2 flex items-center gap-1 text-xs font-bold ${ac.linkColor}`}
          onClick={onClose}
        >
          🔍 Browse more icons at Magnific →
        </a>
      </div>
    </>
  );
}
