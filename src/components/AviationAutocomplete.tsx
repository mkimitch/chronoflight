import React, { useEffect, useId, useRef, useState } from "react";

interface AviationAutocompleteProps<T> {
  emptyMessage: string;
  getOptionId: (option: T) => string;
  getOptionLabel: (option: T) => string;
  helperText?: string;
  label: string;
  minQueryLength?: number;
  onSelect: (option: T) => void;
  placeholder: string;
  renderOption: (option: T) => React.ReactNode;
  search: (query: string, signal: AbortSignal) => Promise<T[]>;
}

const SEARCH_DEBOUNCE_MS = 350;

export default function AviationAutocomplete<T>({
  emptyMessage,
  getOptionId,
  getOptionLabel,
  helperText,
  label,
  minQueryLength = 3,
  onSelect,
  placeholder,
  renderOption,
  search
}: AviationAutocompleteProps<T>) {
  const inputId = useId();
  const listboxId = useId();
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= minQueryLength;
  const isOpen = isFocused && (isLoading || Boolean(error) || results.length > 0 || canSearch);
  const activeOption = activeIndex >= 0 ? results[activeIndex] : undefined;

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      setActiveIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);

      search(trimmedQuery, controller.signal)
        .then((nextResults) => {
          setResults(nextResults);
          setActiveIndex(nextResults.length > 0 ? 0 : -1);
        })
        .catch((nextError) => {
          if (controller.signal.aborted) {
            return;
          }

          setResults([]);
          setActiveIndex(-1);
          setError(nextError instanceof Error ? nextError.message : "Search failed.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canSearch, search, trimmedQuery]);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isFocused]);

  const handleSelect = (option: T) => {
    setQuery(getOptionLabel(option));
    setIsFocused(false);
    setActiveIndex(-1);
    onSelect(option);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsFocused(false);
      setActiveIndex(-1);
      return;
    }

    if (!isOpen || results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
      return;
    }

    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      handleSelect(activeOption);
    }
  };

  return (
    <div className="aviation-combobox" ref={containerRef}>
      <label className="field-label field-label--compact" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-activedescendant={activeOption ? `${listboxId}-${getOptionId(activeOption)}` : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={statusId}
        aria-expanded={isOpen}
        autoComplete="off"
        className="form-input form-input--compact"
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={query}
      />
      {helperText && (
        <p className="aviation-combobox__hint">{helperText}</p>
      )}

      <div className="aviation-combobox__status" id={statusId} role="status" aria-live="polite">
        {isLoading ? "Searching..." : error ?? (canSearch && results.length === 0 ? emptyMessage : "")}
      </div>

      {isOpen && (
        <div className="aviation-combobox__popover">
          {isLoading && (
            <div className="aviation-combobox__state">Searching AirLabs...</div>
          )}
          {!isLoading && error && (
            <div className="aviation-combobox__state aviation-combobox__state--error">{error}</div>
          )}
          {!isLoading && !error && canSearch && results.length === 0 && (
            <div className="aviation-combobox__state">{emptyMessage}</div>
          )}
          {!isLoading && !error && results.length > 0 && (
            <div className="aviation-combobox__list" id={listboxId} role="listbox">
              {results.map((result, index) => {
                const optionId = `${listboxId}-${getOptionId(result)}`;

                return (
                  <button
                    id={optionId}
                    key={getOptionId(result)}
                    type="button"
                    className={`aviation-combobox__option${index === activeIndex ? " aviation-combobox__option--active" : ""}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(result)}
                  >
                    {renderOption(result)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
