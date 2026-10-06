// Feature group "files": the offline phone profile (AC-95), file exchange (AC-96), export my data and the
// robustness tools (AC-98, AC-167). Only `boot()` runs at shell start; every screen is loaded on its own route.
import type { FeatureRoute } from '../registry.ts';
import { boot } from './net.ts';
// These screens are part of the shell chunk on purpose: a phone that goes offline right after its first load must still be
// able to open them, and they are small. Only the database library loads on demand.
import Settings from './Settings.tsx';
import Content from './Content.tsx';
import Cards from './Cards.tsx';
import Diagnostic from './Diagnostic.tsx';
import Mastery from './Mastery.tsx';
import Files from './Files.tsx';
import FireDrill from './FireDrill.tsx';

boot();

export const routes: FeatureRoute[] = [
  { path: '/learn/settings', space: 'learn', label: 'files.nav.settings', order: 2, roles: ['learner'], load: () => Promise.resolve({ default: Settings }) },
  { path: '/learn/phone-day', space: 'learn', label: 'files.nav.day', order: 0, roles: ['learner'], load: () => Promise.resolve({ default: Content }) },
  { path: '/learn/phone-cards', space: 'learn', label: 'files.nav.cards', order: 7, roles: ['learner'], load: () => Promise.resolve({ default: Cards }) },
  { path: '/learn/diagnostic', space: 'learn', label: 'files.nav.diagnostic', order: 3, roles: ['learner'], load: () => Promise.resolve({ default: Diagnostic }) },
  { path: '/learn/mastery', space: 'learn', label: 'files.nav.mastery', order: 8, roles: ['learner'], load: () => Promise.resolve({ default: Mastery }) },
  { path: '/learn/files', space: 'learn', label: 'files.nav.files', order: 40, roles: ['learner'], load: () => Promise.resolve({ default: Files }) },
  { path: '/teach/files', space: 'teach', label: 'files.nav.files', order: 28, roles: ['trainer', 'substitute'], load: () => Promise.resolve({ default: Files }) },
  { path: '/teach/fire-drill', space: 'teach', label: 'files.nav.drill', order: 36, roles: ['trainer'], load: () => Promise.resolve({ default: FireDrill }) },
];
