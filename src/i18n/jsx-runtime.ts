import * as runtime from "react/jsx-runtime";
import { localizedProps } from "./props";
export { Fragment, type JSX } from "react/jsx-runtime";
export const jsx: typeof runtime.jsx = (type, props, key) =>
  runtime.jsx(type, localizedProps(type, props), key);
export const jsxs: typeof runtime.jsxs = (type, props, key) =>
  runtime.jsxs(type, localizedProps(type, props), key);
