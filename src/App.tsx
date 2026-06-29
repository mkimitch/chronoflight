import React, { useEffect, useMemo, useState } from "react";
import { Itinerary } from "./types";
import { travelPresets } from "./data/presets";
import TimelineVisualizer from "./components/TimelineVisualizer";
import ItineraryControls from "./components/ItineraryControls";
import DynamicQAPanel from "./components/DynamicQAPanel";
import UXPortfolio from "./components/UXPortfolio";
import ThemeToggle from "./components/ThemeToggle";
import ItineraryExportMenu from "./components/ItineraryExportMenu";
import { useThemePreference } from "./hooks/useThemePreference";
import { getTimelineHorizon } from "./utils/timelineHorizon";
import { Plane, Compass, MapPin, Clock, FileText, Info } from "lucide-react";

export default function App() {
  // Main app states
  const [currentItinerary, setCurrentItinerary] = useState<Itinerary>(travelPresets[0]);
  const [currentTripHour, setCurrentTripHour] = useState<number>(0);
  const [activeView, setActiveView] = useState<"interactive" | "portfolio">("interactive");
  const { themePreference, resolvedTheme, setThemePreference } = useThemePreference();

  const timelineHorizon = useMemo(() => getTimelineHorizon(currentItinerary), [currentItinerary]);
  const maxTripHour = timelineHorizon.maxTripHour;

  useEffect(() => {
    setCurrentTripHour((tripHour) => Math.min(tripHour, maxTripHour));
  }, [maxTripHour]);

  // Handle Preset Selection
  const handleSelectPreset = (presetId: string) => {
    const selected = travelPresets.find(p => p.id === presetId);
    if (selected) {
      setCurrentItinerary(selected);
      setCurrentTripHour(0); // Reset scrubber on preset change
    }
  };

  // Helper stats
  const origin = currentItinerary.locations[0];
  const destination = currentItinerary.locations[currentItinerary.locations.length - 1];
  const timezoneShift = destination.offset - origin.offset;

  return (
    <div className="app-shell">
      {/* 1. Global Navigation / Header Banner */}
      <header className="app-header">
        <div className="app-header__inner">
          
          {/* Logo & Subtitle */}
          <div className="app-brand">
            <div className="app-brand__mark">
              <Plane className="icon--plane-mark" />
            </div>
            <div>
              <div className="app-brand__row">
                <h1 className="app-brand__title">Chronoflight</h1>
                <span className="app-brand__version">
                  v1.2 Prototype
                </span>
              </div>
              <p className="app-brand__subtitle">Visual timezone & circadian rhythm mapping</p>
            </div>
          </div>

          <div className="app-header__actions">
            <ItineraryExportMenu
              itinerary={currentItinerary}
              currentTripHour={currentTripHour}
              maxTripHour={maxTripHour}
            />
            <ThemeToggle
              value={themePreference}
              resolvedTheme={resolvedTheme}
              onChange={setThemePreference}
            />
          </div>
        </div>
      </header>

      {/* 2. Primary Layout Main Content */}
      <main className="app-main">
        
        {/* INTERACTIVE HUB MODE */}
        {activeView === "interactive" && (
          <div className="app-panel-stack">
            
            {/* Quick Stats Panel */}
            <div className="app-stats-grid">
              <div className="app-stat-card">
                <span className="app-stat-card__label">Active Journey</span>
                <span className="app-stat-card__value app-stat-card__value--truncate">
                  {currentItinerary.name}
                </span>
              </div>
              
              <div className="app-stat-card">
                <span className="app-stat-card__label">Origin Location</span>
                <span className="app-stat-card__value app-stat-card__value--inline">
                  <MapPin className="icon icon--sm icon--muted" />
                  {origin.name} ({origin.code})
                </span>
              </div>

              <div className="app-stat-card">
                <span className="app-stat-card__label">Destination Location</span>
                <span className="app-stat-card__value app-stat-card__value--inline">
                  <MapPin className="icon icon--sm icon--muted" />
                  {destination.name} ({destination.code})
                </span>
              </div>

              <div className="app-stat-card">
                <span className="app-stat-card__label">Total Offset Shift</span>
                <span className="app-stat-card__value app-stat-card__value--inline">
                  <Clock className="icon icon--sm icon--indigo" />
                  {timezoneShift > 0 ? `+${timezoneShift}` : timezoneShift} Hours Shift
                </span>
              </div>
            </div>

            {/* Split Screen Layout */}
            <div className="app-content-grid">
              
              {/* Left Column (Timeline Visualizer & Dynamic QA Panel) */}
              <div className="app-content-primary">
                
                {/* Embedded Information Alert about daylight & sleep */}
                <div className="app-info-alert">
                  <Info className="icon app-info-alert__icon" />
                  <div>
                    <span className="app-info-alert__title">Double-Encoded Information</span>
                    Our timezone grid visualizes daylight levels and suggests physiological rest phases based on target circadian rhythms. Slide the scrubber to experience space-time changes.
                  </div>
                </div>

                {/* The Timeline Canvas Row Grid */}
                <TimelineVisualizer
                  itinerary={currentItinerary}
                  currentTripHour={currentTripHour}
                  onSetTripHour={setCurrentTripHour}
                  maxTripHour={maxTripHour}
                />

                {/* The Dynamic Q&A Panel */}
                <DynamicQAPanel
                  itinerary={currentItinerary}
                  currentTripHour={currentTripHour}
                  maxTripHour={maxTripHour}
                  onSetTripHour={setCurrentTripHour}
                />
              </div>

              {/* Right Column (Itinerary Configs & Controls) */}
              <div className="app-content-aside">
                <ItineraryControls
                  currentItinerary={currentItinerary}
                  onUpdateItinerary={setCurrentItinerary}
                  onSelectPreset={handleSelectPreset}
                />
              </div>

            </div>
          </div>
        )}

        {/* PORTFOLIO / UX CRITIQUE MODE */}
        {activeView === "portfolio" && (
          <UXPortfolio />
        )}

      </main>

      <nav className="app-view-switcher" aria-label="Application views">
        <div className="app-view-tabs app-view-tabs--bottom">
          <button
            id="btn-view-interactive"
            onClick={() => setActiveView("interactive")}
            className={`app-view-button${activeView === "interactive" ? " app-view-button--active" : ""}`}
          >
            <Compass className="icon icon--sm" />
            <span>Interactive HUD</span>
          </button>
          <button
            id="btn-view-portfolio"
            onClick={() => setActiveView("portfolio")}
            className={`app-view-button${activeView === "portfolio" ? " app-view-button--active" : ""}`}
          >
            <FileText className="icon icon--sm" />
            <span>UX Critique & Spec</span>
          </button>
        </div>
      </nav>

      {/* 3. Humble Footer */}
      <footer className="app-footer">
        <div className="app-footer__inner">
          <p className="app-footer__primary">
            Designed to translate abstract temporal structures into intuitive biological cycles.
          </p>
          <p className="app-footer__secondary">
            Chronoflight Timeline Engine. Built for professional travel planning.
          </p>
        </div>
      </footer>
    </div>
  );
}
