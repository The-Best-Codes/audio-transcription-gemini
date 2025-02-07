"use client";

import TranscriptionApp from "./components/TranscriptionApp";
import NoSSRWrapper from "./NoSSRWrapper";

export default function Page() {
  return (
    <NoSSRWrapper>
      <main className="flex min-h-screen h-full w-full flex-col items-center justify-center">
        <TranscriptionApp />
      </main>
    </NoSSRWrapper>
  );
}
