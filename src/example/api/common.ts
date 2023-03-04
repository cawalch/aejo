import {Parameter} from "../../types/open-api-3";

export function buildParams(
  builder: (params: Record<string, unknown>) => Parameter
) {
  return (params: Record<string, unknown>) =>
  Object.entries(params.properties).map(([name, props]) =>
    builder({ name, ...(props as Parameter) })
  )
}
