"use client";

import { cn } from "@/lib/utils";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full border transition-all",
            "bg-card text-muted-foreground hover:text-foreground hover:border-primary/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "active:scale-95"
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
