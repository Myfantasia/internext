import React, { Suspense, lazy, useState } from 'react';
import { Crosshair, Loader2, MapPin, Info, X } from 'lucide-react';
import { KENYA_COUNTIES, findCounty } from '../../data/kenyaCounties';
import { UserLocation } from '../../types';
import type { LatLng } from './MapPinPicker';

const MapPinPicker = lazy(() => import('./MapPinPicker'));

const NAIROBI: LatLng = { lat: -1.2864, lng: 36.8172 };
// Rough Kenya bounds — the server applies the same check.
const inKenya = (p: LatLng) => p.lat >= -4.9 && p.lat <= 5.2 && p.lng >= 33.8 && p.lng <= 42.1;

interface LocationPickerProps {
  value: UserLocation;
  onChange: (next: UserLocation) => void;
  errors?: Partial<Record<'county' | 'town' | 'addressLine' | 'pin', string>>;
  /** Explains why we ask — shown above the fields. */
  purpose?: string;
  addressLabel?: string;
  requireAddressLine?: boolean;
}

// Structured delivery location: county + town + street, plus an optional exact
// map pin (GPS or tap-to-place). Without a pin, delivery is estimated from the
// county; with one, it is priced from the actual distance.
export const LocationPicker: React.FC<LocationPickerProps> = ({
  value, onChange, errors = {}, purpose, addressLabel = 'Street, building & landmark', requireAddressLine = false
}) => {
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');

  const pin = value.lat != null && value.lng != null ? { lat: Number(value.lat), lng: Number(value.lng) } : null;
  const county = findCounty(value.county);
  const mapCenter = pin || (county ? { lat: county.lat, lng: county.lng } : NAIROBI);

  const set = (patch: Partial<UserLocation>) => onChange({ ...value, ...patch });

  const setPin = (p: LatLng, source: 'gps' | 'map') => {
    if (!inKenya(p)) {
      setGeoMessage('That point is outside Kenya. Please place the pin on your delivery location in Kenya.');
      return;
    }
    setGeoMessage('');
    set({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6, source });
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage('Your browser cannot share location. Place the pin on the map instead.');
      setShowMap(true);
      return;
    }
    setLocating(true);
    setGeoMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setShowMap(true);
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps');
        if (pos.coords.accuracy > 200) {
          setGeoMessage(`Location found, accurate to about ${Math.round(pos.coords.accuracy)} m. Drag the pin to your exact gate or building if needed.`);
        }
      },
      (err) => {
        setLocating(false);
        setShowMap(true);
        setGeoMessage(err.code === err.PERMISSION_DENIED
          ? 'Location permission was declined. You can tap the map to place your pin instead.'
          : 'We could not get your location. Tap the map to place your pin instead.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  return (
    <fieldset className="space-y-4">
      {purpose && (
        <div className="callout callout-info">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{purpose}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="loc-county" className="field-label">County <span className="text-rose-400">*</span></label>
          <select
            id="loc-county"
            value={value.county || ''}
            onChange={(e) => set({ county: e.target.value })}
            className={`field-input ${errors.county ? 'field-input-error' : ''}`}
            aria-invalid={!!errors.county}
            required
          >
            <option value="">Select your county…</option>
            {KENYA_COUNTIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
          </select>
          {errors.county && <p className="field-error" role="alert">{errors.county}</p>}
        </div>

        <div>
          <label htmlFor="loc-town" className="field-label">Town / area <span className="text-rose-400">*</span></label>
          <input
            id="loc-town"
            value={value.town || ''}
            onChange={(e) => set({ town: e.target.value })}
            placeholder="e.g. Kilimani, Westlands, Nyali"
            className={`field-input ${errors.town ? 'field-input-error' : ''}`}
            aria-invalid={!!errors.town}
            autoComplete="address-level2"
            required
          />
          {errors.town && <p className="field-error" role="alert">{errors.town}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="loc-address" className="field-label">{addressLabel}{requireAddressLine && <span className="text-rose-400"> *</span>}</label>
          <input
            id="loc-address"
            value={value.addressLine || ''}
            onChange={(e) => set({ addressLine: e.target.value })}
            placeholder="e.g. Argwings Kodhek Rd, Silverstone Towers, 4th floor"
            className={`field-input ${errors.addressLine ? 'field-input-error' : ''}`}
            aria-invalid={!!errors.addressLine}
            autoComplete="street-address"
            required={requireAddressLine}
          />
          {errors.addressLine && <p className="field-error" role="alert">{errors.addressLine}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              Exact delivery pin <span className="font-normal text-slate-400">(recommended)</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {pin
                ? `Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}${value.source === 'gps' ? ' (from your device)' : ''}.`
                : 'Pinning your gate or building gives the most accurate delivery price. Without it we estimate from your county.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={useMyLocation} disabled={locating} className="btn btn-secondary btn-sm">
              {locating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Crosshair className="w-4 h-4" aria-hidden="true" />}
              {locating ? 'Locating…' : 'Use my location'}
            </button>
            <button type="button" onClick={() => setShowMap((v) => !v)} className="btn btn-ghost btn-sm" aria-expanded={showMap}>
              {showMap ? 'Hide map' : pin ? 'Adjust pin' : 'Pick on map'}
            </button>
            {pin && (
              <button type="button" onClick={() => set({ lat: null, lng: null, source: 'manual' })} className="btn btn-ghost btn-sm" aria-label="Remove map pin">
                <X className="w-4 h-4" aria-hidden="true" /> Clear
              </button>
            )}
          </div>
        </div>

        {geoMessage && <p className="text-xs text-amber-300" role="status">{geoMessage}</p>}
        {errors.pin && <p className="field-error" role="alert">{errors.pin}</p>}

        {showMap && (
          <Suspense fallback={<div className="location-map grid place-items-center text-sm text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
            <MapPinPicker
              value={pin}
              center={mapCenter}
              zoom={pin ? 16 : county ? 12 : 11}
              onChange={(p) => setPin(p, 'map')}
              label="Map: tap or click to place your delivery pin, drag the pin to adjust"
            />
            <p className="text-[11px] text-slate-500">Tap the map to drop the pin, then drag it onto your exact building. Map data © OpenStreetMap contributors.</p>
          </Suspense>
        )}
      </div>
    </fieldset>
  );
};
