require("dotenv").config();
const express = require("express");
const connectDB = require("./config/dbConfig"); // yoki ./utils/connect
const cors = require("cors");
const PORT = process.env.PORT || 8040;
const notfound = require("./middleware/notfound.middleware");
const router = require("./routes/router");
const authMiddleware = require("./middleware/AuthMiddleware");
const { createServer } = require("node:http");

const soket = require("./socket");

const AttendanceController = require("./controller/attendanceController");

const app = express();
const server = createServer(app);
const io = require("./middleware/socket.header")(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS sozlamalari
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
};
app.use(cors(corsOptions));

(async () => {
  await connectDB();
})();

// Socket.IO sozlamalari
app.set("socket", io);
soket.connect(io);

app.use("/uploads", express.static("uploads"));
app.use("/check-in/:idCardNumber", AttendanceController.checkIn);
app.use("/api", authMiddleware, router); // Routerlarni ulash
app.get("/", (req, res) => res.send("Salom dunyo")); // Bosh sahifa
app.use(notfound); // 404 middleware

// Serverni ishga tushirish
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
