import { sendAdminContactEmail, sendContactAutoReply } from "../services/email.service.js";

export const submitContactForm = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Name, email, subject and message are required",
            });
        }

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.ADMIN_EMAIL) {
            return res.status(500).json({
                success: false,
                message: "Email service is not configured on the server",
            });
        }

        await sendAdminContactEmail({ name, email, phone, subject, message });
        await sendContactAutoReply({ name, email, subject });

        return res.status(200).json({
            success: true,
            message: "Message sent successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to send message",
        });
    }
};
