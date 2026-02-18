/// <reference lib="webworker" />
import {
  AmbiguousLocalTimeError,
  NonexistentLocalTimeError,
  generateAnnualProfections,
  generateAstrocartography,
  generateChart,
  generateComposite,
  generateLunarReturn,
  generateSaturnReturnTracker,
  generateSecondaryProgressions,
  generateSolarReturn,
  generateTransits,
} from "./engine";
import type { ChartInput, ChartResult, ChartSettings } from "./types";

type WorkerRequest =
  | { id: number; type: "generateChart"; input: ChartInput; settings?: Partial<ChartSettings> }
  | {
      id: number;
      type: "generateTransits";
      baseChart: ChartResult;
      range: { from: string; to: string };
      settings?: Partial<ChartSettings>;
    }
  | { id: number; type: "generateSecondaryProgressions"; baseChart: ChartResult; date: string; settings?: Partial<ChartSettings> }
  | { id: number; type: "generateSolarReturn"; baseChart: ChartResult; year: number; settings?: Partial<ChartSettings> }
  | { id: number; type: "generateLunarReturn"; baseChart: ChartResult; month: string; settings?: Partial<ChartSettings> }
  | { id: number; type: "generateAnnualProfections"; baseChart: ChartResult; date?: string }
  | { id: number; type: "generateSaturnReturnTracker"; baseChart: ChartResult; settings?: Partial<ChartSettings> }
  | {
      id: number;
      type: "generateComposite";
      chartA: ChartResult;
      chartB: ChartResult;
      method: "midpoint" | "davison";
      settings?: Partial<ChartSettings>;
    }
  | { id: number; type: "generateAstrocartography"; baseChart: ChartResult; settings?: Partial<ChartSettings> };

type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { name: string; message: string } };

function toSerializableError(error: unknown): { name: string; message: string } {
  if (error instanceof AmbiguousLocalTimeError || error instanceof NonexistentLocalTimeError) {
    return { name: error.name, message: error.message };
  }
  if (error instanceof Error) {
    return { name: error.name || "Error", message: error.message };
  }
  return { name: "Error", message: String(error) };
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    let result: unknown;
    switch (request.type) {
      case "generateChart":
        result = await generateChart(request.input, request.settings);
        break;
      case "generateTransits":
        result = await generateTransits(request.baseChart, request.range, request.settings);
        break;
      case "generateSecondaryProgressions":
        result = await generateSecondaryProgressions(request.baseChart, request.date, request.settings);
        break;
      case "generateSolarReturn":
        result = await generateSolarReturn(request.baseChart, request.year, request.settings);
        break;
      case "generateLunarReturn":
        result = await generateLunarReturn(request.baseChart, request.month, request.settings);
        break;
      case "generateAnnualProfections":
        result = generateAnnualProfections(
          request.baseChart,
          request.date ? new Date(`${request.date}T12:00:00Z`) : new Date()
        );
        break;
      case "generateSaturnReturnTracker":
        result = await generateSaturnReturnTracker(request.baseChart, request.settings);
        break;
      case "generateComposite":
        result = await generateComposite(request.chartA, request.chartB, request.method, request.settings);
        break;
      case "generateAstrocartography":
        result = generateAstrocartography(request.baseChart, request.settings);
        break;
      default:
        throw new Error("Unknown worker request type");
    }
    const response: WorkerResponse = { id: request.id, ok: true, result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = { id: request.id, ok: false, error: toSerializableError(error) };
    self.postMessage(response);
  }
});

export {};
