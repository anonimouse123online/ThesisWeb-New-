import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Navigation, Check, X, Loader2, Info } from 'lucide-react';
import './LocationPickerModal.css';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | string;
  initialLng?: number | string;
  radiusMeters?: number;
  projectName?: string;
  onConfirm: (lat: number, lng: number) => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
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
  // Parse initial coordinates or default to project area (9.882242, 123.599564)
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isGettingGPS, setIsGettingGPS] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Sync selected coordinates whenever modal is opened
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
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, initialLat, initialLng]);

  // Initialize and handle Leaflet map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Wait slightly for modal animation and DOM readiness
    const initTimer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [selectedLat, selectedLng],
        zoom: 16,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // Standard OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Custom SitePulse Pin Icon
      const customPinIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div class="pin-bubble">
            <div class="pin-dot"></div>
          </div>
          <div class="pin-pulse"></div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 40],
        popupAnchor: [0, -40]
      });

      // Draggable Marker
      const marker = L.marker([selectedLat, selectedLng], {
        icon: customPinIcon,
        draggable: true,
        title: 'Drag to adjust project site center'
      }).addTo(map);
      markerRef.current = marker;

      // Geofence Radius Circle
      const circle = L.circle([selectedLat, selectedLng], {
        radius: radiusMeters,
        color: '#f15a24',
        weight: 2,
        fillColor: '#f15a24',
        fillOpacity: 0.16,
        dashArray: '6, 6'
      }).addTo(map);
      circleRef.current = circle;

      // Click on Map Event -> Move Marker & Circle
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setSelectedLat(lat);
        setSelectedLng(lng);
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
      });

      // Drag Marker Events
      marker.on('drag', (e: L.LeafletEvent) => {
        const pos = (e.target as L.Marker).getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        circle.setLatLng(pos);
      });

      marker.on('dragend', (e: L.LeafletEvent) => {
        const pos = (e.target as L.Marker).getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        circle.setLatLng(pos);
      });

      // Invalidate size to ensure complete rendering without grey tiles
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }, 60);

    return () => {
      clearTimeout(initTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Update map pin when coordinates change programmatically
  const updateMapPosition = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
    }
  };

  // Search Address / Landmark via OpenStreetMap Nominatim
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: SearchResult[] = await response.json();
      if (data && data.length > 0) {
        setSearchResults(data);
        // Automatically fly to first result
        const first = data[0];
        const newLat = parseFloat(first.lat);
        const newLng = parseFloat(first.lon);
        updateMapPosition(newLat, newLng);
      } else {
        setSearchResults([]);
      }
    } catch {
      // Graceful fallback if network fails
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    updateMapPosition(newLat, newLng);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
  };

  // Use Browser Current Location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGettingGPS(false);
        const { latitude, longitude } = pos.coords;
        updateMapPosition(latitude, longitude);
      },
      (err) => {
        setIsGettingGPS(false);
        alert(`Could not acquire location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedLat, selectedLng);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="lpm-overlay" onClick={onClose}>
      <div className="lpm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lpm-header">
          <div className="lpm-header-left">
            <div className="lpm-header-icon">
              <MapPin size={22} />
            </div>
            <div>
              <h3 className="lpm-title">
                {projectName ? `Set Location for ${projectName}` : 'Choose Project Site Location'}
              </h3>
              <p className="lpm-subtitle">
                Click anywhere on the map or drag the pin to set the center coordinates for the geofence perimeter.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="lpm-close-btn" 
            onClick={onClose}
            aria-label="Close map picker"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="lpm-toolbar">
          <form className="lpm-search-box" onSubmit={handleSearch}>
            <Search size={16} className="lpm-search-icon" />
            <input
              type="text"
              className="lpm-search-input"
              placeholder="Search place, municipality, barangay, or landmark (e.g. Argao, Cebu)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <button
            type="button"
            className="lpm-search-btn"
            onClick={() => handleSearch()}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>

          <button
            type="button"
            className="lpm-locate-btn"
            onClick={handleLocateMe}
            disabled={isGettingGPS}
            title="Pan to current device GPS position"
          >
            {isGettingGPS ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            My Location
          </button>

          {/* Search Results Dropdown */}
          {searchResults.length > 1 && (
            <div className="lpm-search-results">
              {searchResults.map((res) => (
                <div
                  key={res.place_id}
                  className="lpm-search-item"
                  onClick={() => handleSelectSearchResult(res)}
                >
                  <MapPin size={14} color="#f15a24" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {res.display_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="lpm-map-wrapper">
          <div ref={mapContainerRef} className="lpm-map-canvas" />
          <div className="lpm-map-badge">
            <Info size={14} color="#f15a24" />
            Click anywhere or drag the pin to reposition site center
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="lpm-footer">
          <div className="lpm-coords-info">
            <div className="lpm-coord-pill">
              Latitude: <strong>{selectedLat.toFixed(7)}</strong>
            </div>
            <div className="lpm-coord-pill">
              Longitude: <strong>{selectedLng.toFixed(7)}</strong>
            </div>
            <div className="lpm-radius-pill">
              Perimeter: {radiusMeters}m Geofence
            </div>
          </div>

          <div className="lpm-footer-actions">
            <button type="button" className="lpm-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="lpm-confirm-btn" onClick={handleConfirm}>
              <Check size={16} />
              Set This Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
