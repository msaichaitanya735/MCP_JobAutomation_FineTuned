import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-start justify-between gap-4 py-8 md:flex-row md:items-center">
        <p className="font-mono text-xs text-muted-foreground">
          built by{" "}
          <a
            href="https://www.saichaitanyamuthyala.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            sai chaitanya muthyala
          </a>
          {" — "}
          ai engineer / forward-deployed
        </p>
        <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
          <Link href="/runs" className="hover:text-foreground">
            runs
          </Link>
          <Link href="/submit" className="hover:text-foreground">
            submit
          </Link>
          <a
            href="https://github.com/msaichaitanya735/MCP_JobAutomation_FineTuned"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            source
          </a>
        </div>
      </div>
    </footer>
  );
}
