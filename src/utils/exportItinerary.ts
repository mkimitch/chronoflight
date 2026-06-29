import { Itinerary } from "../types";
import { getHourStatusForLocation, isRecommendedSleepHour } from "./timezoneMath";

export type ItineraryExportFormat = "png" | "pdf";

interface ExportItineraryOptions {
  itinerary: Itinerary;
  currentTripHour: number;
  maxTripHour: number;
}

interface SvgSnapshot {
  filenameBase: string;
  height: number;
  markup: string;
  width: number;
}

interface ExportColors {
  amber: string;
  amberSoft: string;
  background: string;
  border: string;
  flightLabelBackground: string;
  flightLabelText: string;
  flightMarkerFill: string;
  flightMarkerIcon: string;
  flightPath: string;
  flightPathShadow: string;
  indigo: string;
  indigoSoft: string;
  mutedText: string;
  night: string;
  orange: string;
  purple: string;
  sleepStripe: string;
  surface: string;
  text: string;
  textStrong: string;
  twilight: string;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PDF_POINTS_PER_PIXEL = 0.75;

const escapeXml = (value: string | number) => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const sanitizeFilePart = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "itinerary";
};

const getCssToken = (
  styles: CSSStyleDeclaration | null,
  tokenName: string,
  fallback: string,
  seen = new Set<string>()
) => {
  if (!styles || seen.has(tokenName)) {
    return fallback;
  }

  seen.add(tokenName);
  const rawValue = styles.getPropertyValue(tokenName).trim();
  if (!rawValue) {
    return fallback;
  }

  const variableMatch = rawValue.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (variableMatch) {
    return getCssToken(styles, variableMatch[1], fallback, seen);
  }

  if (rawValue.includes("(")) {
    return rawValue;
  }

  return `oklch(${rawValue})`;
};

const getExportColors = (): ExportColors => {
  const styles = typeof window === "undefined"
    ? null
    : window.getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => getCssToken(styles, name, fallback);

  return {
    amber: token("--amber-500", "CanvasText"),
    amberSoft: token("--amber-50", "Canvas"),
    background: token("--background", "Canvas"),
    border: token("--slate-100", "ButtonBorder"),
    flightLabelBackground: token("--flight-label-background", "CanvasText"),
    flightLabelText: token("--flight-label-text", "Canvas"),
    flightMarkerFill: token("--flight-marker-fill", "CanvasText"),
    flightMarkerIcon: token("--flight-marker-icon", "Canvas"),
    flightPath: token("--flight-path", "CanvasText"),
    flightPathShadow: token("--flight-path-shadow", "GrayText"),
    indigo: token("--indigo-600", "CanvasText"),
    indigoSoft: token("--indigo-50", "Canvas"),
    mutedText: token("--slate-400", "GrayText"),
    night: token("--purple-50", "Canvas"),
    orange: token("--orange-400", "CanvasText"),
    purple: token("--purple-600", "CanvasText"),
    sleepStripe: token("--indigo-100", "GrayText"),
    surface: token("--surface", "Canvas"),
    text: token("--slate-800", "CanvasText"),
    textStrong: token("--slate-900", "CanvasText"),
    twilight: token("--orange-50", "Canvas")
  };
};

const getCellBackground = (period: "day" | "twilight" | "night", colors: ExportColors) => {
  if (period === "day") {
    return colors.amberSoft;
  }

  if (period === "twilight") {
    return colors.twilight;
  }

  return colors.night;
};

const describeDayOffset = (dayOffset: number) => {
  if (dayOffset === 0) {
    return "";
  }

  return dayOffset > 0 ? `+${dayOffset}D` : `${dayOffset}D`;
};

