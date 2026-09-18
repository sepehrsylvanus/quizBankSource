"use client";

// Debounced search box: updates the `q` URL param (server-side filtering)
// without a page reload, resetting pagination. Shows a spinner while the
// server component re-renders.
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";

export default function SearchInput({
  placeholder = "جستجو…",
  param = "q",
  className = "",
}: {
  placeholder?: string;
  param?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const firstRun = useRef(true);

  useEffect(() => {
    // Skip the initial mount so we don't trigger a navigation on first render.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value.trim()) sp.set(param, value.trim());
      else sp.delete(param);
      sp.delete("page"); // reset pagination on new search
      startTransition(() => {
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="input pr-9 pl-9"
        type="search"
        aria-label={placeholder}
      />
      {pending ? (
        <Loader2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-indigo-500" />
      ) : null}
    </div>
  );
}
