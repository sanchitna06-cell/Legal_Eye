import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CinematicIntro } from "@/components/intro/CinematicIntro";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { getSession } from "@/lib/user-store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // A returning session goes straight to the archive; the cinematic intro
    // plays for visitors who are not yet signed in.
    if (getSession()) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "JURY HASH — Legal Records & Case Intelligence" },
      {
        name: "description",
        content:
          "JURY HASH is a legal records platform for cases, court histories and case intelligence — summaries, issues and timelines drawn from the record.",
      },
      { property: "og:title", content: "JURY HASH — Legal Records & Case Intelligence" },
      {
        property: "og:description",
        content:
          "A premium legal records archive with an intelligence layer over cases, histories and court documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Entry,
});

function Entry() {
  const navigate = useNavigate();
  const [introDone, setIntroDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The intro is a client-side cinematic; skip it during SSR/prerender.
  useEffect(() => setMounted(true), []);

  // SSR cannot read the localStorage session, so a signed-in user who lands
  // here through a server redirect or hard refresh is sent on to the archive
  // once the client is live. beforeLoad covers in-app navigation.
  useEffect(() => {
    if (getSession()) navigate({ to: "/dashboard" });
  }, [navigate]);

  return (
    <>
      <LoginPanel />
      {mounted && !introDone && <CinematicIntro onComplete={() => setIntroDone(true)} />}
    </>
  );
}
