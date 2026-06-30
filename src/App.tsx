import React, { useEffect, useMemo, useState } from "react";
import type { Itinerary } from "./types";
import { travelPresets } from "./data/presets";
import TimelineVisualizer from "./components/TimelineVisualizer";
import ItineraryControls from "./components/ItineraryControls";
import DynamicQAPanel from "./components/DynamicQAPanel";
import UXPortfolio from "./components/UXPortfolio";
import ThemeToggle from "./components/ThemeToggle";
import ItineraryExportMenu from "./components/ItineraryExportMenu";
import { useThemePreference } from "./hooks/useThemePreference";
import { getNetTimezoneShiftHours, getTimelineHorizon } from "./utils/timelineHorizon";
import { formatDurationFromHours } from "./utils/durationFormat";
import { getItineraryIssue, getLocationLabel } from "./utils/itineraryDisplay";
import { Plane, Compass, MapPin, Clock, FileText, Info } from "lucide-react";

export default function App() {
  // Main app states
  const [currentItinerary, setCurrentItinerary] = useState<Itinerary | null>(travelPresets[0] ?? null);
  const [currentTripHour, setCurrentTripHour] = useState<number>(0);
  const [activeView, setActiveView] = useState<"interactive" | "portfolio">("interactive");
  const { themePreference, resolvedTheme, setThemePreference } = useThemePreference();

  const timelineHorizon = useMemo(
    () => currentItinerary ? getTimelineHorizon(currentItinerary) : { lastArrivalTripHour: 0, maxTripHour: 24, postArrivalHours: 0 },
    [currentItinerary]
  );
  const maxTripHour = timelineHorizon.maxTripHour;
  const itineraryIssue = getItineraryIssue(currentItinerary);

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

  const handleSelectDefaultPreset = () => {
    const selected = travelPresets[0];
    if (selected) {
      setCurrentItinerary(selected);
      setCurrentTripHour(0);
    }
  };

  // Helper stats
  const origin = currentItinerary?.locations[0] ?? null;
  const destination = currentItinerary?.locations[currentItinerary.locations.length - 1] ?? null;
  const timezoneShift = currentItinerary ? getNetTimezoneShiftHours(currentItinerary) : 0;
  const timezoneShiftSign = timezoneShift > 0 ? "+" : timezoneShift < 0 ? "-" : "";
  const timezoneShiftLabel = timezoneShiftSign + formatDurationFromHours(Math.abs(timezoneShift));
  const journeyName = currentItinerary?.name?.trim() || "No itinerary selected";

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
            {currentItinerary && (
              <ItineraryExportMenu
                itinerary={currentItinerary}
                currentTripHour={currentTripHour}
                maxTripHour={maxTripHour}
              />
            )}
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
            {!currentItinerary ? (
              <div className="app-empty-state" role="status">
                <h2>No itinerary selected</h2>
                <p>Select a preset to begin, or add itinerary data before opening the timeline.</p>
                {travelPresets.length > 0 && (
                  <button className="header-action-button" onClick={handleSelectDefaultPreset}>
                    <Compass className="icon icon--sm" />
                    <span>Load First Preset</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Quick Stats Panel */}
                <div className="app-stats-grid">
                  <div className="app-stat-card">
                    <span className="app-stat-card__label">Active Journey</span>
                    <span className="app-stat-card__value app-stat-card__value--truncate">
                      {journeyName}
                    </span>
                  </div>

                  <div className="app-stat-card">
                    <span className="app-stat-card__label">Origin Location</span>
                    <span className="app-stat-card__value app-stat-card__value--inline">
                      <MapPin className="icon icon--sm icon--muted" />
                      {getLocationLabel(origin)}
                    </span>
                  </div>

                  <div className="app-stat-card">
                    <span className="app-stat-card__label">Destination Location</span>
                    <span className="app-stat-card__value app-stat-card__value--inline">
                      <MapPin className="icon icon--sm icon--muted" />
                      {destination ? getLocationLabel(destination) : "Destination unavailable"}
                    </span>
                  </div>

                  <div className="app-stat-card">
                    <span className="app-stat-card__label">Total Offset Shift</span>
                    <span className="app-stat-card__value app-stat-card__value--inline">
                      <Clock className="icon icon--sm icon--indigo" />
                      {timezoneShiftLabel} Shift
                    </span>
                  </div>
                </div>

                {itineraryIssue && (
                  <div className="app-info-alert" role="status">
                    <Info className="icon app-info-alert__icon" />
                    <div>
                      <span className="app-info-alert__title">Timeline needs more data</span>
                      {itineraryIssue}
                    </div>
                  </div>
                )}

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
              </>
            )}
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
