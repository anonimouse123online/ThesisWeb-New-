import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Search, 
  Navigation, 
  Check, 
  X, 
  Loader2, 
  Maximize2, 
  Minimize2, 
  Crosshair, 
  Satellite, 
  Globe, 
  Sparkles,
  Sliders,
  Compass
} from 'lucide-react';
import './LocationPickerModal.css';

export type MapTileMode = 'satellite' | 'streets' | 'light' | 'dark';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | string;
  initialLng?: number | string;
  radiusMeters?: number;
  projectName?: string;
  onConfirm: (lat: number, lng: number, radius?: number) => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// Convert decimal degrees to DMS format (Degrees Minutes Seconds)
function toDMS(val: number, isLat: boolean): string {
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  return `${deg}° ${min}' ${sec}" ${dir}`;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  radiusMeters = 200,
  projectName,
  onConfirm
}) => {
  const defaultLat = 9.882242;
  const defaultLng = 123.599564;

  const parsedLat = typeof initialLat === 'number' 
    ? initialLat 
    : parseFloat(initialLat || '') || defaultLat;
  const parsedLng = typeof initialLng === 'number' 
    ? initialLng 
    : parseFloat(initialLng || '') || defaultLng;

  const [selectedLat, setSelectedLat] = useState<number>(parsedLat);
  const [selectedLng, setSelectedLng] = useState<number>(parsedLng);
  const [activeRadius, setActiveRadius] = useState<number>(radiusMeters);
  const [mapMode, setMapMode] = useState<MapTileMode>('satellite'); // Default to Satellite for construction!
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showReticle, setShowReticle] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [resolvedAddress, setResolvedAddress] = useState<string>('Resolving site location...');
  const [isGettingGPS, setIsGettingGPS] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelTileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const innerCircleRef = useRef<L.Circle | null>(null);
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const initLat = typeof initialLat === 'number' 
        ? initialLat 
        : parseFloat(initialLat || '') || defaultLat;
      const initLng = typeof initialLng === 'number' 
        ? initialLng 
        : parseFloat(initialLng || '') || defaultLng;
      setSelectedLat(initLat);
      setSelectedLng(initLng);
      setActiveRadius(radiusMeters || 200);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, initialLat, initialLng, radiusMeters]);

  // Reverse Geocoding helper (debounced)
  const fetchAddress = useCallback((lat: number, lng: number) => {
    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
    }
    reverseGeocodeTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data && data.display_name) {
          // Truncate cleanly
          const parts = data.display_name.split(', ');
          const shortAddr = parts.slice(0, 4).join(', ');
          setResolvedAddress(shortAddr);
        } else {
          setResolvedAddress('Site coordinates verified');
        }
      } catch {
        setResolvedAddress('Coordinates: ' + lat.toFixed(6) + ', ' + lng.toFixed(6));
      }
    }, 450);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAddress(selectedLat, selectedLng);
    }
  }, [isOpen, selectedLat, selectedLng, fetchAddress]);

  // Helper to switch Leaflet tile layers
  const setTileMode = useCallback((mode: MapTileMode) => {
    setMapMode(mode);
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layers
    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (labelTileLayerRef.current) {
      map.removeLayer(labelTileLayerRef.current);
      labelTileLayerRef.current = null;
    }

    if (mode === 'satellite') {
      // Esri World Imagery (High-res aerial)
      baseTileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics'
        }
      ).addTo(map);

      // Esri World Boundaries and Places reference labels
      labelTileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          opacity: 0.9
        }
      ).addTo(map);
    } else if (mode === 'streets') {
      // Standard OpenStreetMap
      baseTileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      ).addTo(map);
    } else if (mode === 'light') {
      // CartoDB Positron (Architectural clean)
      baseTileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap, &copy; CartoDB'
        }
      ).addTo(map);
    } else if (mode === 'dark') {
      // CartoDB Dark Matter (Command Center)
      baseTileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap, &copy; CartoDB'
        }
      ).addTo(map);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [selectedLat, selectedLng],
        zoom: 17,
        zoomControl: false, // We use custom HUD controls
      });
      mapInstanceRef.current = map;

      // Apply initial tile layer
      setTileMode(mapMode);

      // Custom Surveyor Pin with Radar Ping
      const customPinIcon = L.divIcon({
        className: 'custom-surveyor-pin',
        html: `
          <div class="surveyor-radar-wave"></div>
          <div class="surveyor-pin-body">
            <div class="surveyor-pin-center"></div>
          </div>
          <div class="surveyor-pin-label">SITE CENTER</div>
        `,
        iconSize: [40, 48],
        iconAnchor: [20, 44],
        popupAnchor: [0, -44]
      });

      // Draggable Surveyor Pin
      const marker = L.marker([selectedLat, selectedLng], {
        icon: customPinIcon,
        draggable: true,
        title: 'Drag to adjust project site center coordinates'
      }).addTo(map);
      markerRef.current = marker;

      // Outer Geofence Circle
      const circle = L.circle([selectedLat, selectedLng], {
        radius: activeRadius,
        color: '#f97316',
        weight: 2.5,
        fillColor: '#f97316',
        fillOpacity: 0.18,
        dashArray: '8, 8'
      }).addTo(map);
      circleRef.current = circle;

      // Inner Concentric 50% Safe Boundary
      const innerCircle = L.circle([selectedLat, selectedLng], {
        radius: activeRadius * 0.5,
        color: '#ea580c',
        weight: 1.5,
        fillColor: '#ea580c',
        fillOpacity: 0.08,
        dashArray: '4, 6'
      }).addTo(map);
      innerCircleRef.current = innerCircle;

      // Map Click Event
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setSelectedLat(lat);
        setSelectedLng(lng);
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        innerCircle.setLatLng([lat, lng]);
      });

      // Marker Drag Events
      marker.on('drag', (e: L.LeafletEvent) => {
        const pos = (e.target as L.Marker).getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        circle.setLatLng(pos);
        innerCircle.setLatLng(pos);
      });

      marker.on('dragend', (e: L.LeafletEvent) => {
        const pos = (e.target as L.Marker).getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        circle.setLatLng(pos);
        innerCircle.setLatLng(pos);
      });

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }, 60);

    return () => {
      clearTimeout(timer);
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle radius update in real time
  const handleRadiusChange = (newRadius: number) => {
    setActiveRadius(newRadius);
    if (circleRef.current) {
      circleRef.current.setRadius(newRadius);
    }
    if (innerCircleRef.current) {
      innerCircleRef.current.setRadius(newRadius * 0.5);
    }
  };

  // Update map position smoothly
  const panToCoords = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
    }
    if (innerCircleRef.current) {
      innerCircleRef.current.setLatLng([lat, lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
    }
  };

  // Fullscreen trigger and tile redraw
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
  };

  // Address Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=ph,us`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: SearchResult[] = await res.json();
      if (data && data.length > 0) {
        setSearchResults(data);
        const first = data[0];
        panToCoords(parseFloat(first.lat), parseFloat(first.lon));
      } else {
        setSearchResults([]);
      }
    } catch {
      // Graceful error fallback
    } finally {
      setIsSearching(false);
    }
  };

  // Device GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGettingGPS(false);
        panToCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setIsGettingGPS(false);
        alert(`Location acquisition error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  // Preset Site Jumps
  const handlePresetJump = (lat: number, lng: number) => {
    panToCoords(lat, lng);
  };

  const handleConfirm = () => {
    onConfirm(selectedLat, selectedLng, activeRadius);
    onClose();
  };

  // Calculate geofence coverage area: A = π * r²
  const coverageAreaM2 = Math.round(Math.PI * activeRadius * activeRadius);
  const coverageAreaHectares = (coverageAreaM2 / 10000).toFixed(2);

  if (!isOpen) return null;

  return (
    <div className={`lpm-overlay ${isFullscreen ? 'is-fullscreen' : ''}`} onClick={onClose}>
      <div 
        className={`lpm-modal ${isFullscreen ? 'is-fullscreen' : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header ─────────────────────────────────────────────────── */}
        <div className="lpm-header">
          <div className="lpm-header-left">
            <div className="lpm-header-icon">
              <MapPin size={22} />
            </div>
            <div className="lpm-title-group">
              <div className="lpm-title-row">
                <h3 className="lpm-title">
                  {projectName ? `${projectName} • Site Geofence Boundary` : 'Civil Site Geofencing & Boundary Command'}
                </h3>
                <span className="lpm-live-pill">
                  <span className="lpm-live-dot"></span>
                  Interactive GIS
                </span>
              </div>
              <p className="lpm-subtitle">
                Satellite Imagery • Surveying Reticle • Drag marker or click map to establish project boundary
              </p>
            </div>
          </div>

          <div className="lpm-header-actions">
            <button
              type="button"
              className="lpm-icon-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Restore standard view' : 'Expand full-screen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button 
              type="button" 
              className="lpm-icon-btn" 
              onClick={onClose}
              title="Close map picker"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Search & Preset Bar ────────────────────────────────────────── */}
        <div className="lpm-search-bar">
          <form className="lpm-search-input-wrapper" onSubmit={handleSearch}>
            {isSearching ? (
              <Loader2 size={16} className="lpm-search-icon animate-spin" color="#f15a24" />
            ) : (
              <Search size={16} className="lpm-search-icon" />
            )}
            <input
              type="text"
              className="lpm-search-input"
              placeholder="Search address, landmark, town, or barangay (e.g. Argao, Cebu)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="lpm-search-clear" 
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Quick Preset Location Chips */}
          <div className="lpm-quick-chips">
            <button
              type="button"
              className="lpm-chip"
              onClick={() => panToCoords(selectedLat, selectedLng)}
              title="Center on currently selected pin"
            >
              <Crosshair size={12} color="#f15a24" />
              Pin Center
            </button>
            <button
              type="button"
              className="lpm-chip"
              onClick={handleLocateMe}
              disabled={isGettingGPS}
              title="Acquire current browser GPS coordinates"
            >
              {isGettingGPS ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} color="#0284c7" />}
              My GPS
            </button>
            <button
              type="button"
              className="lpm-chip"
              onClick={() => handlePresetJump(9.882242, 123.599564)}
            >
              📍 Argao Site
            </button>
            <button
              type="button"
              className="lpm-chip"
              onClick={() => handlePresetJump(10.315699, 123.885437)}
            >
              🏙️ Cebu City
            </button>
            <button
              type="button"
              className="lpm-chip"
              onClick={() => handlePresetJump(14.599512, 120.984222)}
            >
              🏛️ Manila
            </button>
          </div>

          {/* Search Dropdown Results */}
          {searchResults.length > 1 && (
            <div className="lpm-dropdown-results">
              {searchResults.map((res) => (
                <div
                  key={res.place_id}
                  className="lpm-dropdown-item"
                  onClick={() => {
                    panToCoords(parseFloat(res.lat), parseFloat(res.lon));
                    setSearchResults([]);
                    setSearchQuery(res.display_name.split(',')[0]);
                  }}
                >
                  <MapPin size={15} color="#f15a24" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.82rem', color: '#0f172a' }}>
                      {res.display_name.split(',')[0]}
                    </strong>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {res.display_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main Map Stage ─────────────────────────────────────────────── */}
        <div className="lpm-map-stage">
          <div ref={mapContainerRef} className="lpm-leaflet-container" />

          {/* Optional Precision Reticle Overlay */}
          {showReticle && (
            <div className="lpm-crosshair-reticle">
              <div className="reticle-h"></div>
              <div className="reticle-v"></div>
              <div className="reticle-ring"></div>
            </div>
          )}

          {/* HUD Layer Switcher (Top-Right) */}
          <div className="lpm-hud-layers">
            <button
              type="button"
              className={`lpm-layer-btn ${mapMode === 'satellite' ? 'active' : ''}`}
              onClick={() => setTileMode('satellite')}
            >
              <Satellite size={13} />
              Satellite
            </button>
            <button
              type="button"
              className={`lpm-layer-btn ${mapMode === 'streets' ? 'active' : ''}`}
              onClick={() => setTileMode('streets')}
            >
              <Globe size={13} />
              Streets
            </button>
            <button
              type="button"
              className={`lpm-layer-btn ${mapMode === 'light' ? 'active' : ''}`}
              onClick={() => setTileMode('light')}
            >
              <Sparkles size={13} />
              Clean Light
            </button>
            <button
              type="button"
              className={`lpm-layer-btn ${mapMode === 'dark' ? 'active' : ''}`}
              onClick={() => setTileMode('dark')}
            >
              <Compass size={13} />
              Dark HUD
            </button>
          </div>

          {/* HUD Map Tools (Right side under layer switch) */}
          <div className="lpm-hud-tools">
            <button
              type="button"
              className="lpm-tool-btn"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              className="lpm-tool-btn"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              title="Zoom Out"
            >
              -
            </button>
            <button
              type="button"
              className={`lpm-tool-btn ${showReticle ? 'active' : ''}`}
              onClick={() => setShowReticle(!showReticle)}
              title="Toggle surveyor precision reticle"
            >
              <Crosshair size={16} />
            </button>
          </div>

          {/* HUD Floating Radius Card (Bottom-Left) */}
          <div className="lpm-hud-radius-card">
            <div className="lpm-hud-radius-header">
              <span className="lpm-hud-radius-title">
                <Sliders size={13} color="#f97316" />
                Geofence Radius
              </span>
              <span className="lpm-hud-radius-val">{activeRadius}m</span>
            </div>

            <input
              type="range"
              min="25"
              max="1000"
              step="25"
              value={activeRadius}
              onChange={(e) => handleRadiusChange(parseInt(e.target.value) || 200)}
              className="lpm-radius-slider"
            />

            <div className="lpm-radius-presets">
              {[50, 100, 200, 300, 500].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`lpm-preset-btn ${activeRadius === r ? 'active' : ''}`}
                  onClick={() => handleRadiusChange(r)}
                >
                  {r}m
                </button>
              ))}
            </div>

            <div className="lpm-area-stats">
              <span>Site Diameter: <strong>{activeRadius * 2}m</strong></span>
              <span>Area: <strong>{coverageAreaHectares} ha</strong> ({coverageAreaM2.toLocaleString()} m²)</span>
            </div>
          </div>
        </div>

        {/* ── Bottom HUD & Surveyor Telemetry ────────────────────────────── */}
        <div className="lpm-bottom-bar">
          <div className="lpm-telemetry">
            <div className="lpm-telemetry-box primary">
              <span className="lpm-telemetry-label">Center Latitude</span>
              <span className="lpm-telemetry-val">{selectedLat.toFixed(7)}°</span>
            </div>
            <div className="lpm-telemetry-box primary">
              <span className="lpm-telemetry-label">Center Longitude</span>
              <span className="lpm-telemetry-val">{selectedLng.toFixed(7)}°</span>
            </div>
            <div className="lpm-telemetry-box">
              <span className="lpm-telemetry-label">DMS Notation</span>
              <span className="lpm-telemetry-val">
                {toDMS(selectedLat, true)}, {toDMS(selectedLng, false)}
              </span>
            </div>
            <div className="lpm-telemetry-address" title={resolvedAddress}>
              <MapPin size={13} color="#ea580c" style={{ flexShrink: 0 }} />
              <span>{resolvedAddress}</span>
            </div>
          </div>

          <div className="lpm-footer-buttons">
            <button type="button" className="lpm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="lpm-btn-apply" onClick={handleConfirm}>
              <Check size={16} />
              Apply Geofence Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
