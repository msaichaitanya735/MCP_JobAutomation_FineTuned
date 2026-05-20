import { Suspense } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "access — agentic resume pipeline" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <LockKeyhole className="size-4" />
            <CardTitle className="text-sm">access</CardTitle>
          </div>
          <CardDescription className="pt-2">
            This page is password-protected to keep API costs bounded.
            Public read-only runs at{" "}
            <Link href="/runs" className="underline underline-offset-2">
              /runs
            </Link>{" "}
            don&apos;t require a password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
