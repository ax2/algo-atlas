export type Route = {
  view: "lesson" | "catalog" | "cases" | "learning";
  id: string;
  params: URLSearchParams;
};
export function readRoute(): Route {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [view, id] = path.split("/");
  return {
    view: ["lesson", "catalog", "cases", "learning"].includes(view)
      ? (view as Route["view"])
      : "lesson",
    id: id || "quick",
    params: new URLSearchParams(query),
  };
}
export function navigate(view: Route["view"], id = "", query = "") {
  location.hash = `/${view}${id ? "/" + id : ""}${query ? "?" + query : ""}`;
}
export function makeShare(
  id: string,
  data: string,
  target: number,
  step: number,
) {
  const url = new URL(location.href);
  url.hash = `/lesson/${id}?${new URLSearchParams({ data, target: String(target), step: String(step) })}`;
  return url.href;
}
