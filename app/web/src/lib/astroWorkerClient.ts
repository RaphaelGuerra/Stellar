import type { ChartInput, ChartResult, ChartSettings } from "./types";

export interface AstroWorkerClientError extends Error {
  code?: string;
}

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

type WithoutId<T> = T extends { id: number } ? Omit<T, "id"> : never;
type WorkerTask = WithoutId<WorkerRequest>;

type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { name: string; message: string } };

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./astro.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const deferred = pending.get(response.id);
    if (!deferred) return;
    pending.delete(response.id);
    if (response.ok) {
      deferred.resolve(response.result);
      return;
    }
    const error: AstroWorkerClientError = new Error(response.error.message);
    error.name = response.error.name;
    error.code = response.error.name;
    deferred.reject(error);
  });
  return worker;
}

export function runAstroWorkerTask<T>(payload: WorkerTask): Promise<T> {
  if (typeof Worker === "undefined") {
    return runAstroTaskInline<T>(payload);
  }
  const id = ++requestId;
  const request = { ...(payload as object), id } as WorkerRequest;
  const w = getWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    w.postMessage(request);
  });
}

export function generateChartInWorker(input: ChartInput, settings?: Partial<ChartSettings>): Promise<ChartResult> {
  return runAstroWorkerTask<ChartResult>({ type: "generateChart", input, settings });
}

export function terminateAstroWorker() {
  if (!worker) return;
  worker.terminate();
  worker = null;
  pending.clear();
}

async function runAstroTaskInline<T>(payload: WorkerTask): Promise<T> {
  const engine = await import("./engine");
  switch (payload.type) {
    case "generateChart":
      return (await engine.generateChart(payload.input, payload.settings)) as T;
    case "generateTransits":
      return (await engine.generateTransits(payload.baseChart, payload.range, payload.settings)) as T;
    case "generateSecondaryProgressions":
      return (await engine.generateSecondaryProgressions(payload.baseChart, payload.date, payload.settings)) as T;
    case "generateSolarReturn":
      return (await engine.generateSolarReturn(payload.baseChart, payload.year, payload.settings)) as T;
    case "generateLunarReturn":
      return (await engine.generateLunarReturn(payload.baseChart, payload.month, payload.settings)) as T;
    case "generateAnnualProfections":
      return engine.generateAnnualProfections(
        payload.baseChart,
        payload.date ? new Date(`${payload.date}T12:00:00Z`) : new Date()
      ) as T;
    case "generateSaturnReturnTracker":
      return (await engine.generateSaturnReturnTracker(payload.baseChart, payload.settings)) as T;
    case "generateComposite":
      return (await engine.generateComposite(payload.chartA, payload.chartB, payload.method, payload.settings)) as T;
    case "generateAstrocartography":
      return engine.generateAstrocartography(payload.baseChart, payload.settings) as T;
  }
}
