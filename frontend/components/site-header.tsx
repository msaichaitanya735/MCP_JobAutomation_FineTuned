import Link from "next/link";
import { Github, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "home" },
  { href: "/runs", label: "runs" },
  { href: "/submit", label: "submit" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Workflow className="size-4 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            agentic_resume_pipeline
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Button asChild key={item.href} variant="ghost" size="sm">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          <Button asChild variant="outline" size="sm">
            <a
              href="https://github.com/msaichaitanya735/MCP_JobAutomation_FineTuned"
              target="_blank"
              rel="noreferrer"
              className="gap-1.5"
            >
              <Github className="size-3.5" />
              <span className="font-mono text-xs">github</span>
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
