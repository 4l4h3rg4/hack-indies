"use client";

import { cn } from "@/lib/utils";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap justify-center">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className={cn(
            "text-[11.5px] font-medium px-3 py-1.5 rounded-md border border-border bg-secondary/50",
            "text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5",
            "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
