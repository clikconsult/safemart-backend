import dotenv from "dotenv";
import connectDB from "./config/database.js";
import app from "./app.js";

dotenv.config({
    path: "./.env"
});

let server;

const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down Safemart backend...`);

    if (!server) {
        process.exit(0);
        return;
    }

    server.close((error) => {
        if (error) {
            console.error("Error during server shutdown:", error);
            process.exit(1);
            return;
        }

        console.log("Safemart backend stopped cleanly.");
        process.exit(0);
    });
};

const startServer = async () => {
    try {
        await connectDB();
        app.on ("error", (error) => {
         console.log("error", error);
         throw error;   
        });

        server = app.listen (process.env.PORT || 8000, () => {
            console.log(`Server is running on port ${process.env.PORT || 8000}`);
        })
    } catch (error) {
        console.error("MongoDB Connection Failed!!", error);
        process.exit(1);    
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
