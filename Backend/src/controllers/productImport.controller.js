import fs from "fs/promises";
import { parse } from "csv-parse/sync";
import { Product } from "../models/product.model.js";
import { cloudinary } from "../config/cloudinary.js";

// ----------------------
// Category mapping: sheet's human-readable names -> schema enum values
// (lookup key is already lower-cased, so this is inherently case-insensitive)
// ----------------------
const CATEGORY_MAP = {
    "cctv cameras": "CCTV",
    "cctv": "CCTV",
    "alarm systems": "Alarms",
    "alarms": "Alarms",
    "access control": "Access Control",
    "intercom systems": "Intercom",
    "intercom": "Intercom",
    "networking equipment": "Networking",
    "networking": "Networking",
    "other": "Other",
};

const MAX_ROWS = Number(process.env.BULK_IMPORT_MAX_ROWS || 500);
const IMPORT_CONCURRENCY = Number(process.env.BULK_IMPORT_CONCURRENCY || 5);

// Accepts common header variants so exports from the Product Data Collection
// sheet work without the user having to rename columns. Matching is
// case-insensitive and whitespace-tolerant (handled in normalizeRow/pickField).
const HEADER_ALIASES = {
    name: ["product name", "name"],
    brand: ["brand / manufacturer", "brand", "manufacturer"],
    category: ["category"],
    subCategory: ["sub-category", "subcategory", "sub category"],
    modelNumber: ["model number", "modelnumber", "model no", "sku"],
    price: ["selling price ₦", "selling price", "price"],
    description: ["short description", "description"],
    keySpecifications: ["key specifications", "keyspecifications", "specs"],
    stock: ["stock quantity", "stock", "quantity"],
    costPrice: ["cost price ₦", "cost price", "costprice"],
    reorderLevel: ["reorder level", "reorderlevel"],
    notesVariants: ["notes / variants", "notes", "variants", "notesvariants"],
    imageUrls: ["image url", "image urls", "images", "imageurls"],
};

// ----------------------
// Helpers
// ----------------------

/** Lower-cases + trims every header key in a parsed CSV row, so column
 *  matching is case-insensitive regardless of how the sheet was exported. */
function normalizeRow(row) {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
        normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : value;
    }
    return normalized;
}

function pickField(normalizedRow, key) {
    for (const alias of HEADER_ALIASES[key]) {
        const value = normalizedRow[alias];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }
    return "";
}

function parseNumber(value) {
    if (value === "" || value === undefined || value === null) return undefined;
    const cleaned = String(value).replace(/[₦,\s]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : undefined;
}

function mapCategory(rawCategory) {
    return CATEGORY_MAP[rawCategory.trim().toLowerCase()] || null;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The key used to detect duplicates, both within the file and against the
 *  database: model number if present (products are usually unique per model),
 *  otherwise the product name. Case-insensitive. */
function dedupKey(normalizedRow) {
    const modelNumber = pickField(normalizedRow, "modelNumber");
    const name = pickField(normalizedRow, "name");
    return (modelNumber || name).toLowerCase();
}

async function findExistingProduct({ modelNumber, name }) {
    if (modelNumber) {
        const byModel = await Product.findOne({ modelNumber: new RegExp(`^${escapeRegex(modelNumber)}$`, "i") });
        if (byModel) return byModel;
    }
    if (name) {
        return Product.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    }
    return null;
}

async function uploadImageUrls(rawImageField) {
    if (!rawImageField) return { urls: [], warnings: [] };

    const urls = rawImageField.split(/[,|]/).map((u) => u.trim()).filter(Boolean);
    const uploaded = [];
    const warnings = [];

    for (const url of urls) {
        try {
            const result = await cloudinary.uploader.upload(url, {
                folder: "safemart/products",
                transformation: [{ width: 1200, height: 1200, crop: "limit" }],
            });
            uploaded.push(result.secure_url);
        } catch (err) {
            warnings.push(`Could not fetch image (${url}): ${err.message || "upload failed"}`);
        }
    }

    return { urls: uploaded, warnings };
}

/** Runs `worker` over `items` with at most `limit` in flight at once,
 *  preserving result order by index — a small hand-rolled worker pool so
 *  rows (and their image uploads) process in parallel instead of one by one. */
async function runWithConcurrency(items, worker, limit) {
    const results = new Array(items.length);
    let cursor = 0;

    async function runNext() {
        while (cursor < items.length) {
            const current = cursor++;
            results[current] = await worker(items[current], current);
        }
    }

    const poolSize = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: poolSize }, runNext));
    return results;
}

