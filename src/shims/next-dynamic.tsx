import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

type Loader = () => Promise<{ default: ComponentType<any> }>;

export default function dynamic(
  loader: Loader,
  opts?: { ssr?: boolean; loading?: ComponentType<any> | (() => ReactNode) },
) {
  const Comp = lazy(loader);
  const Fallback = opts?.loading;
  return function DynamicComp(props: Record<string, unknown>) {
    return (
      <Suspense fallback={Fallback ? <Fallback /> : null}>
        <Comp {...props} />
      </Suspense>
    );
  };
}
