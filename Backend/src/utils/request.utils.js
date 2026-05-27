export function clampNumber(value, { min = 1, max = 100, fallback = 1 } = {}) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, Math.trunc(number)));
}

export function normalizeString(value, { fallback = "", trim = true } = {}) {
    if (typeof value !== "string") {
        return fallback;
    }

    return trim ? value.trim() : value;
}

export function normalizeOptionalString(value, options = {}) {
    const normalized = normalizeString(value, { fallback: "", ...options });
    return normalized || undefined;
}

export function normalizeBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
    }
    return fallback;
}

export function normalizeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
