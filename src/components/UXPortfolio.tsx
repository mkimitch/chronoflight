import React from "react";
import { 
  FileText, 
  Layers, 
  Sparkles, 
  Eye, 
  Smartphone, 
  GitBranch, 
  Lightbulb, 
  Compass,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Accessibility
} from "lucide-react";

export default function UXPortfolio() {
  return (
    <div className="portfolio-card">
      {/* Portfolio Header */}
      <div className="portfolio-header">
        <div className="portfolio-kicker">
          <Compass className="icon icon--md" />
          <span>Product Design Portfolio</span>
        </div>
        <h1 className="portfolio-title">
          Flight Timezone Visualizer: UX Analysis & Strategy
        </h1>
        <p className="portfolio-summary">
          A professional UX case study, critique, and structural guide for transforming a rough paper sketch 
          into an elegant, accessible, high-performance traveler's timeline HUD.
        </p>
      </div>

      {/* Grid of Sections */}
      <div className="portfolio-grid">
        
        {/* Section 1: UX Critique */}
        <div className="portfolio-section">
          <div className="portfolio-section__header">
            <AlertTriangle className="icon icon--md icon--amber" />
            <h2>1. UX Critique of the Original Sketch</h2>
          </div>
          <p className="portfolio-copy">
            The original concept uses a <strong>horizontal grid-aligned timezone spreadsheet layout</strong>. 
            While mathematically logical, it presents several key friction points for travelers:
          </p>
          <ul className="portfolio-list">
            <li>
              <strong>High Cognitive Load:</strong> Spanning three distinct grid rows makes vertical scanning mandatory to compare times. If the eye slips, the traveler misinterprets their local arrival time.
            </li>
            <li>
              <strong>The Flight "Slope" Ambiguity:</strong> The angled blue lines show flight paths, but the <em>slope</em> represents a blend of flight speed and timezone change. To a non-designer, the angle has no immediate visceral meaning, making flight legs look longer or shorter than they feel.
            </li>
            <li>
              <strong>Lack of "Self" Position:</strong> The sketch does not indicate where the traveler is at any given hour. Layovers are implied by the gaps between flights, which are easy to miss.
            </li>
            <li>
              <strong>Monochrome/Limited Color Contrast:</strong> Utilizing simple purple and yellow bands represents day and night, but lacks micro-states (e.g., golden hour, twilight, or target sleep windows) and presents contrast issues for colored text.
            </li>
          </ul>
        </div>

        {/* Section 2: Improved Visual Layout Ideas */}
        <div className="portfolio-section">
          <div className="portfolio-section__header">
            <Layers className="icon icon--md icon--indigo" />
            <h2>2. Improved Visual Layout Ideas</h2>
          </div>
          <p className="portfolio-copy">
            To solve these challenges, we suggest establishing a <strong>Unified Temporal Grid</strong> 
            that integrates multiple layers of meaning:
          </p>
          <ul className="portfolio-list">
            <li>
              <strong>The Vertical "Sync-Column":</strong> Instead of floating hours, align each hour with a clear vertical block. Hovering over or scrubbing any column highlights that exact absolute moment across all cities, flashing their relative local times.
            </li>
            <li>
              <strong>Gradients for Day/Night/Twilight:</strong> Replace flat block colors with soft, blending color fills. Transitioning from warm cream (daylight) to soft amber (twilight) and then royal indigo-lavender (nighttime) makes the environment feel intuitive.
            </li>
            <li>
              <strong>Physical Flight Ribbons:</strong> Render flight segments as overlay bands that bridge the rows. Instead of a simple vector line, draw a rich "flight card" with details (airline, duration, seat, meals) directly embedded over the timeline grid.
            </li>
            <li>
              <strong>Dynamic Biological Sleep Fills:</strong> Overlay a hatch-patterned "Sleep Planner" band over the timeline, advising travelers when to sleep based on circadian rhythm science.
            </li>
          </ul>
        </div>

        {/* Section 3: Interaction Patterns */}
        <div className="portfolio-section">
          <div className="portfolio-section__header">
            <Sliders className="icon icon--md icon--emerald" />
            <h2>3. Core Interaction Patterns</h2>
          </div>
          <p className="portfolio-copy">
            We want this tool to feel active rather than passive. The core interactive loops should include:
          </p>
          <ul className="portfolio-list">
            <li>
              <strong>Scrubbable Playhead (The Scrubber):</strong> A prominent vertical slider represents "Current Trip Hour". Sliding it changes the HUD text dynamically, simulating the traveler’s body moving through space-time.
            </li>
            <li>
              <strong>The "Biological State" Advisor:</strong> As the scrubber moves, a status card flashes: <em>"You should feel like it's 2 PM, but the sun is rising in Athens. Sleep now to bypass 4 hours of jetlag."</em>
            </li>
            <li>
              <strong>Dynamic Flight Path Expansion:</strong> Hovering over a flight path highlights the departures and arrival blocks, collapsing unnecessary rows to avoid sensory overload.
            </li>
            <li>
              <strong>One-Tap Preset Comparisons:</strong> Instantly pivot between "Origin Perspective" (locking the timeline to Minneapolis time) and "Destination Perspective" (locking the grid to Athens time) to align schedules.
            </li>
          </ul>
        </div>

        {/* Section 4: Accessibility (A11y) */}
        <div className="portfolio-section">
          <div className="portfolio-section__header">
            <Accessibility className="icon icon--md icon--rose" />
            <h2>4. Accessibility (A11y) Considerations</h2>
          </div>
          <p className="portfolio-copy">
            Travel planning is stressful, and timelines are notoriously hard for screen readers and color-blind users. We build for safety:
          </p>
          <ul className="portfolio-list">
            <li>
              <strong>Double Encoding:</strong> Never rely on colors alone to communicate day/night. Include explicit labels (e.g. "☀️ Daylight", "🌙 Night", "💤 Suggest Sleep") in every single temporal cell.
            </li>
            <li>
              <strong>High Contrast Ratios (WCAG AA):</strong> Text must have at least 4.5:1 contrast against the yellow, gray, and purple bands. We use deep charcoal text instead of white text on colored backgrounds.
            </li>
            <li>
              <strong>Screen Reader Screenplay:</strong> Standard HTML tables read row-by-row, which breaks chronological timelines. We use custom aria-labels: <em>"Flight AC8102 departs Montreal at 7 PM EDT, arriving Athens at 10 AM EEST. Flight duration is 8 hours."</em>
            </li>
            <li>
              <strong>Keyboard Traversal:</strong> Enable standard Arrow Left/Right to slide the playhead, adjusting the timeline hour-by-hour with screen-reader feedback of local time updates.
            </li>
          </ul>
        </div>

        {/* Section 5: Mobile & Desktop Suggestions */}
        <div className="portfolio-section">
          <div className="portfolio-section__header">
            <Smartphone className="icon icon--md icon--blue" />
            <h2>5. Mobile & Desktop Form Factors</h2>
          </div>
          <p className="portfolio-copy">
            Horizontal timelines shine on desktop, but require refactoring for hand-held mobile screens:
          </p>
          <ul className="portfolio-list">
            <li>
              <strong>Widescreen Desktop HUD:</strong> Take advantage of high horizontal space by pinning the travel routes alongside an extensive itinerary builder sidebar and daylight statistics visualization charts.
            </li>
            <li>
              <strong>Mobile Vertical Chronological Feed:</strong> On small screens, rotate the axis! Display a vertical chronological card deck. Each card represents a key event: <em>"08:00 AM Departure"</em>, <em>"12:00 PM Arrival"</em>, <em>"7 Hour Layover"</em>. Include a swipeable mini-grid on each card.
            </li>
            <li>
              <strong>Responsive Swipable Lanes:</strong> If maintaining horizontal view, lock the left column (city labels) and allow the timeline grid to scroll horizontally with sticky flight connection lines.
            </li>
          </ul>
        </div>

        {/* Section 6: Complicated Itineraries */}
        <div className="portfolio-section">
          <div className="portfolio-section__header">
            <GitBranch className="icon icon--md icon--teal" />
            <h2>6. Managing Complex Itineraries</h2>
          </div>
          <p className="portfolio-copy">
            Real travel is rarely simple. Our UI concept tackles edge-cases systematically:
          </p>
          <ul className="portfolio-list">
            <li>
              <strong>The International Date Line (+1 / -1 Day):</strong> Crossings are visually anchored by vertical "Date Divide Lines" with a crisp indicator. The hour sequence skips forward or backward with a clean tag like "Skipped Monday" or "Repeated Sunday".
            </li>
            <li>
              <strong>Multi-Leg Layover Stack:</strong> For layovers with terminal transfers or multi-day gaps, collapse passive days into a single vertical summary block to save screen space, only expanding them on user tap.
            </li>
            <li>
              <strong>Overlapping flight pathways:</strong> Use dynamic layering. Render different flight legs with distinct colors and curve styles so overlapping lines do not blend together.
            </li>
          </ul>
        </div>
      </div>

      {/* Section 7: Mockup Concepts (Creative Prompts) */}
      <div className="portfolio-concepts">
        <div className="portfolio-concepts-header">
          <Sparkles className="icon icon--lg icon--indigo is-pulsing" />
          <h2>7. High-Fidelity Mockup Concepts</h2>
        </div>
        <p className="portfolio-summary">
          These design prompts are engineered for professional UI design tools (Figma, Sketch) or AI image generators 
          (Midjourney, DALL-E) to produce stunning visual mockups representing this vision:
        </p>

        <div className="portfolio-concepts-grid">
          {/* Concept A */}
          <div className="concept-card concept-card--indigo">
            <span className="concept-label concept-label--indigo">
              Concept A: The Solar Arch Timeline
            </span>
            <p className="concept-copy">
              <strong>Visual Style:</strong> Minimalist, hyper-clean Scandinavian design. High-contrast light interface.
            </p>
            <p className="concept-prompt">
              "UI mockup, mobile screen, travel application. Features an elegant horizontal timezone timeline. 
              The daylight is visualized as a soft golden arch blending smoothly into dark purple night waves. 
              Thin glowing neon blue flight segments curve gracefully between horizontal location lanes. 
              Minimalistic typography using Inter sans-serif, rich micro-copy, 8k resolution, clean interface design."
            </p>
          </div>

          {/* Concept B */}
          <div className="concept-card concept-card--amber">
            <span className="concept-label concept-label--amber">
              Concept B: The Jetlag Copilot HUD
            </span>
            <p className="concept-copy">
              <strong>Visual Style:</strong> Warm, editorial, cozy. Focuses on traveler wellness and natural rhythms.
            </p>
            <p className="concept-prompt">
              "Figma design UI dashboard, desktop screen, wellness flight companion. Cream paper textured background 
              with forest green and soft orange accents. A central interactive timeline shows daylight blocks with 
              glowing yellow circles. Suggests sleep windows with elegant diagonal hatch-lines. High contrast, 
              sophisticated serif typography for headers, clean UI, modern, professional visual representation."
            </p>
          </div>

          {/* Concept C */}
          <div className="concept-card concept-card--purple">
            <span className="concept-label concept-label--purple">
              Concept C: The Chronos Slider HUD
            </span>
            <p className="concept-copy">
              <strong>Visual Style:</strong> Ultra-modern dark mode, high-tech jetlag control station.
            </p>
            <p className="concept-prompt">
              "A futuristic interactive dark mode travel dashboard UI. Royal deep indigo background with glowing cyber 
              teal and violet widgets. A vertical neon orange playhead line slices through horizontal timeline lanes 
              representing NYC, London, and Tokyo. Displays dynamic jetlag charts, solar daylight curves, and 
              intuitive timezone offsets. High-end modern cockpit visual design, sci-fi sleek UI."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