const buildItinerarySvg = ({
  itinerary,
  currentTripHour,
  maxTripHour
}: ExportItineraryOptions): SvgSnapshot => {
  const colors = getExportColors();
  const locations = itinerary.locations;
  const totalHours = maxTripHour + 1;
  const hourIndexes = Array.from({ length: totalHours }, (_, index) => index);
  const margin = 28;
  const titleHeight = 112;
  const headerHeight = 42;
  const footerHeight = 52;
  const leftLabelWidth = 190;
  const cellWidth = 52;
  const rowHeight = 78;
  const gridLeft = margin + leftLabelWidth;
  const gridTop = margin + titleHeight;
  const rowsTop = gridTop + headerHeight;
  const gridWidth = totalHours * cellWidth;
  const width = margin * 2 + leftLabelWidth + gridWidth;
  const height = rowsTop + locations.length * rowHeight + footerHeight;
  const routeLabel = locations.map((location) => location.code).join(" -> ");
  const filenameBase = `chronoflight-${sanitizeFilePart(itinerary.name)}-${new Date().toISOString().slice(0, 10)}`;

  const locationIndexById = new Map(locations.map((location, index) => [location.id, index]));
  const content: string[] = [
    `<svg xmlns="${SVG_NAMESPACE}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(itinerary.name)} itinerary timeline">`,
    "<defs>",
    `<pattern id="sleepPattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`,
    `<rect width="8" height="8" fill="transparent" />`,
    `<line x1="0" y1="0" x2="0" y2="8" stroke="${colors.sleepStripe}" stroke-width="3" opacity="0.72" />`,
    "</pattern>",
    "</defs>",
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${colors.background}" />`,
    `<rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" rx="18" fill="${colors.surface}" stroke="${colors.border}" />`,
    `<text x="${margin + 24}" y="${margin + 34}" fill="${colors.textStrong}" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="800">${escapeXml(itinerary.name)}</text>`,
    `<text x="${margin + 24}" y="${margin + 60}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600">${escapeXml(routeLabel)} | Timeline H+0 to H+${maxTripHour}</text>`,
    `<text x="${margin + 24}" y="${margin + 84}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="12">${escapeXml(itinerary.description)}</text>`,
    `<rect x="${width - margin - 270}" y="${margin + 23}" width="246" height="54" rx="12" fill="${colors.indigoSoft}" stroke="${colors.border}" />`,
    `<text x="${width - margin - 246}" y="${margin + 47}" fill="${colors.indigo}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="800">Shareable itinerary snapshot</text>`,
    `<text x="${width - margin - 246}" y="${margin + 66}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="11">Generated by Chronoflight</text>`,
    `<rect x="${margin}" y="${gridTop}" width="${leftLabelWidth}" height="${headerHeight}" fill="${colors.background}" stroke="${colors.border}" />`,
    `<text x="${margin + 18}" y="${gridTop + 26}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800">LOCATIONS</text>`
  ];

  hourIndexes.forEach((hour) => {
    const x = gridLeft + hour * cellWidth;
    const isCurrent = hour === currentTripHour;
    content.push(
      `<rect x="${x}" y="${gridTop}" width="${cellWidth}" height="${headerHeight}" fill="${isCurrent ? colors.indigoSoft : colors.surface}" stroke="${colors.border}" />`,
      `<text x="${x + cellWidth / 2}" y="${gridTop + 25}" fill="${isCurrent ? colors.indigo : colors.mutedText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" font-weight="800" text-anchor="middle">${hour === 0 ? "START" : `H+${hour}`}</text>`
    );
  });

  locations.forEach((location, rowIndex) => {
    const y = rowsTop + rowIndex * rowHeight;
    content.push(
      `<rect x="${margin}" y="${y}" width="${leftLabelWidth}" height="${rowHeight}" fill="${colors.background}" stroke="${colors.border}" />`,
      `<text x="${margin + 18}" y="${y + 31}" fill="${colors.textStrong}" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="800">${escapeXml(location.name)}</text>`,
      `<rect x="${margin + 18}" y="${y + 43}" width="44" height="18" rx="4" fill="${colors.border}" />`,
      `<text x="${margin + 40}" y="${y + 56}" fill="${colors.text}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="800" text-anchor="middle">${escapeXml(location.code)}</text>`,
      `<text x="${margin + 70}" y="${y + 56}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700">${escapeXml(location.timezoneLabel)} UTC${location.offset >= 0 ? "+" : ""}${location.offset}</text>`
    );

    hourIndexes.forEach((hour) => {
      const x = gridLeft + hour * cellWidth;
      const hourStatus = getHourStatusForLocation(itinerary, location, hour);
      const sleepSuggested = isRecommendedSleepHour(itinerary, hour);
      const timeParts = hourStatus.formattedTime.split(" ");
      const dayOffsetLabel = describeDayOffset(hourStatus.dayOffset);
      const periodColor = hourStatus.timePeriod === "day"
        ? colors.amber
        : hourStatus.timePeriod === "twilight"
          ? colors.orange
          : colors.purple;

      content.push(
        `<rect x="${x}" y="${y}" width="${cellWidth}" height="${rowHeight}" fill="${getCellBackground(hourStatus.timePeriod, colors)}" opacity="0.52" stroke="${colors.border}" />`
      );

      if (sleepSuggested) {
        content.push(`<rect x="${x}" y="${y}" width="${cellWidth}" height="${rowHeight}" fill="url(#sleepPattern)" opacity="0.72" />`);
      }

      content.push(
        `<circle cx="${x + 11}" cy="${y + 13}" r="4" fill="${periodColor}" />`,
        `<text x="${x + cellWidth / 2}" y="${y + 34}" fill="${colors.textStrong}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="900" text-anchor="middle">${escapeXml(timeParts[0])}</text>`,
        `<text x="${x + cellWidth / 2}" y="${y + 49}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="800" text-anchor="middle">${escapeXml(timeParts[1])}</text>`,
        `<text x="${x + cellWidth / 2}" y="${y + 68}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="700" text-anchor="middle">${escapeXml(hourStatus.dayName.slice(0, 3))}</text>`
      );

      if (dayOffsetLabel) {
        content.push(
          `<rect x="${x + cellWidth - 23}" y="${y + 7}" width="18" height="14" rx="3" fill="${colors.border}" />`,
          `<text x="${x + cellWidth - 14}" y="${y + 18}" fill="${colors.text}" font-family="Inter, system-ui, sans-serif" font-size="8" font-weight="900" text-anchor="middle">${escapeXml(dayOffsetLabel)}</text>`
        );
      }
    });
  });

  itinerary.segments.forEach((segment) => {
    const fromIndex = locationIndexById.get(segment.fromLocationId);
    const toIndex = locationIndexById.get(segment.toLocationId);
    if (fromIndex === undefined || toIndex === undefined) {
      return;
    }

    const depX = gridLeft + segment.departureTripHour * cellWidth + cellWidth / 2;
    const depY = rowsTop + fromIndex * rowHeight + rowHeight / 2;
    const arrX = gridLeft + (segment.departureTripHour + segment.duration) * cellWidth + cellWidth / 2;
    const arrY = rowsTop + toIndex * rowHeight + rowHeight / 2;
    const dx = arrX - depX;
    const cx1 = depX + dx * 0.35;
    const cx2 = depX + dx * 0.65;
    const path = `M ${depX} ${depY} C ${cx1} ${depY}, ${cx2} ${arrY}, ${arrX} ${arrY}`;
    const midX = (depX + arrX) / 2;
    const midY = (depY + arrY) / 2;

    content.push(
      `<path d="${path}" fill="none" stroke="${colors.flightPathShadow}" stroke-width="8" stroke-linecap="round" opacity="0.28" />`,
      `<path d="${path}" fill="none" stroke="${colors.flightPath}" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 5" />`,
      `<circle cx="${midX}" cy="${midY - 4}" r="13" fill="${colors.flightMarkerFill}" />`,
      `<text x="${midX}" y="${midY}" fill="${colors.flightMarkerIcon}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="900" text-anchor="middle">&gt;</text>`,
      `<rect x="${midX - 36}" y="${midY - 32}" width="72" height="20" rx="6" fill="${colors.flightLabelBackground}" />`,
      `<text x="${midX}" y="${midY - 18}" fill="${colors.flightLabelText}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="900" text-anchor="middle">${escapeXml(segment.flightNumber)}</text>`
    );
  });

  content.push(
    `<text x="${margin + 24}" y="${height - margin - 4}" fill="${colors.mutedText}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">Legend: yellow daylight, orange twilight, purple night, hatched recommended sleep.</text>`,
    "</svg>"
  );

  return {
    filenameBase,
    height,
    markup: content.join(""),
    width
  };
};

