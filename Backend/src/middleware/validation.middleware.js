import mongoose from "mongoose";

function hasValue(value) {
    return value !== undefined && value !== null && value !== "";
}

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isSafeString(value, { min = 0, max = Infinity } = {}) {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    return trimmed.length >= min && trimmed.length <= max;
}

function isPositiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0;
}

function isBooleanLike(value) {
    return typeof value === "boolean" || value === "true" || value === "false";
}

function isMongoId(value) {
    return mongoose.Types.ObjectId.isValid(String(value));
}

function validate(schema) {
    return (req, res, next) => {
        const errors = [];

        for (const rule of schema) {
            const source = rule.source === "params" ? req.params : rule.source === "query" ? req.query : req.body;
            const value = source?.[rule.field];

            if (rule.required && !hasValue(value)) {
                errors.push(rule.message || `${rule.field} is required`);
                continue;
            }

            if (!hasValue(value)) {
                continue;
            }

            if (rule.validate && !rule.validate(value, req)) {
                errors.push(rule.message || `${rule.field} is invalid`);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors[0],
                errors,
            });
        }

        next();
    };
}

export const validators = {
    requiredString: (field, options = {}) => ({
        source: options.source || "body",
        field,
        required: true,
        validate: (value) => isSafeString(value, options),
        message: options.message || `${field} is required`,
    }),
    optionalString: (field, options = {}) => ({
        source: options.source || "body",
        field,
        validate: (value) => isSafeString(value, options),
        message: options.message || `${field} is invalid`,
    }),
    email: (field = "email", options = {}) => ({
        source: options.source || "body",
        field,
        required: options.required ?? true,
        validate: (value) => isEmail(value),
        message: options.message || "A valid email address is required",
    }),
    mongoId: (field, options = {}) => ({
        source: options.source || "params",
        field,
        required: options.required ?? true,
        validate: (value) => isMongoId(value),
        message: options.message || `${field} must be a valid identifier`,
    }),
    nonNegativeNumber: (field, options = {}) => ({
        source: options.source || "body",
        field,
        required: options.required ?? true,
        validate: (value) => isPositiveNumber(value),
        message: options.message || `${field} must be a valid non-negative number`,
    }),
    enumValue: (field, allowedValues, options = {}) => ({
        source: options.source || "body",
        field,
        required: options.required ?? true,
        validate: (value) => allowedValues.includes(value),
        message: options.message || `${field} is invalid`,
    }),
    booleanLike: (field, options = {}) => ({
        source: options.source || "body",
        field,
        required: options.required ?? false,
        validate: (value) => isBooleanLike(value),
        message: options.message || `${field} must be true or false`,
    }),
    custom: (field, validateFn, options = {}) => ({
        source: options.source || "body",
        field,
        required: options.required ?? false,
        validate: validateFn,
        message: options.message || `${field} is invalid`,
    }),
};

export { validate };
