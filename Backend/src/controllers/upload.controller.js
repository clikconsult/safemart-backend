import { cloudinary } from "../config/cloudinary.js";
import { User } from "../models/user.model.js";
import fs from "fs/promises";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);

async function cleanupTempFile(file) {
    if (!file?.tempFilePath) return;
    try {
        await fs.unlink(file.tempFilePath);
    } catch {}
}

function validateImageFile(file) {
    if (!file?.tempFilePath) {
        return "Upload processing failed. Please try again."
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        return "Only JPG, PNG, WEBP, and GIF images are allowed"
    }

    if (file.size > MAX_UPLOAD_SIZE) {
        return "Image exceeds the maximum allowed size"
    }

    return null
}

// ----------------------
// UPLOAD PRODUCT IMAGES (Multiple)
// ----------------------
export const uploadProductImages = async (req, res) => {
    try {
        if (!req.files || !req.files.images) {
            return res.status(400).json({
                success: false,
                message: "No images uploaded. Use key name 'images' in form-data (File type)",
            });
        }

        // Handle both single and multiple files
        let images = req.files.images;
        if (!Array.isArray(images)) {
            images = [images];
        }

        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid images found",
            });
        }

        const uploadedUrls = [];
        const uploadedPublicIds = [];

        for (const image of images) {
            const validationMessage = validateImageFile(image);
            if (validationMessage) {
                await cleanupTempFile(image);
                return res.status(400).json({
                    success: false,
                    message: validationMessage,
                });
            }

            try {
                const result = await cloudinary.uploader.upload(image.tempFilePath, {
                    folder: "safemart/products",
                    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
                });

                uploadedUrls.push(result.secure_url);
                uploadedPublicIds.push(result.public_id);
            } finally {
                await cleanupTempFile(image);
            }
        }

        return res.status(200).json({
            success: true,
            message: `${uploadedUrls.length} image(s) uploaded successfully`,
            data: {
                urls: uploadedUrls,
                publicIds: uploadedPublicIds,   // Useful for later deletion
            },
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Image upload failed",
        });
    }
};

// ----------------------
// DELETE PRODUCT IMAGE
// ----------------------
export const deleteProductImage = async (req, res) => {
    try {
        const { publicId } = req.body;   // Note: use publicId (camelCase) or public_id

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: "publicId is required in the request body",
            });
        }

        await cloudinary.uploader.destroy(publicId);

        return res.status(200).json({
            success: true,
            message: "Image deleted successfully from Cloudinary",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to delete image",
        });
    }
};

// ----------------------
// UPLOAD USER AVATAR
// ----------------------
export const uploadUserAvatar = async (req, res) => {
    try {
        if (!req.files || !req.files.avatar) {
            return res.status(400).json({
                success: false,
                message: "No avatar uploaded. Use key name 'avatar' in form-data",
            });
        }

        const validationMessage = validateImageFile(req.files.avatar);
        if (validationMessage) {
            await cleanupTempFile(req.files.avatar);
            return res.status(400).json({
                success: false,
                message: validationMessage,
            });
        }

        let result;
        try {
            result = await cloudinary.uploader.upload(
                req.files.avatar.tempFilePath,
                {
                    folder: "safemart/avatars",
                    transformation: [{ width: 400, height: 400, crop: "fill" }],
                }
            );
        } finally {
            await cleanupTempFile(req.files.avatar);
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { avatar: result.secure_url },
            { returnDocument: "after" }
        );

        return res.status(200).json({
            success: true,
            message: "Avatar uploaded and updated successfully",
            data: {
                avatar: result.secure_url,
                userId: updatedUser._id,
            },
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Avatar upload failed",
        });
    }
};
