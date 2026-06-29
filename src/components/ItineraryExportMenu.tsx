import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Download, FileImage, FileText } from "lucide-react";
import type { Itinerary } from "../types";
import type { ItineraryExportFormat } from "../utils/exportItinerary";

interface ItineraryExportMenuProps {
  currentTripHour: number;
  itinerary: Itinerary;
  maxTripHour: number;
}

const exportOptions: Array<{
  description: string;
  format: ItineraryExportFormat;
  icon: typeof FileImage;
  label: string;
}> = [
  {
    description: "Download a high-resolution image for chats or docs.",
    format: "png",
    icon: FileImage,
    label: "PNG image"
  },
  {
    description: "Download a shareable PDF snapshot.",
    format: "pdf",
    icon: FileText,
    label: "PDF"
  }
];

export default function ItineraryExportMenu({
  currentTripHour,
  itinerary,
  maxTripHour
}: ItineraryExportMenuProps) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleExport = async (format: ItineraryExportFormat) => {
    setIsOpen(false);
    setIsExporting(true);
    setMessage(null);

    try {
      const { exportItineraryVisualization } = await import("../utils/exportItinerary");
      await exportItineraryVisualization({
        currentTripHour,
        itinerary,
        maxTripHour
      }, format);
      setMessage(`${format.toUpperCase()} export started.`);
    } catch (error) {
      console.error(error);
      setMessage("Export failed. Try again in a modern browser.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-menu" ref={containerRef}>
      <button
        type="button"
        className="header-action-button"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={isExporting}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Download className="icon icon--sm" />
        <span>{isExporting ? "Exporting" : "Export"}</span>
        <ChevronDown className="icon icon--xs header-action-button__chevron" />
      </button>

      {isOpen && (
        <div className="export-menu__popover" id={menuId} role="menu">
          {exportOptions.map((option) => {
            const OptionIcon = option.icon;

            return (
              <button
                key={option.format}
                type="button"
                className="export-menu__item"
                role="menuitem"
                onClick={() => handleExport(option.format)}
              >
                <OptionIcon className="icon icon--sm icon--indigo" />
                <span>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <span className="export-menu__status" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
