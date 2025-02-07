"use client";

import TranscriptionApp from "./components/TranscriptionApp";
import NoSSRWrapper from "./NoSSRWrapper";

export default function Page() {
  return (
    <NoSSRWrapper>
      <TranscriptionApp />
    </NoSSRWrapper>
  );
}