async function cleanupTempFile(file) {
    if (!file?.tempFilePath) return;
    try {
        await fs.unlink(file.tempFilePath);
    } catch {}
}

// ----------------------
// Row processing
// ----------------------

async function processRow(meta, { updateExisting }) {
    const { row, rowNumber } = meta;

    if (meta.isDuplicateInFile) {
        return {
            row: rowNumber,
            name: pickField(row, "name") || "(blank)",
            status: "skipped",
            reason: `Duplicate of row ${meta.duplicateOfRow} in this file — only the first occurrence was imported.`,
        };
    }

    const name = pickField(row, "name");
    const brand = pickField(row, "brand");
    const rawCategory = pickField(row, "category");
    const category = rawCategory ? mapCategory(rawCategory) : null;
    const modelNumber = pickField(row, "modelNumber");
    const description = pickField(row, "description");
    const price = parseNumber(pickField(row, "price"));
    const stock = parseNumber(pickField(row, "stock"));
    const imageField = pickField(row, "imageUrls");

    const existing = await findExistingProduct({ modelNumber, name });

    // ---- UPDATE MODE: product already exists and updateExisting is on ----
    if (existing && updateExisting) {
        // Only fields actually present in the row get changed — blank cells
        // leave the existing value untouched, so a partial re-upload is safe.
        if (rawCategory && !category) {
            return { row: rowNumber, name, status: "failed", reason: `Category "${rawCategory}" is not recognized` };
        }
        if (pickField(row, "price") && price === undefined) {
            return { row: rowNumber, name: name || existing.name, status: "failed", reason: "Selling Price must be a number" };
        }
        if (pickField(row, "stock") && stock === undefined) {
            return { row: rowNumber, name: name || existing.name, status: "failed", reason: "Stock Quantity must be a number" };
        }

        const updates = {};
        if (name) updates.name = name;
        if (brand) updates.brand = brand;
        if (modelNumber) updates.modelNumber = modelNumber;
        if (category) updates.category = category;
        const subCategory = pickField(row, "subCategory");
        if (subCategory) updates.subCategory = subCategory;
        if (description) updates.description = description;
        const keySpecifications = pickField(row, "keySpecifications");
        if (keySpecifications) updates.keySpecifications = keySpecifications;
        if (price !== undefined) updates.price = price;
        const costPrice = parseNumber(pickField(row, "costPrice"));
        if (costPrice !== undefined) updates.costPrice = costPrice;
        if (stock !== undefined) updates.stock = stock;
        const reorderLevel = parseNumber(pickField(row, "reorderLevel"));
        if (reorderLevel !== undefined) updates.reorderLevel = reorderLevel;
        const notesVariants = pickField(row, "notesVariants");
        if (notesVariants) updates.notesVariants = notesVariants;

        let imageWarnings = [];
        if (imageField) {
            const { urls, warnings } = await uploadImageUrls(imageField);
            if (urls.length) updates.images = urls; // replaces the image set for this product
            imageWarnings = warnings;
        }

        try {
            Object.assign(existing, updates);
            await existing.save();
            return {
                row: rowNumber,
                name: existing.name,
                status: "updated",
                id: existing._id,
                warnings: imageWarnings.length ? imageWarnings : undefined,
            };
        } catch (err) {
            return { row: rowNumber, name: name || existing.name, status: "failed", reason: err.message || "Update failed" };
        }
    }

    // ---- product already exists but update mode is off ----
    if (existing && !updateExisting) {
        return {
            row: rowNumber,
            name: name || existing.name,
            status: "skipped",
            reason: `A product with this ${modelNumber ? "model number" : "name"} already exists — enable "update existing products" to overwrite it.`,
        };
    }

    // ---- CREATE MODE: no existing match, full validation applies ----
    const rowErrors = [];
    if (!name) rowErrors.push("Product Name is required");
    if (!category) rowErrors.push(rawCategory ? `Category "${rawCategory}" is not recognized` : "Category is required");
    if (!description) rowErrors.push("Short Description is required");
    if (price === undefined) rowErrors.push("Selling Price is required and must be a number");
    if (stock === undefined) rowErrors.push("Stock Quantity is required and must be a number");

    if (rowErrors.length > 0) {
        return { row: rowNumber, name: name || "(blank)", status: "failed", reason: rowErrors.join("; ") };
    }

    const { urls: images, warnings: imageWarnings } = await uploadImageUrls(imageField);

    try {
        const product = await Product.create({
            name,
            description,
            price,
            category,
            brand: brand || undefined,
            modelNumber: modelNumber || undefined,
            subCategory: pickField(row, "subCategory") || undefined,
            keySpecifications: pickField(row, "keySpecifications") || undefined,
            costPrice: parseNumber(pickField(row, "costPrice")),
            reorderLevel: parseNumber(pickField(row, "reorderLevel")),
            notesVariants: pickField(row, "notesVariants") || undefined,
            stock,
            images,
        });

        return {
            row: rowNumber,
            name,
            status: "success",
            id: product._id,
            warnings: imageWarnings.length ? imageWarnings : undefined,
        };
    } catch (err) {
        const reason = err.code === 11000 ? "A product with this name already exists" : err.message || "Unknown error";
        return { row: rowNumber, name: name || "(blank)", status: "failed", reason };
    }
}

