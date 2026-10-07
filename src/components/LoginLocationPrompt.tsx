import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

export default function LoginLocationPrompt({ onEnable, onSkip }: {
  onEnable: () => void;
  onSkip: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  return (
    <dialog ref={dialog} className="login-location-dialog" aria-labelledby="login-location-title" aria-describedby="login-location-description" onCancel={event => { event.preventDefault(); onSkip(); }}>
      <MapPin size={28} className="login-location-icon" />
      <h2 id="login-location-title">Turn on location for login security</h2>
      <p id="login-location-description">Your credentials are verified. Turn on your device’s location services, then allow SitePulse to access your location in the browser.</p>
      <p>Location is requested once for this login. If access was previously blocked, enable it in your browser’s site permissions.</p>
      <div className="login-location-actions">
        <button type="button" className="login-location-secondary" onClick={onSkip}>Continue without location</button>
        <button type="button" className="btn-submit" onClick={onEnable} autoFocus>Enable Location</button>
      </div>
    </dialog>
  );
}
