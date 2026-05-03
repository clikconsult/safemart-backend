import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

const getFromAddress = () =>
    process.env.GMAIL_USER || process.env.ADMIN_EMAIL || "no-reply@safemart.local";

export const sendAdminContactEmail = async ({ name, email, phone, subject, message }) => {
    await transporter.sendMail({
        from: `"Safemart Contact Form" <${getFromAddress()}>`,
        replyTo: email,
        to: process.env.ADMIN_EMAIL,
        subject: `[Safemart Contact] ${subject}`,
        text: [
            `Name: ${name}`,
            `Email: ${email}`,
            `Phone: ${phone || "Not provided"}`,
            `Subject: ${subject}`,
            "",
            "Message:",
            message,
        ].join("\n"),
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
                <h2>New Safemart Contact Message</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <p>${String(message).replace(/\n/g, "<br />")}</p>
            </div>
        `,
    });
};

export const sendContactAutoReply = async ({ name, email, subject }) => {
    await transporter.sendMail({
        from: `"Safemart" <${getFromAddress()}>`,
        to: email,
        subject: "We received your message",
        text: [
            `Hello ${name},`,
            "",
            `Thanks for contacting Safemart about "${subject}".`,
            "We have received your message and will get back to you shortly.",
            "",
            "Safemart",
        ].join("\n"),
    });
};
