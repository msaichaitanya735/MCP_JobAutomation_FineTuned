"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JsonViewer({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative rounded-lg border bg-muted/30">
      <Button
        variant="ghost"
        size="sm"
        onClick={copy}
        className="absolute right-2 top-2 h-7 gap-1.5 px-2 text-xs"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "copied" : "copy"}
      </Button>
      <pre className="max-h-[60vh] overflow-auto p-4 font-mono text-[11px] leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
