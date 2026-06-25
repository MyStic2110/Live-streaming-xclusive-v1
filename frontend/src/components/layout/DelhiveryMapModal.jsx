import React, { useState, useEffect, useRef } from "react";
import { X, Search, MapPin, CheckCircle, Navigation, Compass, AlertCircle } from "lucide-react";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Delhivery Bearer token used for loading tiles
const DELHI_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7InNvdXJjZSI6IldFQiIsInVjaWQiOiJlZDJjMWNlMi0xOTlhLTE0Y2YtYzEzYi0wYjI0NjRjM2JiZmYifSwiZXhwIjoxNzgyMzk2Njk0LCJpYXQiOjE3ODIzMTAyOTQsImp0aSI6ImZkY2UwYjJkLWIyZDctNDM5NC1hNzgxLTUzNTE2NTNmZDg5OSJ9.uN13LQf6eDHKGzti9ODqddL3Lq3LEvIaFtAVXuiZiYU";
const API = import.meta.env.VITE_API_URL || "";

const RAW_TOKEN = DELHI_TOKEN.replace("Bearer ", "");

const DelhiveryMapModal = ({ isOpen, onClose }) => {
  const [addressInput, setAddressInput] = useState("chennai Madhavaram Darling showroom");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Geocoding and Standardization State with Swarm HQ defaults
  const [locationData, setLocationData] = useState({ lat: 13.142667, lng: 80.237958 });
  const [standardData, setStandardData] = useState({
    address_components: { building_name: "Swarm HQ Chennai Madhavaram Darling showroom" }
  });

  // References for leaflet
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);

  // Initialize and update geocode / address standardizer
  useEffect(() => {
    if (isOpen) {
      // Immediately render map at default Swarm HQ coordinates
      setTimeout(() => {
        renderMap(13.142667, 80.237958, "Swarm HQ Chennai Madhavaram Darling showroom");
      }, 100);
      
      // Update metadata & corrections in background
      handleSearch("chennai Madhavaram Darling showroom");
    } else {
      // Clean up map when modal closes
      cleanupMap();
      setLocationData({ lat: 13.142667, lng: 80.237958 });
      setStandardData({
        address_components: { building_name: "Swarm HQ Chennai Madhavaram Darling showroom" }
      });
      setError(null);
    }
    return () => cleanupMap();
  }, [isOpen]);

  // Clean up Leaflet map instance
  const cleanupMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    markerInstanceRef.current = null;
  };

  const handleSearch = async (targetAddress) => {
    if (!targetAddress.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Geocode (from Express Backend API Proxy)
      const geocodeRes = await axios.post(`${API}/api/delhivery/geocode`, { address: targetAddress });
      const geocode = geocodeRes.data;

      // 2. Fetch Standardization details
      const standardRes = await axios.post(`${API}/api/delhivery/standardize`, { address: targetAddress });
      const standard = standardRes.data;

      setLocationData(geocode);
      setStandardData(standard);

      // Render or Update Map
      renderMap(geocode.lat, geocode.lng, standard.formatted_address || targetAddress);
    } catch (err) {
      console.error("Geocoding/Standardization failed:", err);
      setError("Failed to resolve location via Delhivery Maps. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderMap = (lat, lng, label) => {
    if (!mapContainerRef.current) return;

    // Pulse animation marker icon
    const customMarkerIcon = L.divIcon({
      html: `
        <div style="background-color: #3b82f6; width: 14px; height: 14px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8); position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background-color: #3b82f6; opacity: 0.35; animation: marker-pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;"></div>
        </div>
      `,
      className: "custom-pulse-marker",
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    if (!mapInstanceRef.current) {
      // Create new map instance
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([lat, lng], 15);

      // Attach standard tile layer with token query parameter (256 size)
      const tileUrl = `https://gateway-maps-pub-int.delhivery.com/raster_tiles/india/256/{z}/{x}/{y}.webp?token=${RAW_TOKEN}`;
      const layer = L.tileLayer(tileUrl, {
        maxZoom: 20,
        minZoom: 0,
        tileSize: 256,
        zoomOffset: 0
      });
      layer.addTo(mapInstanceRef.current);

      // Add Zoom Control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(mapInstanceRef.current);

      // Add Marker
      markerInstanceRef.current = L.marker([lat, lng], { icon: customMarkerIcon }).addTo(mapInstanceRef.current);
      markerInstanceRef.current.bindPopup(`<strong style="font-family: sans-serif; font-size: 13px; color: #1e293b;">${label}</strong>`).openPopup();
    } else {
      // Update existing map
      const map = mapInstanceRef.current;
      map.setView([lat, lng], 15);
      
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([lat, lng]);
        markerInstanceRef.current.getPopup().setContent(`<strong style="font-family: sans-serif; font-size: 13px; color: #1e293b;">${label}</strong>`).openOn(map);
      }
      
      // Invalidate size to handle modal transition sizing bugs
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleSearch(addressInput);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(8px)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <style>{`
        @keyframes marker-pulse-ring {
          0% { transform: scale(0.3); opacity: 0.8; }
          80%, 100% { transform: scale(2.2); opacity: 0; }
        }
        .modal-container {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.12);
          width: 100%;
          max-width: 950px;
          height: 600px;
          display: flex;
          overflow: hidden;
          position: relative;
          font-family: 'Outfit', sans-serif;
          animation: modal-fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes modal-fade-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .address-panel {
          width: 38%;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #e2e8f0;
          background: #f8fafc;
          overflow-y: auto;
        }
        .map-panel {
          width: 62%;
          position: relative;
          height: 100%;
          background: #e2e8f0;
        }
        .search-bar {
          display: flex;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          padding: 4px;
          align-items: center;
          transition: all 0.2s ease;
          margin-bottom: 1.5rem;
        }
        .search-bar:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
        .search-input {
          border: none;
          outline: none;
          font-size: 0.9rem;
          padding: 8px 12px;
          flex-grow: 1;
          color: #0f172a;
          background: transparent;
        }
        .search-btn {
          background: #3b82f6;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          cursor: pointer;
          transition: background 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .search-btn:hover {
          background: #2563eb;
        }
        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s ease;
          z-index: 1010;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        .close-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          transform: rotate(90deg);
        }
        .spinner {
          border: 3px solid #e2e8f0;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media(max-width: 768px) {
          .modal-container {
            flex-direction: column;
            height: auto;
            max-height: 90vh;
          }
          .address-panel {
            width: 100%;
            height: auto;
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
            padding: 1.5rem;
          }
          .map-panel {
            width: 100%;
            height: 300px;
          }
        }
      `}</style>
      
      <div className="modal-container">
        {/* Close Button */}
        <button className="close-btn" onClick={onClose} aria-label="Close Map">
          <X size={18} />
        </button>

        {/* Left Side: Address Details & Geocoder Input */}
        <div className="address-panel">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.5rem" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #3b82f6, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff"
            }}>
              <Compass size={14} />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "900", margin: 0, color: "#0f172a", letterSpacing: "-0.5px" }}>
              Delhivery Location Intelligence
            </h3>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 1.25rem 0", lineHeight: "1.4" }}>
            Search and standardize any location across India. Powered by proprietary Delhivery Naksha LLM mapping engine.
          </p>

          <form onSubmit={onSubmit} className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Enter location / address..."
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="search-btn" disabled={loading}>
              {loading ? <div className="spinner" /> : <Search size={16} />}
            </button>
          </form>

          {/* Loader or Error UI */}
          {loading && !locationData && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, gap: "12px", color: "#64748b" }}>
              <div className="spinner" style={{ width: "40px", height: "40px", borderWidth: "4px" }} />
              <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>Querying Delhivery Maps...</span>
            </div>
          )}

          {error && (
            <div style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#b91c1c",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              marginBottom: "1rem"
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{error}</span>
            </div>
          )}

          {/* Address Details Output Card */}
          {!loading && locationData && standardData && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flexGrow: 1 }}>
              
              {/* Main formatted address */}
              <div style={{
                background: "#ffffff",
                padding: "16px",
                borderRadius: "14px",
                border: "1.5px solid #e2e8f0",
                boxShadow: "0 2px 4px rgba(0,0,0,0.01)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#3b82f6", fontWeight: "700", fontSize: "0.85rem", textTransform: "uppercase", marginBottom: "8px" }}>
                  <MapPin size={14} />
                  <span>Standardized Address</span>
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: "800", color: "#0f172a", lineHeight: "1.4", marginBottom: "8px" }}>
                  {standardData.address_components?.building_name || "Resolved Location"}
                </div>
                <div style={{ fontSize: "0.88rem", color: "#475569", lineHeight: "1.5" }}>
                  {standardData.formatted_address}
                </div>
              </div>

              {/* Coordinates & Accuracy */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", border: "1.5px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>Latitude</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#0f172a" }}>{locationData.lat?.toFixed(6)}</div>
                </div>
                <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", border: "1.5px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>Longitude</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#0f172a" }}>{locationData.lng?.toFixed(6)}</div>
                </div>
              </div>

              {/* Delhivery Engine Corrections Applied */}
              {standardData.corrections && standardData.corrections.length > 0 && (
                <div style={{
                  background: "#f0fdf4",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1.5px solid #bbf7d0"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16a34a", fontWeight: "700", fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "8px" }}>
                    <CheckCircle size={14} />
                    <span>Naksha LLM Corrections</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.8rem", color: "#166534", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {standardData.corrections.map((corr, idx) => (
                      <li key={idx}>{corr}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer of panel */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem", marginTop: "auto", fontSize: "0.75rem", color: "#94a3b8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Map Tile Zoom: 0-20</span>
            <span style={{ fontWeight: "700", color: "#3b82f6" }}>Delhivery Maps API</span>
          </div>

        </div>

        {/* Right Side: Leaflet Map Container */}
        <div className="map-panel">
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
          
          {/* Header watermark */}
          <div style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(4px)",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            fontWeight: "700",
            color: "#0f172a",
            zIndex: 999,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid rgba(226, 232, 240, 0.8)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
          }}>
            <Navigation size={12} color="#3b82f6" style={{ transform: "rotate(45deg)" }} />
            <span>Swarm HQ Chennai Madhavaram Darling showroom</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DelhiveryMapModal;