const createCanvasFromSvg = async (snapshot: SvgSnapshot, scale = 2) => {
  const svgBlob = new Blob([snapshot.markup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to render itinerary export image."));
      img.src = svgUrl;
    });

    const boundedScale = Math.min(scale, Math.max(1, 5000 / snapshot.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(snapshot.width * boundedScale);
    canvas.height = Math.round(snapshot.height * boundedScale);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas rendering is not available in this browser.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Unable to encode itinerary export."));
      }
    }, type, quality);
  });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
};

const concatUint8Arrays = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    combined.set(chunk, offset);
    offset += chunk.length;
  });

  return combined;
};

const createImagePdf = (
  jpegBytes: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  pageSourceWidth: number,
  pageSourceHeight: number
) => {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let byteOffset = 0;
  const pageWidth = Math.max(792, pageSourceWidth * PDF_POINTS_PER_PIXEL);
  const pageHeight = pageWidth * (pageSourceHeight / pageSourceWidth);
  const contentStream = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ`;

  const push = (chunk: Uint8Array) => {
    chunks.push(chunk);
    byteOffset += chunk.length;
  };
  const pushString = (value: string) => push(encoder.encode(value));
  const writeObject = (id: number, body: string | Uint8Array[]) => {
    offsets[id] = byteOffset;
    pushString(`${id} 0 obj\n`);

    if (typeof body === "string") {
      pushString(body);
    } else {
      body.forEach(push);
    }

    pushString("\nendobj\n");
  };

  pushString("%PDF-1.4\n");
  writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  writeObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  writeObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  );
  writeObject(4, [
    encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
    jpegBytes,
    encoder.encode("\nendstream")
  ]);
  writeObject(5, `<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream`);

  const xrefOffset = byteOffset;
  pushString("xref\n0 6\n0000000000 65535 f \n");
  for (let index = 1; index <= 5; index++) {
    pushString(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  pushString(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatUint8Arrays(chunks);
};

export const exportItineraryVisualization = async (
  options: ExportItineraryOptions,
  format: ItineraryExportFormat
) => {
  const snapshot = buildItinerarySvg(options);
  const canvas = await createCanvasFromSvg(snapshot);

  if (format === "png") {
    const pngBlob = await canvasToBlob(canvas, "image/png");
    downloadBlob(pngBlob, `${snapshot.filenameBase}.png`);
    return;
  }

  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBytes = createImagePdf(jpegBytes, canvas.width, canvas.height, snapshot.width, snapshot.height);
  downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${snapshot.filenameBase}.pdf`);
};
