import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(
            process.env.MONGODB_URI,
            {
                dbName: "Safemart",
            }
        );

        console.log(`\nMongoDB Connected: ${connectionInstance.connection.host}`);

    } catch (error) {
        console.error("MongoDB Connection failed:", error.message);
        process.exit(1);
    }
};

export default connectDB;
