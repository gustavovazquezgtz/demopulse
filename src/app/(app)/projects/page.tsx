import { redirect } from "next/navigation";

// Team and Project are one concept for the user (see Teams / Projects screen)
// — the backend still models them separately, but there is no standalone
// Projects list anymore.
export default function ProjectsPage() {
  redirect("/teams");
}