export { normalizeRow, pickField, parseNumber, mapCategory, dedupKey, runWithConcurrency };

// ----------------------
// ADMIN - BULK IMPORT PRODUCTS FROM CSV
// ----------------------
export const bulkImportProducts = async (req, res) => {
    const file = req.files?.csvFile;
    const updateExisting = String(req.body?.updateExisting).toLowerCase() === "true";

    if (!file) {
        return res.status(400).json({
            success: false,
            message: "No CSV uploaded. Use key name 'csvFile' in form-data (File type).",
        });
    }

    try {
        const raw = await fs.readFile(file.tempFilePath, "utf8");

        let parsedRows;
        try {
            parsedRows = parse(raw, { columns: true, skip_empty_lines: true, trim: true, bom: true });
        } catch (parseErr) {
            return res.status(400).json({ success: false, message: `Could not parse CSV: ${parseErr.message}` });
        }

        if (parsedRows.length === 0) {
            return res.status(400).json({ success: false, message: "CSV contains no data rows" });
        }
        if (parsedRows.length > MAX_ROWS) {
            return res.status(400).json({
                success: false,
                message: `CSV has ${parsedRows.length} rows, which exceeds the ${MAX_ROWS}-row limit per import. Split it into smaller batches.`,
            });
        }

        // Normalize headers (case-insensitive) and drop fully blank rows.
        const rowMeta = [];
        parsedRows.forEach((raw, i) => {
            const row = normalizeRow(raw);
            const isBlank = Object.values(row).every((v) => !String(v || "").trim());
            if (isBlank) return;
            rowMeta.push({ row, rowNumber: i + 2 }); // +1 header, +1 for 1-indexing
        });

        // Pre-pass: flag duplicates within the file itself (by model number,
        // falling back to name) BEFORE any network calls, so duplicate rows
        // never trigger a wasted image upload or DB round trip.
        const seenKeys = new Map();
        for (const meta of rowMeta) {
            const key = dedupKey(meta.row);
            if (!key) continue; // will fail its own validation later
            if (!seenKeys.has(key)) {
                seenKeys.set(key, meta.rowNumber);
            } else {
                meta.isDuplicateInFile = true;
                meta.duplicateOfRow = seenKeys.get(key);
            }
        }

        // Process rows with limited concurrency — image fetch/upload is the
        // slow part, so running several rows in parallel (instead of strictly
        // one at a time) meaningfully speeds up larger imports.
        const results = await runWithConcurrency(
            rowMeta,
            (meta) => processRow(meta, { updateExisting }),
            IMPORT_CONCURRENCY
        );

        const imported = results.filter((r) => r.status === "success").length;
        const updated = results.filter((r) => r.status === "updated").length;
        const skipped = results.filter((r) => r.status === "skipped").length;
        const failed = results.filter((r) => r.status === "failed").length;

        return res.status(200).json({
            success: true,
            message: `Import complete: ${imported} created, ${updated} updated, ${skipped} skipped, ${failed} failed`,
            imported,
            updated,
            skipped,
            failed,
            results,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Bulk import failed" });
    } finally {
        await cleanupTempFile(file);
    }
};
