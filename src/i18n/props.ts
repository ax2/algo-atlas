import { t } from "./text";
// Translate presentation strings before React owns the DOM. Identifiers, input
// values, handlers, data attributes and user-authored text remain untouched.
export function localizedProps(type: unknown, input: unknown) {
  if (!input || typeof input !== "object") return input;
  const original = input as Record<string, unknown>;
  if (original.translate === "no") return original;
  const props = { ...original };
  for (const key of [
    "title",
    "alt",
    "placeholder",
    "aria-label",
    "aria-description",
    "aria-valuetext",
  ])
    if (typeof props[key] === "string") props[key] = t(props[key] as string);
  const text = (value: unknown): unknown =>
    typeof value === "string"
      ? t(value)
      : Array.isArray(value)
        ? value.map(text)
        : value;
  if (
    type === "option" &&
    props.value === undefined &&
    typeof props.children === "string"
  )
    props.value = props.children;
  props.children = text(props.children);
  return props;
}
