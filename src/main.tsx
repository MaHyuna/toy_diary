import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { OwnerSession } from './OwnerSession';
import { appUrl, normalizeEntry } from './routes';
import './styles.css';
import './calendar.css';
import './design.css';
import './grooming.css';
import './salon.css';
import './booking.css';
import './booking-ux.css';
import './owner-ui.css';
import './care-ui.css';
import './calendar-theme.css';

const CustomerHome = lazy(() => import('./CustomerHome').then(module => ({ default: module.CustomerHome })));
const OwnerApp = lazy(() => import('./App'));
const PublicBooking = lazy(() => import('./PublicBooking').then(module => ({ default: module.PublicBooking })));
const CustomerCare = lazy(() => import('./CustomerCare').then(module => ({ default: module.CustomerCare })));
const screen = normalizeEntry();
const loading = <p role="status">화면을 불러오고 있어요…</p>;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{screen === 'owner'
    ? <OwnerSession customerUrl={appUrl('home')}><Suspense fallback={loading}><OwnerApp /></Suspense></OwnerSession>
    : <Suspense fallback={loading}>{screen === 'home' ? <CustomerHome /> : screen === 'care' ? <CustomerCare /> : <PublicBooking />}</Suspense>}
  </React.StrictMode>,
);
