import { createContext, useContext, RefObject } from 'react'
import type Lenis from '@studio-freight/lenis'

export const LenisContext = createContext<RefObject<Lenis | null> | null>(null)
export const useLenisContext = () => useContext(LenisContext)
