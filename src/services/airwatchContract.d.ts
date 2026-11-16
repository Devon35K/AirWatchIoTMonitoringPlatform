export function parseDeviceStatus(value: unknown): unknown;
export function parseSensorHistory(value: unknown): unknown;
export function parseMutationResult(value: unknown): unknown;
export function apiErrorMessage(payload: unknown, status: number): string;
export function normalizeApiError(error: unknown): Error;
