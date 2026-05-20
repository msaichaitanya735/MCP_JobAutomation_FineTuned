import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SubmitForm } from "./submit-form";
import { LogoutButton } from "./logout-button";

export const metadata = {
  title: "submit — agentic resume pipeline",
  description: "Run a job description through the live LangGraph pipeline.",
};

export default function SubmitPage() {
  return (
    <>
      <SiteHeader />
      <main className="container py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              submit a JD
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Paste a job description below and the live pipeline will tailor a
              resume, score it against the JD, and hand back the PDF and DOCX.
              Sample runs are at{" "}
              <a
                href="/runs"
                className="underline underline-offset-2 hover:text-foreground"
              >
                /runs
              </a>{" "}
              if you want to see the output before spending an API call.
            </p>
          </div>
          <LogoutButton />
        </header>

        <SubmitForm />
      </main>
      <SiteFooter />
    </>
  );
}
