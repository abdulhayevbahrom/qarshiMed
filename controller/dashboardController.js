const Admin = require("../model/adminModel");
const RoomStory = require("../model/roomStoryModel");
const moment = require("moment");
const response = require("../utils/response");

async function getDoctorsTodayReport(req, res) {
  try {
    // Faqat doctorlarni olamiz
    const doctors = await Admin.find({ role: "doctor" });

    // Bugungi kunning boshlanishi va oxiri
    const startOfDay = moment().startOf("day").toDate();
    const endOfDay = moment().endOf("day").toDate();

    // Barcha doctorlar uchun hisobot array
    const report = [];

    for (const doc of doctors) {
      // Bugun doctor qabul qilgan bemorlar (RoomStory orqali)
      const todayStories = await RoomStory.find({
        doctorId: doc._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      // Umumiy qabul qilgan bemorlar (RoomStory orqali)
      const allStories = await RoomStory.find({ doctorId: doc._id });

      // Bugungi bemorlar soni
      const today = todayStories.length;

      // Umumiy bemorlar soni
      const clientLength = allStories.length;

      // Bugungi va umumiy tushum (admission_price * bemorlar soni)
      const totalPrice = allStories.reduce(
        (sum, s) => sum + (doc.admission_price || 0),
        0
      );
      const todayPrice = todayStories.reduce(
        (sum, s) => sum + (doc.admission_price || 0),
        0
      );

      // Doctorning foiz yoki oylik bo'yicha o'z ulushi
      let ownPrice = 0;
      if (doc.salary_type === "percentage") {
        ownPrice = Math.round(
          ((doc.percentage_from_admissions || 0) * totalPrice) / 100
        );
      } else {
        ownPrice = doc.salary_per_month || 0;
      }

      report.push({
        idNumber: doc._id,
        firstName: doc.firstName,
        lastName: doc.lastName,
        specialization: doc.specialization,
        percent: doc.percentage_from_admissions || 0,
        salary: doc.salary_per_month || 0,
        today,
        todayPrice,
        totalPrice,
        clientLength,
        ownPrice,
      });
    }

    return response.success(res, "Bugungi doctorlar hisobotlari", report);
  } catch (err) {
    return response.serverError(res, err.message, err);
  }
}

module.exports = { getDoctorsTodayReport };
