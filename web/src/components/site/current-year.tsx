'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Année courante lue dans le navigateur : la coquille statique ne dépend pas de l'heure. */
export function CurrentYear() {
  const year = useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => null,
  );
  return <>{year}</>;
}
