"use client";

import Home from "./Home";
import NoSSRWrapper from "./NoSSRWrapper";

export default function Page() {
  return (
    <NoSSRWrapper>
      <Home />
    </NoSSRWrapper>
  );
}
