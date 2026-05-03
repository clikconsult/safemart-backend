import dotenv from "dotenv";
import connectDB from "./config/database.js";
import app from "./app.js";
dotenv.config({
    path: "./.env"
});

const startServer = async () => {
    try {
        await connectDB();
        app.on ("error", (error) => {
         console.log("error", error);
         throw error;   
        });

        app.listen (process.env.PORT || 8000, () => {
            console.log(`Server is running on port ${process.env.PORT || 8000}`);
        })
    } catch (error) {
        console.error("MongoDB Connection Failed!!", error);
        process.exit(1);    
    }
}

startServer();