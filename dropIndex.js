import mongoose from "mongoose";

async function dropUsernameIndex() {
  await mongoose.connect("mongodb+srv://Vercel-Admin-boundless-db:Ev22QK3ZHNAJy0bE@boundless-db.ho6o77g.mongodb.net/?retryWrites=true&w=majority");

  const result = await mongoose.connection.collection("users").dropIndex("profile.username_1");
  console.log("Dropped index:", result);

  await mongoose.disconnect();
}

dropUsernameIndex().catch(console.error);
