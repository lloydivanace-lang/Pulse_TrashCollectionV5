import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
  ExternalLink,
  X,
  MapPin,
  Navigation,
  Crosshair,
} from 'lucide-react';
import { WasteReport } from '../types';

interface BarangayMapProps {
  reports: WasteReport[];
  selectedReport: WasteReport | null;
  onSelectReport: (report: WasteReport | null) => void;
  isKagawadView?: boolean;
}

// Cavite City Geolocation Anchors
const CAVITE_CITY_CENTER: [number, number] = [14.4815, 120.902];
const BRGY_40_CENTER: [number, number] = [14.4820, 120.8948];
const BRGY_41_CENTER: [number, number] = [14.4838, 120.8985];
const COMBINED_JURISDICTION_CENTER: [number, number] = [14.4830, 120.8968];

const BRGY_41_POLYGON: [number, number][] = [
  [14.4852, 120.8968],
  [14.4862, 120.8992],
  [14.4835, 120.9015],
  [14.4818, 120.8988],
  [14.4832, 120.8962],
];

const BRGY_40_POLYGON: [number, number][] = [
  [14.4845, 120.8932],
  [14.4852, 120.8968],
  [14.4832, 120.8962],
  [14.4810, 120.8942],
  [14.4818, 120.8924],
];

const CAVITE_LANDMARKS = [
  {
    name: 'Barangay 40 Outpost / Hall',
    category: 'Barangay Hall',
    coords: [14.4822, 120.8945] as [number, number],
    color: '#06b6d4',
    isPrimary: true,
  },
  {
    name: 'Barangay 41 Outpost / Hall',
    category: 'Barangay Hall',
    coords: [14.4838, 120.8985] as [number, number],
    color: '#10b981',
    isPrimary: true,
  },
  {
    name: 'San Roque Parish Church',
    category: 'Historical Church',
    coords: [14.4851, 120.9002] as [number, number],
    color: '#3b82f6',
  },
  {
    name: 'Cavite City Hall & Samonte Park',
    category: 'Government / Park',
    coords: [14.4815, 120.9068] as [number, number],
    color: '#f59e0b',
  },
  {
    name: 'Sangley Point',
    category: 'Air Base & Port',
    coords: [14.4988, 120.9102] as [number, number],
    color: '#6366f1',
  },
  {
    name: 'Cavite City Medical Center',
    category: 'Hospital',
    coords: [14.4788, 120.894] as [number, number],
    color: '#ef4444',
  },
];

type MapTileStyle = 'osm' | 'satellite';

