"use client";

import AudioCompressor from "./AudioCompressor";
import NoSSRWrapper from "./NoSSRWrapper";

export default function Page() {
  return (
    <NoSSRWrapper>
      <AudioCompressor />
    </NoSSRWrapper>
  );
}
