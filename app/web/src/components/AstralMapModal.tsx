import { useEffect, useMemo, useRef, useState } from "react";
import { AstralMap } from "./AstralMap";
import { getAspectFilterTypes } from "../lib/astralMap";
import type { AspectName, AstralMapModel } from "../lib/types";

interface AstralMapModalLabels {
  close: string;
  downloadPng: string;
  downloadPdf: string;
  downloadDonePng: string;
  downloadDonePdf: string;
  downloadError: string;
  filters: string;
  allAspects: string;
  legendOuterA: string;
  legendInnerB: string;
  legendFlow: string;
  legendTension: string;
  legendIntense: string;
}

interface AstralMapModalProps {
  isOpen: boolean;
  model: AstralMapModel | null;
  title: string;
  onClose: () => void;
  labels: AstralMapModalLabels;
}

const ALL_ASPECT_TYPES = getAspectFilterTypes();

function buildFileName(): string {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  return `stellar-astral-map-${day}`;
}

async function renderSvgToCanvas(svgElement: SVGSVGElement): Promise<HTMLCanvasElement> {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLCanvasElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 1600;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas context unavailable"));
          return;
        }
        context.fillStyle = "#090f1f";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      image.onerror = () => reject(new Error("Image load failed"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportSvgToPng(svgElement: SVGSVGElement): Promise<void> {
  const canvas = await renderSvgToCanvas(svgElement);
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${buildFileName()}.png`;
  link.click();
}

async function exportSvgToPdf(svgElement: SVGSVGElement): Promise<void> {
  const [{ jsPDF }, canvas] = await Promise.all([
    import("jspdf"),
    renderSvgToCanvas(svgElement),
  ]);
  const imageData = canvas.toDataURL("image/png");
  const width = 800;
  const height = 800;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [width, height],
  });
  pdf.addImage(imageData, "PNG", 0, 0, width, height);
  pdf.save(`${buildFileName()}.pdf`);
}

export function AstralMapModal({ isOpen, model, title, onClose, labels }: AstralMapModalProps) {
  const [activeAspectTypes, setActiveAspectTypes] = useState<Set<AspectName>>(
    () => new Set(ALL_ASPECT_TYPES)
  );
  const [downloadMessage, setDownloadMessage] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  const hasAllTypes = useMemo(
    () => ALL_ASPECT_TYPES.every((type) => activeAspectTypes.has(type)),
    [activeAspectTypes]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !model) return null;

  const toggleAspect = (type: AspectName) => {
    setActiveAspectTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const setAllAspects = () => {
    setActiveAspectTypes(new Set(ALL_ASPECT_TYPES));
  };

  const handleDownloadPng = async () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) {
      setDownloadMessage(labels.downloadError);
      return;
    }

    try {
      await exportSvgToPng(svg);
      setDownloadMessage(labels.downloadDonePng);
    } catch {
      setDownloadMessage(labels.downloadError);
    }
  };

  const handleDownloadPdf = async () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) {
      setDownloadMessage(labels.downloadError);
      return;
    }

    try {
      await exportSvgToPdf(svg);
      setDownloadMessage(labels.downloadDonePdf);
    } catch {
      setDownloadMessage(labels.downloadError);
    }
  };

  return (
    <div className="astral-map-modal-backdrop" onMouseDown={onClose}>
      <div
        className="astral-map-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="astral-map-modal__header">
          <h2>{title}</h2>
          <div className="astral-map-modal__actions">
            <button type="button" onClick={handleDownloadPng}>
              {labels.downloadPng}
            </button>
            <button type="button" onClick={handleDownloadPdf}>
              {labels.downloadPdf}
            </button>
            <button type="button" onClick={onClose}>
              {labels.close}
            </button>
          </div>
        </div>

        <div className="astral-map-modal__filters" role="group" aria-label={labels.filters}>
          <button
            type="button"
            onClick={setAllAspects}
            className={hasAllTypes ? "astral-map-filter astral-map-filter--active" : "astral-map-filter"}
          >
            {labels.allAspects}
          </button>
          {ALL_ASPECT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleAspect(type)}
              className={activeAspectTypes.has(type) ? "astral-map-filter astral-map-filter--active" : "astral-map-filter"}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="astral-map-modal__body" ref={containerRef}>
          <AstralMap
            model={model}
            activeAspectTypes={[...activeAspectTypes]}
            showLegend
            legendLabels={{
              outerA: labels.legendOuterA,
              innerB: labels.legendInnerB,
              flow: labels.legendFlow,
              tension: labels.legendTension,
              intense: labels.legendIntense,
            }}
          />
        </div>
        <p className="astral-map-modal__status" aria-live="polite">{downloadMessage}</p>
      </div>
    </div>
  );
}
