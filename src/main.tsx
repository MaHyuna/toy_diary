import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PublicBooking } from './PublicBooking';
import './styles.css';
import './calendar.css';
import './design.css';
import './grooming.css';
import './salon.css';
import './booking.css';
import './booking-ux.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{['booking','prices'].includes(new URLSearchParams(location.search).get('screen')??'')?<PublicBooking/>:<App/>}</React.StrictMode>,
);
