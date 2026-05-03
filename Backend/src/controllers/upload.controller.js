import { cloudinary } from "../config/cloudinary.js";
import { User } from "../models/user.model.js";

// ----------------------
// UPLOAD PRODUCT IMAGES (Multiple)
// ----------------------
export const uploadProductImages = async (req, res) => {
    try {
        console.log("Files Keys:", req.files ? Object.keys(req.files) : "NULL");
        console.log("Body Keys:", Object.keys(req.body));
        console.log("req.files:", req.files);

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
            const result = await cloudinary.uploader.upload(image.tempFilePath, {
                folder: "safemart/products",
                transformation: [{ width: 1200, height: 1200, crop: "limit" }],
            });

            uploadedUrls.push(result.secure_url);
            uploadedPublicIds.push(result.public_id);
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
        console.error("Upload error:", error);
        return res.status(500).json({
            success: false,
            message: "Image upload failed",
            error: error.message,
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
        console.error("Delete error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete image",
            error: error.message,
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

        const result = await cloudinary.uploader.upload(
            req.files.avatar.tempFilePath,
            {
                folder: "safemart/avatars",
                transformation: [{ width: 400, height: 400, crop: "fill" }],
            }
        );

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { avatar: result.secure_url },
            { new: true }
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
        console.error("Avatar upload error:", error);
        return res.status(500).json({
            success: false,
            message: "Avatar upload failed",
            error: error.message,
        });
    }
};