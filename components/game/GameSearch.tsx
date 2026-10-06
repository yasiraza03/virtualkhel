"use client";

import { Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { CLUSTER_BY_ID } from "@/lib/clusters";
import { GAMES } from "@/lib/games";
import { searchGames } from "@/lib/search";
import { actions, useStore } from "@/lib/store";
import type { Game } from "@/types/game";

interface Props {
  /** "filter" drives the galaxy filter as you type; "pick" only reports a chosen game. */
  mode: "filter" | "pick";
  onPick?: (game: Game) => void;
  placeholder?: string;
  excludeIds?: string[];
  autoFocus?: boolean;
  label?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onClose?: () => void;
}

export function GameSearch({ mode, onPick, placeholder = "Search games…", excludeIds, autoFocus, label = "Search games by title", inputRef, onClose }: Props) {
  const storeQuery = useStore((s) => s.query);
  const [local, setLocal] = useState("");
  const query = mode === "filter" ? storeQuery : local;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchGames(GAMES, query, 8).filter((g) => !excludeIds?.includes(g.id)),
    [query, excludeIds],
  );
  const showList = open && query.trim().length > 0;

  const setQuery = (v: string) => {
    if (mode === "filter") actions.setQuery(v);
    else setLocal(v);
    setOpen(true);
    setActive(0);
  };

  const choose = (g: Game) => {
    if (mode === "filter") {
      actions.select(g.id);
      actions.setQuery("");
    } else {
      onPick?.(g);
      setLocal("");
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && showList && results[active]) {
      e.preventDefault();
      choose(results[active]!);
    } else if (e.key === "Escape") {
      if (open) {
        setOpen(false);
        e.stopPropagation();
      } else if (query) setQuery("");
      else onClose?.();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-3)]" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active]!.id}` : undefined}
        className="field"
        placeholder={placeholder}
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {query && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-3)] hover:text-white"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            setOpen(false);
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
      {showList && (
        <ul id={listId} role="listbox" aria-label="Search results" className="listbox">
          {results.length === 0 && <li className="option text-[var(--text-3)]" role="presentation">No games match “{query}”.</li>}
          {results.map((g, i) => (
            <li
              key={g.id}
              id={`${listId}-${g.id}`}
              role="option"
              aria-selected={i === active}
              className="option"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(g)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="pip" style={{ color: CLUSTER_BY_ID[g.genres[0]!].color }} aria-hidden />
                <span className="truncate">{g.title}</span>
              </span>
              <span className="num text-xs text-[var(--text-3)]">{g.year}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
