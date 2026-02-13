import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

console.log("Testing MongoDB Connection...");
console.log("URI provided (hidden password):", process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@'));

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ SUCCESS: Connected to MongoDB!");
    
    // Try to write to a test collection
    try {
        const TestParams = new mongoose.Schema({ name: String });
        const TestModel = mongoose.model('TestWrite', TestParams);
        await TestModel.create({ name: 'WriteTest' });
        console.log("✅ SUCCESS: Write permission verified!");
        process.exit(0);
    } catch (e) {
        console.error("❌ ERROR: Write failed. You might have Read-Only permissions.");
        console.error(e);
        process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ ERROR: Connection Failed");
    console.error("Error Name:", err.name);
    console.error("Error Code:", err.code);
    console.error("Error Syscall:", err.syscall);
    console.error("Full Error:", err);
    process.exit(1);
  });
