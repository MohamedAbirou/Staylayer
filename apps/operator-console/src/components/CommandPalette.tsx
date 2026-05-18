import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Building2, Globe, FileCode, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchGlobalSearch } from "../api/operator";
import {
  StatusBadge,
  tenantStatusTone,
  siteStatusTone,
  domainStatusTone,
} from "./StatusBadge";

/**
 * Global ⌘K / Ctrl+K command palette. Issues bounded `/operator/search`
 * requests with debouncing, then routes the operator to the chosen
 * resource. The palette is rendered once from `OperatorLayout` so it is
 * available on every authenticated page.
 *
 * Security/visibility: the backend filters categories the caller is not
 * allowed to see, so we can safely render whatever the API returns.
 */
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setTerm("");
      setDebounced("");
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 200);
    return () => window.clearTimeout(id);
  }, [term]);

  const query = useQuery({
    queryKey: ["operator-search", debounced],
    queryFn: () => fetchGlobalSearch(debounced, 8),
    enabled: open && debounced.length >= 2,
    staleTime: 15_000,
  });

  const items = useMemo(() => {
    const data = query.data;
    if (!data) return [] as PaletteItem[];
    const list: PaletteItem[] = [];
    for (const t of data.tenants) {
      list.push({
        kind: "tenant",
        id: `tenant:${t.id}`,
        label: t.name,
        sub: t.slug,
        status: t.status,
        to: `/tenants/${t.id}`,
      });
    }
    for (const s of data.sites) {
      list.push({
        kind: "site",
        id: `site:${s.id}`,
        label: s.name,
        sub: `${s.tenant.name} · ${s.slug}`,
        status: s.status,
        to: `/sites/${s.id}`,
      });
    }
    for (const d of data.domains) {
      list.push({
        kind: "domain",
        id: `domain:${d.id}`,
        label: d.host,
        sub: `${d.site.tenant.name} · ${d.site.name}`,
        status: d.status,
        to: `/sites/${d.site.id}`,
      });
    }
    for (const u of data.users) {
      list.push({
        kind: "user",
        id: `user:${u.id}`,
        label: u.email,
        sub: u.platformRole ?? "Customer user",
        status: u.platformRole ?? "USER",
        to: `/search?q=${encodeURIComponent(u.email)}`,
      });
    }
    return list;
  }, [query.data]);

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
  }, [debounced, items.length]);

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      onClose();
      navigate(item.to);
    },
    [navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = items[activeIdx];
        if (item) handleSelect(item);
      }
    },
    [items, activeIdx, handleSelect],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 pt-24 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tenants, sites, domains, users…"
            className="flex-1 bg-transparent py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {debounced.length < 2 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              Type at least 2 characters to search.
            </p>
          ) : query.isLoading ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              Searching…
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              No matches for “{debounced}”.
            </p>
          ) : (
            <ul role="listbox">
              {items.map((item, idx) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={[
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
                      idx === activeIdx
                        ? "bg-slate-800 text-white"
                        : "text-slate-200 hover:bg-slate-800/60",
                    ].join(" ")}
                  >
                    <PaletteIcon kind={item.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.label}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {item.sub}
                      </p>
                    </div>
                    <StatusBadge
                      status={item.status}
                      tone={
                        item.kind === "tenant"
                          ? tenantStatusTone(item.status)
                          : item.kind === "site"
                            ? siteStatusTone(item.status)
                            : item.kind === "domain"
                              ? domainStatusTone(item.status)
                              : "muted"
                      }
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-800 bg-slate-900/60 px-4 py-2 text-[10px] uppercase tracking-widest text-slate-500">
          Enter to open · ↑ ↓ to navigate · Esc to close
        </div>
      </div>
    </div>
  );
}

type PaletteItem = {
  kind: "tenant" | "site" | "domain" | "user";
  id: string;
  label: string;
  sub: string;
  status: string;
  to: string;
};

function PaletteIcon({ kind }: { kind: PaletteItem["kind"] }) {
  const cls = "h-4 w-4 text-slate-500";
  switch (kind) {
    case "tenant":
      return <Building2 className={cls} />;
    case "site":
      return <FileCode className={cls} />;
    case "domain":
      return <Globe className={cls} />;
    case "user":
    default:
      return <UserRound className={cls} />;
  }
}