export const BarangayMap: React.FC<BarangayMapProps> = ({
  reports,
  selectedReport,
  onSelectReport,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonLayer41Ref = useRef<L.Polygon | null>(null);
  const polygonLayer40Ref = useRef<L.Polygon | null>(null);
  const landmarksLayerRef = useRef<L.LayerGroup | null>(null);

  const [currentTileStyle, setCurrentTileStyle] = useState<MapTileStyle>('osm');
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showBrgyBoundaries, setShowBrgyBoundaries] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(16);

  const selectedReportRef = useRef(selectedReport);
  selectedReportRef.current = selectedReport;
  const onSelectReportRef = useRef(onSelectReport);
  onSelectReportRef.current = onSelectReport;

  const createTileLayer = (style: MapTileStyle) => {
    if (style === 'satellite') {
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri &mdash; World Imagery',
          maxZoom: 19,
          keepBuffer: 6,
          updateWhenZooming: true,
          crossOrigin: true,
        }
      );
    }
    // 100% Free Esri World Street Map (NO API KEY REQUIRED)
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri &mdash; World Street Map',
        maxZoom: 19,
        keepBuffer: 6,
        updateWhenZooming: true,
        crossOrigin: true,
      }
    );
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: COMBINED_JURISDICTION_CENTER,
      zoom: 16,
      minZoom: 12,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;
    tileLayerRef.current = createTileLayer('osm').addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    landmarksLayerRef.current = L.layerGroup().addTo(map);

    // Barangay 41 Polygon (Emerald)
    polygonLayer41Ref.current = L.polygon(BRGY_41_POLYGON, {
      color: '#10b981',
      weight: 3,
      fillColor: '#10b981',
      fillOpacity: 0.15,
      dashArray: '6, 6',
    })
      .bindTooltip('🏛️ BARANGAY 41 JURISDICTION', {
        permanent: false,
        direction: 'center',
        className: 'bg-emerald-900 text-white font-bold text-xs px-2 py-1 rounded shadow-lg border border-emerald-500',
      })
      .addTo(map);

    // Barangay 40 Polygon (Cyan)
    polygonLayer40Ref.current = L.polygon(BRGY_40_POLYGON, {
      color: '#06b6d4',
      weight: 3,
      fillColor: '#06b6d4',
      fillOpacity: 0.15,
      dashArray: '6, 6',
    })
      .bindTooltip('🏛️ BARANGAY 40 JURISDICTION', {
        permanent: false,
        direction: 'center',
        className: 'bg-cyan-900 text-white font-bold text-xs px-2 py-1 rounded shadow-lg border border-cyan-500',
      })
      .addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    map.on('click', () => {
      if (selectedReportRef.current) {
        onSelectReportRef.current(null);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 350);
    setTimeout(() => map.invalidateSize(), 800);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = createTileLayer(currentTileStyle).addTo(map);
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [currentTileStyle]);

  useEffect(() => {
    if (!landmarksLayerRef.current || !mapInstanceRef.current) return;
    landmarksLayerRef.current.clearLayers();
    if (!showLandmarks) return;

    CAVITE_LANDMARKS.forEach((lm) => {
      const landmarkIcon = L.divIcon({
        className: 'custom-landmark-marker',
        html: `
          <div style="display: flex; align-items: center; gap: 4px; transform: translate(-50%, -100%);">
            <div style="
              width: 22px; 
              height: 22px; 
              border-radius: 50%; 
              background: ${lm.color}; 
              border: 2px solid #ffffff; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            ">
              <span style="color: white; font-size: 11px;">📍</span>
            </div>
            <div style="
              background: rgba(15, 23, 42, 0.9); 
              color: #f8fafc; 
              font-size: 10px; 
              font-weight: 700; 
              padding: 2px 6px; 
              border-radius: 6px; 
              white-space: nowrap; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              border: 1px solid rgba(255,255,255,0.2);
            ">
              ${lm.name}
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker(lm.coords, { icon: landmarkIcon });
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #1e293b; padding: 2px;">
          <strong style="color: ${lm.color}; font-size: 13px;">${lm.name}</strong><br/>
          <span style="color: #64748b;">${lm.category} • Cavite City</span>
        </div>
      `);
      landmarksLayerRef.current?.addLayer(marker);
    });
  }, [showLandmarks]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (polygonLayer41Ref.current) {
      if (showBrgyBoundaries) {
        if (!map.hasLayer(polygonLayer41Ref.current)) polygonLayer41Ref.current.addTo(map);
      } else {
        if (map.hasLayer(polygonLayer41Ref.current)) map.removeLayer(polygonLayer41Ref.current);
      }
    }
    if (polygonLayer40Ref.current) {
      if (showBrgyBoundaries) {
        if (!map.hasLayer(polygonLayer40Ref.current)) polygonLayer40Ref.current.addTo(map);
      } else {
        if (map.hasLayer(polygonLayer40Ref.current)) map.removeLayer(polygonLayer40Ref.current);
      }
    }
  }, [showBrgyBoundaries]);

  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();

    reports.forEach((report) => {
      const isSelected = selectedReport?.id === report.id;
      const isOutside =
        report.needsAssistanceOutside ||
        report.isWithinJurisdiction === false ||
        (report.isWithinBrgy41 === false && !report.barangay?.includes('40'));
      const isElderly = report.isElderly;
      const isBrgy40 = report.barangay?.includes('40') || report.purok?.includes('40');

      let pinColor = isBrgy40 ? '#06b6d4' : '#10b981';
      if (isElderly || report.severityLevel === 'EMERGENCY' || report.severityLevel === 'OVERFLOWING') {
        pinColor = '#ef4444';
      } else if (isOutside) {
        pinColor = '#9333ea';
      } else if (report.status === 'RESOLVED') {
        pinColor = '#10b981';
      }

      const shortTicket = report.ticketNumber.replace(/^(PULSE|TRASH|DRAW)-CAV-/, '#');
      const pinHtml = `
        <div class="report-marker-wrapper" style="
          position: relative; 
          transform: translate(-50%, -100%); 
          cursor: pointer;
          transition: transform 0.15s ease-out;
        ">
          <div style="
            position: absolute;
            top: -26px;
            left: 50%;
            transform: translateX(-50%);
            background: #0f172a;
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 9999px;
            white-space: nowrap;
            border: 1.5px solid ${pinColor};
            box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 3px;
          ">
            <span>${shortTicket}</span>
            ${isElderly ? '<span>👵</span>' : ''}
            ${isOutside ? '<span>📍</span>' : ''}
          </div>
          ${
            isSelected
              ? `<div style="
                  position: absolute;
                  bottom: -6px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 32px;
                  height: 32px;
                  border-radius: 50%;
                  background: ${pinColor};
                  opacity: 0.35;
                  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                "></div>`
              : ''
          }
          <svg width="${isSelected ? 36 : 30}" height="${isSelected ? 46 : 38}" viewBox="0 0 32 42" fill="none" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45));">
            <path
              d="M16 0C7.16 0 0 7.16 0 16C0 26.25 14.12 40.68 14.73 41.29C15.42 42 16.58 42 17.27 41.29C17.88 40.68 32 26.25 32 16C32 7.16 24.84 0 16 0Z"
              fill="${pinColor}"
              stroke="#ffffff"
              stroke-width="${isSelected ? 2.5 : 1.5}"
            />
            <circle cx="16" cy="15" r="${isSelected ? 7 : 6}" fill="${isSelected ? '#ffffff' : '#0f172a'}" />
            <circle cx="16" cy="15" r="${isSelected ? 4 : 3}" fill="${isSelected ? pinColor : '#ffffff'}" />
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-report-pin',
        html: pinHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([report.coordinates.lat, report.coordinates.lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (selectedReportRef.current?.id === report.id) {
          onSelectReportRef.current(null);
        } else {
          onSelectReportRef.current(report);
          mapInstanceRef.current?.panTo([report.coordinates.lat, report.coordinates.lng], {
            animate: true,
            duration: 0.5,
          });
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [reports, selectedReport]);

  const handleFocusBrgy40 = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(BRGY_40_CENTER, 17, {
      animate: true,
      duration: 0.8,
    });
  }, []);

  const handleFocusBrgy41 = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(BRGY_41_CENTER, 17, {
      animate: true,
      duration: 0.8,
    });
  }, []);

  const handleFocusBoth = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(COMBINED_JURISDICTION_CENTER, 16, {
      animate: true,
      duration: 0.8,
    });
  }, []);

  const handleFitCaviteCity = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(CAVITE_CITY_CENTER, 14, {
      animate: true,
      duration: 0.8,
    });
  }, []);

  const handleFitAllPins = useCallback(() => {
    if (!mapInstanceRef.current || reports.length === 0) return;
    const latLngs = reports.map((r) => [r.coordinates.lat, r.coordinates.lng] as [number, number]);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 17,
      animate: true,
    });
  }, [reports]);

  return (
    <div className="relative w-full h-[520px] sm:h-[620px] rounded-3xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl flex flex-col select-none">
      {/* Top Map Control Header */}
      <div className="bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight">
                Cavite City GIS Map
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-black">
                BRGY 40
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black">
                BRGY 41
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Interactive Leaflet GIS • Touch / Zoom Ready • {reports.length} Pin{reports.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700">
            <button
              onClick={() => setCurrentTileStyle('osm')}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                currentTileStyle === 'osm'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Kalsada at mga Kalye"
            >
              Street
            </button>
            <button
              onClick={() => setCurrentTileStyle('satellite')}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                currentTileStyle === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Esri Satellite Aerial View"
            >
              Satellite
            </button>
          </div>

          <button
            onClick={handleFocusBoth}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
            title="I-focus ang parehong Brgy 40 at 41"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>40 & 41</span>
          </button>

          <button
            onClick={handleFocusBrgy40}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
          >
            <span>Brgy 40</span>
          </button>

          <button
            onClick={handleFocusBrgy41}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
          >
            <span>Brgy 41</span>
          </button>

          <button
            onClick={handleFitCaviteCity}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lungsod</span>
          </button>

          <button
            onClick={() => setShowBrgyBoundaries((prev) => !prev)}
            className={`px-2 py-1.5 rounded-xl border text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              showBrgyBoundaries
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            Borders
          </button>

          {reports.length > 0 && (
            <button
              onClick={handleFitAllPins}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Pins ({reports.length})</span>
            </button>
          )}

          <button
            onClick={() => setShowLandmarks((prev) => !prev)}
            className={`p-1.5 rounded-xl border text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              showLandmarks
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="relative flex-1 w-full h-full bg-slate-900 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 shadow-xl">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center border border-slate-700 backdrop-blur-sm transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center border border-slate-700 backdrop-blur-sm transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute top-3 left-3 z-20 bg-slate-900/85 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-[9px] font-mono text-slate-400 shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Zoom: {currentZoom}x</span>
          <span className="text-slate-600">|</span>
          <span>Cavite City</span>
        </div>

        {/* Selected Card Popup */}
        {selectedReport && (
          <div className="absolute bottom-3 left-2.5 right-2.5 sm:left-auto sm:right-3 sm:max-w-md z-30 bg-slate-900/95 backdrop-blur-lg p-3.5 sm:p-4 rounded-2xl border border-slate-700 shadow-2xl text-white animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-black text-xs sm:text-sm text-white truncate font-mono">
                  #{selectedReport.ticketNumber}
                </span>
                {selectedReport.needsAssistanceOutside || selectedReport.isWithinJurisdiction === false ? (
                  <span className="px-1.5 py-0.5 rounded-md bg-purple-500/25 text-purple-300 border border-purple-400/40 text-[9px] font-extrabold shrink-0">
                    LABAS NG BRGY 40/41
                  </span>
                ) : (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold shrink-0 border ${
                    selectedReport.barangay?.includes('40')
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  }`}>
                    {selectedReport.barangay || 'Brgy 41'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`https://www.google.com/maps?q=${selectedReport.coordinates.lat},${selectedReport.coordinates.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectReport(null);
                  }}
                  className="p-1 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Isara ang popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1.5">
              <div className="font-bold text-white text-sm">
                {selectedReport.purok}
                {selectedReport.streetAddress && (
                  <span className="text-slate-300 font-medium">
                    {' • '}{selectedReport.streetAddress}
                  </span>
                )}
              </div>
              {selectedReport.realtimeGpsAddress && (
                <div className="text-[11px] text-amber-300 font-medium bg-amber-950/40 border border-amber-900/60 rounded-lg p-1.5">
                  <strong>Tunay na GPS:</strong> {selectedReport.realtimeGpsAddress}
                </div>
              )}
              {selectedReport.extraMessage && (
                <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-1.5">
                  <strong>Mensahe ng Residente:</strong> &quot;{selectedReport.extraMessage}&quot;
                </div>
              )}
              {selectedReport.residentName && (
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    Residente: <strong className="text-slate-200">{selectedReport.residentName}</strong>
                  </span>
                  {selectedReport.isElderly && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-extrabold text-[10px]">
                      Senior Citizen 👵
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>
                Kalubhaan:{' '}
                <strong
                  className={
                    selectedReport.severityLevel === 'EMERGENCY' || selectedReport.severityLevel === 'OVERFLOWING'
                      ? 'text-rose-400 font-black'
                      : selectedReport.severityLevel === 'MODERATE'
                      ? 'text-amber-400 font-bold'
                      : 'text-emerald-400 font-semibold'
                  }
                >
                  {selectedReport.severityLevel}
                </strong>
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {selectedReport.coordinates.lat.toFixed(5)}, {selectedReport.coordinates.lng.toFixed(5)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="bg-slate-950 px-3 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1.5 z-20">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Senior / Urgent</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Pending</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Labas ng Brgy 41</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Na-resolba</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm border border-emerald-400 bg-emerald-500/20" />
            <span>Brgy Boundaries</span>
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Pinch to zoom • Drag to pan • Tap pin to inspect
        </div>
      </div>
    </div>
  );
};
