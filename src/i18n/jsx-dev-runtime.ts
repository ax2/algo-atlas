import * as runtime from "react/jsx-dev-runtime";
import { localizedProps } from "./props";
export { Fragment, type JSX } from "react/jsx-dev-runtime";
export const jsxDEV: typeof runtime.jsxDEV = (
  type,
  props,
  key,
  isStatic,
  source,
  self,
) =>
  runtime.jsxDEV(
    type,
    localizedProps(type, props),
    key,
    isStatic,
    source,
    self,
  );
