import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  pdfPath?: string | null;
  docxPath?: string | null;
  /** When the path is a relative filename (no scheme), we resolve it under
   *  this URL prefix. For sample runs we serve files from
   *  `/sample-files/<run_id>.pdf`; the backend uses presigned S3 URLs which
   *  are absolute and pass through as-is. */
  fileUrlPrefix?: string;
}

export function RunDownloads({ pdfPath, docxPath, fileUrlPrefix = "/sample-files" }: Props) {
  const pdf = resolveUrl(pdfPath, fileUrlPrefix);
  const docx = resolveUrl(docxPath, fileUrlPrefix);

  if (!pdf && !docx) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        no artifacts available for this run.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pdf ? (
        <Button asChild size="sm" className="gap-1.5">
          <a href={pdf} download>
            <Download className="size-3.5" />
            <FileText className="size-3.5" />
            <span className="font-mono text-xs">PDF</span>
          </a>
        </Button>
      ) : null}
      {docx ? (
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={docx} download>
            <Download className="size-3.5" />
            <FileText className="size-3.5" />
            <span className="font-mono text-xs">DOCX</span>
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function resolveUrl(path: string | null | undefined, prefix: string): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Strip leading slashes / "./", keep just the basename when it's absolute on disk.
  const basename = path.split("/").filter(Boolean).pop();
  if (!basename) return null;
  return `${prefix.replace(/\/$/, "")}/${basename}`;
}
