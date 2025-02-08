"use client";

import Link from "next/link";
import TranscriptionApp from "./components/TranscriptionApp";
import NoSSRWrapper from "./NoSSRWrapper";

export default function Page() {
  return (
    <NoSSRWrapper>
      <main className="flex min-h-screen h-full w-full flex-col items-center justify-center">
        <TranscriptionApp />
        <div className="fixed bottom-2 left-2 flex flex-col justify-center">
          <span className="text-muted-foreground text-sm">
            AI can make mistakes. Check your transcription carefully.
          </span>
          <span className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()}{" "}
            <Link
              href="https://bestcodes.dev"
              className="text-blue-500 hover:underline"
            >
              BestCodes
            </Link>
          </span>
        </div>
      </main>
    </NoSSRWrapper>
  );
}
