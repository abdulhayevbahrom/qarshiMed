const Attendance = require("../model/attendanceModal");
const Admin = require("../model/adminModel");
const Clinic = require("../model/clinicInfo");
const response = require("../utils/response");
const { login } = require("./adminController");

let scanCache = new Map();
let CACHE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
class AttendanceController {
  static async checkIn(req, res) {
    try {
      let io = req.app.get("socket");
      const { idCardNumber } = req.params;
      if (!idCardNumber) {
        return response.error(res, "idCardNumber kiritilishi shart");
      }

      const employee = await Admin.findOne({ idCardNumber });
      if (!employee) {
        return response.notFound(res, "Ishchi topilmadi");
      }

      let clinicInfo = await Clinic.findOne();
      if (!clinicInfo) {
        return response.error(res, "Klinika topilmadi");
      }
      let schedule = {
        start_time: clinicInfo.work_schedule.start_time,
        end_time: clinicInfo.work_schedule.end_time,
        work_days: clinicInfo.work_schedule.work_days,
        settings: {
          grace_period_minutes: 15,
          early_leave_threshold_minutes: 30,
          overtime_threshold_minutes: 30,
        },
      };

      let day = new Date().getDay();
      let dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];

      if (!schedule.work_days.includes(dayNames[day])) {
        return response.error(res, "Bugun ish kuni emas");
      }

      const today = new Date().toISOString().split("T")[0];
      const currentTime = new Date();

      const attendance = await Attendance.findOne({
        employee_id: employee._id,
        date: today,
      });

      // Agar bugun ishga kelmagan bo'lsa (check_in_time yo'q), kelgan deb belgilash
      if (!attendance || !attendance.check_in_time) {
        // Check cache for recent check-in
        const cacheEntry = scanCache.get(idCardNumber);
        if (
          cacheEntry &&
          new Date() - cacheEntry.timestamp < CACHE_TIMEOUT &&
          cacheEntry.action === "checkin"
        ) {
          return response.error(
            res,
            "10 minut ichida takroriy kelish qayd etilmaydi"
          );
        }

        function parseTimeToDate(timeStr, baseDate = new Date()) {
          const [hour, minute] = timeStr.split(":").map(Number);
          const date = new Date(baseDate);
          date.setHours(hour, minute, 0, 0);
          return date;
        }

        const workStartTime = parseTimeToDate(schedule.start_time);
        const gracePeriodTime = new Date(
          workStartTime.getTime() +
            schedule.settings.grace_period_minutes * 60 * 1000
        );

        const lateMinutes =
          currentTime > gracePeriodTime
            ? Math.floor((currentTime - workStartTime) / (1000 * 60))
            : 0;
        const status = lateMinutes > 0 ? "late" : "present";

        const newAttendance = attendance
          ? await Attendance.findByIdAndUpdate(
              attendance._id,
              { check_in_time: currentTime, late_minutes: lateMinutes, status },
              { new: true }
            )
          : new Attendance({
              employee_id: employee._id,
              date: today,
              check_in_time: currentTime,
              late_minutes: lateMinutes,
              status,
            });

        await newAttendance.save();

        // Update cache
        scanCache.set(idCardNumber, {
          timestamp: new Date(),
          action: "checkin",
        });

        function cleanupCache() {
          const now = new Date();
          for (const [idCardNumber, { timestamp }] of scanCache.entries()) {
            if (now - timestamp > CACHE_TIMEOUT) {
              scanCache.delete(idCardNumber);
            }
          }
        }
        cleanupCache();

        const populatedAttendance = await Attendance.findById(
          newAttendance._id
        ).populate("employee_id", "firstName lastName role");

        io.emit("checkin", populatedAttendance);
        return response.created(
          res,
          `${employee.firstName} ${employee.lastName} muvaffaqiyatli keldi`,
          {
            attendance: populatedAttendance,
            late_info:
              lateMinutes > 0 ? `${lateMinutes} minut kech qoldi` : null,
            work_start_time: schedule.start_time,
            grace_period: schedule.settings.grace_period_minutes,
          }
        );
      }
      // Agar allaqachon kelgan bo'lsa, ketish vaqtini belgilash
      else if (attendance.check_in_time && !attendance.check_out_time) {
        // Kelgan vaqtidan 10 minut o'tganmi tekshirish
        const checkInTime = new Date(attendance.check_in_time);
        const timeDifference = currentTime - checkInTime;
        const minutesDifference = Math.floor(timeDifference / (1000 * 60));

        if (minutesDifference < 10) {
          return response.error(
            res,
            `Ertag ketyapsiz! Ishga kelganingizga ${minutesDifference} minut bo'ldi. Kamida 10 minut kutib turing.`
          );
        }

        // Check cache for recent check-out
        const cacheEntry = scanCache.get(idCardNumber);
        if (
          cacheEntry &&
          new Date() - cacheEntry.timestamp < CACHE_TIMEOUT &&
          cacheEntry.action === "checkout"
        ) {
          return response.error(
            res,
            "10 minut ichida takroriy chiqish qayd etilmaydi"
          );
        }

        // Ishdan chiqish vaqtini belgilash
        const updatedAttendance = await Attendance.findByIdAndUpdate(
          attendance._id,
          { check_out_time: currentTime },
          { new: true }
        );

        // Update cache
        scanCache.set(idCardNumber, {
          timestamp: new Date(),
          action: "checkout",
        });

        function cleanupCache() {
          const now = new Date();
          for (const [idCardNumber, { timestamp }] of scanCache.entries()) {
            if (now - timestamp > CACHE_TIMEOUT) {
              scanCache.delete(idCardNumber);
            }
          }
        }
        cleanupCache();

        const populatedAttendance = await Attendance.findById(
          updatedAttendance._id
        ).populate("employee_id", "firstName lastName role");

        io.emit("checkout", populatedAttendance);
        return response.success(
          res,
          `${employee.firstName} ${employee.lastName} muvaffaqiyatli chiqdi`,
          {
            attendance: populatedAttendance,
            work_duration: `${Math.floor(minutesDifference / 60)} soat ${
              minutesDifference % 60
            } minut`,
          }
        );
      }
      // Agar bugun ham kelgan ham chiqgan bo'lsa
      else {
        return response.error(
          res,
          "Bugun allaqachon kelgan va chiqgan",
          attendance
        );
      }
    } catch (error) {
      return response.serverError(res, "Server xatosi", error.message);
    }
  }
  // Daily report
  static async getDailyReport(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split("T")[0];

      const attendances = await Attendance.find({ date: targetDate })
        .populate(
          "employee_id",
          "firstName lastName role specialization idCardNumber"
        )
        .sort({ check_in_time: 1 });

      const summary = {
        total_employees: attendances.length,
        present: attendances.filter((a) => a.check_in_time).length,
        late: attendances.filter((a) => a.late_minutes > 0).length,
        early_leave: attendances.filter((a) => a.early_leave_minutes > 0)
          .length,
        overtime: attendances.filter((a) => a.overtime_minutes > 0).length,
      };

      return response.success(res, "Kunlik hisobot", {
        date: targetDate,
        summary,
        attendances,
      });
    } catch (error) {
      console.error("Hisobot xatosi:", error);
      return response.serverError(res, "Server xatosi", error.message);
    }
  }

  // Employee history
  static async getEmployeeHistory(req, res) {
    try {
      const { idCardNumber } = req.params;
      if (!idCardNumber) {
        return response.error(res, "idCardNumber kiritilishi shart");
      }

      const employee = await Admin.findOne({ idCardNumber });
      if (!employee) {
        return response.notFound(res, "Ishchi topilmadi");
      }

      const { start_date, end_date } = req.query;

      const dateFilter = { employee_id: employee._id };
      if (start_date && end_date) {
        dateFilter.date = { $gte: start_date, $lte: end_date };
      }

      const history = await Attendance.find(dateFilter)
        .populate("employee_id", "firstName lastName role idCardNumber")
        .sort({ date: -1 });

      return response.success(res, "Ishchi tarixi", { idCardNumber, history });
    } catch (error) {
      console.error("Tarix xatosi:", error);
      return response.serverError(res, "Server xatosi", error.message);
    }
  }
}

module.exports = AttendanceController;
