import { Provider } from '@react-spectrum/s2';
import type { ReactNode } from 'react';
import './workflow.css';
/** Scope adoption to migrated workflows; legacy application screens remain independently usable. */
export function SpectrumSurface({children}:{children:ReactNode}) {
 return <Provider locale="ko-KR" colorScheme="light" background="base" UNSAFE_className="mongle-spectrum">{children}</Provider>;
}
