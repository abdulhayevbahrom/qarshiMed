// controllers/attendanceController.js
const Attendance = require("../model/attendanceModal");
const Admin = require("../model/adminModel"); // Sizning doktor schemangiz
const Clinic = require("../model/clinicInfo");
const response = require("../utils/response");

class AttendanceController {
    // Klinika ish vaqtini olish
    static async getWorkSchedule(employee) {
        const clinic = await Clinic.findById(employee.clinic_id);
        if (!clinic) {
            throw new Error("Klinika topilmadi");
        }

        // Agar ishchining shaxsiy jadval sozlamalari bo'lsa, ularni ishlatish
        if (employee.personal_schedule && employee.personal_schedule.enabled) {
            return {
                start_time: employee.personal_schedule.start_time || clinic.work_schedule.start_time,
                end_time: employee.personal_schedule.end_time || clinic.work_schedule.end_time,
                work_days: employee.personal_schedule.work_days.length > 0 ?
                    employee.personal_schedule.work_days : clinic.work_schedule.work_days,
                settings: clinic.attendance_settings
            };
        }

        return {
            start_time: clinic.work_schedule.start_time,
            end_time: clinic.work_schedule.end_time,
            work_days: clinic.work_schedule.work_days,
            settings: clinic.attendance_settings
        };
    }

    // Bugun ish kunumi?
    static isWorkDay(workDays) {
        const today = new Date();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[today.getDay()];
        return workDays.includes(todayName);
    }

    // NFC orqali ishchi kirganida
    static async checkIn(req, res) {
        try {
            const { employee_id, nfc_card_id } = req.body;

            // Ishchini klinika bilan birga topish
            const employee = await Admin.findById(employee_id);
            if (!employee) {
                return res.status(404).json({ message: "Ishchi topilmadi" });
            }

            if (!employee.is_active) {
                return res.status(400).json({ message: "Ishchi faol emas" });
            }

            // Ish vaqti sozlamalarini olish
            const schedule = await this.getWorkSchedule(employee);

            // Bugun ish kunumi?
            if (!this.isWorkDay(schedule.work_days)) {
                return res.status(400).json({ message: "Bugun ish kuni emas" });
            }

            const today = new Date().toISOString().split('T')[0];
            const checkInTime = new Date();

            // Bugungi kungi record bor-yo'qligini tekshirish
            let attendance = await Attendance.findOne({
                employee_id: employee_id,
                date: today
            });

            if (attendance && attendance.check_in_time) {
                return res.status(400).json({
                    message: "Bugun allaqachon kelgan",
                    attendance: attendance
                });
            }

            // Ish boshlanish vaqtini tayyorlash
            const [startHour, startMinute] = schedule.start_time.split(':');
            const workStartTime = new Date();
            workStartTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

            // Grace period qo'shish
            const gracePeriodTime = new Date(workStartTime);
            gracePeriodTime.setMinutes(gracePeriodTime.getMinutes() + schedule.settings.grace_period_minutes);

            let lateMinutes = 0;
            let status = 'present';

            // Kechikish hisobini chiqarish
            if (checkInTime > gracePeriodTime) {
                lateMinutes = Math.floor((checkInTime - workStartTime) / (1000 * 60));
                status = 'late';
            }

            // Yangi record yaratish yoki mavjudini yangilash
            if (!attendance) {
                attendance = new Attendance({
                    employee_id: employee_id,
                    date: today,
                    check_in_time: checkInTime,
                    late_minutes: lateMinutes,
                    status: status
                });
            } else {
                attendance.check_in_time = checkInTime;
                attendance.late_minutes = lateMinutes;
                attendance.status = status;
            }

            await attendance.save();

            // Ishchi ma'lumotlari bilan birga qaytarish
            const populatedAttendance = await Attendance.findById(attendance._id)
                .populate('employee_id', 'firstName lastName role');

            res.json({
                message: `${employee.firstName} ${employee.lastName} muvaffaqiyatli keldi`,
                attendance: populatedAttendance,
                late_info: lateMinutes > 0 ? `${lateMinutes} minut kech qoldi` : null,
                work_start_time: schedule.start_time,
                grace_period: schedule.settings.grace_period_minutes
            });

        } catch (error) {
            console.error("Check-in xatosi:", error);
            res.status(500).json({ message: "Server xatosi", error: error.message });
        }
    }

    // Ishchi ketganida
    static async checkOut(req, res) {
        try {
            const { employee_id } = req.body;
            const today = new Date().toISOString().split('T')[0];
            const checkOutTime = new Date();

            // Bugungi recordni topish
            const attendance = await Attendance.findOne({
                employee_id: employee_id,
                date: today
            });

            if (!attendance || !attendance.check_in_time) {
                return res.status(400).json({
                    message: "Bugun kelish vaqti qayd etilmagan"
                });
            }

            if (attendance.check_out_time) {
                return res.status(400).json({
                    message: "Bugun allaqachon ketgan",
                    attendance: attendance
                });
            }

            // Ishchi va klinika ma'lumotlarini olish
            const employee = await Admin.findById(employee_id);
            const schedule = await this.getWorkSchedule(employee);

            // Ish tugash vaqtini tayyorlash
            const [endHour, endMinute] = schedule.end_time.split(':');
            const workEndTime = new Date();
            workEndTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

            // Erta ketish chegarasini hisoblash
            const earlyLeaveThreshold = new Date(workEndTime);
            earlyLeaveThreshold.setMinutes(
                earlyLeaveThreshold.getMinutes() - schedule.settings.early_leave_threshold_minutes
            );

            // Ortiqcha ish chegarasini hisoblash
            const overtimeThreshold = new Date(workEndTime);
            overtimeThreshold.setMinutes(
                overtimeThreshold.getMinutes() + schedule.settings.overtime_threshold_minutes
            );

            // Umumiy ish vaqtini hisoblash
            const totalWorkMinutes = Math.floor((checkOutTime - attendance.check_in_time) / (1000 * 60));

            let earlyLeaveMinutes = 0;
            let overtimeMinutes = 0;
            let status = attendance.status;

            if (checkOutTime < earlyLeaveThreshold) {
                // Erta ketgan (threshold dan oldin)
                earlyLeaveMinutes = Math.floor((workEndTime - checkOutTime) / (1000 * 60));
                status = 'early_leave';
            } else if (checkOutTime > overtimeThreshold) {
                // Ortiqcha ishlagan (threshold dan keyin)
                overtimeMinutes = Math.floor((checkOutTime - workEndTime) / (1000 * 60));
                if (overtimeMinutes > 0) {
                    status = 'overtime';
                }
            }

            // Record yangilash
            attendance.check_out_time = checkOutTime;
            attendance.early_leave_minutes = earlyLeaveMinutes;
            attendance.overtime_minutes = overtimeMinutes;
            attendance.total_work_minutes = totalWorkMinutes;
            attendance.status = status;

            await attendance.save();

            const populatedAttendance = await Attendance.findById(attendance._id)
                .populate('employee_id', 'firstName lastName role');

            const workHours = Math.floor(totalWorkMinutes / 60);
            const workMinutes = totalWorkMinutes % 60;

            res.json({
                message: `Muvaffaqiyatli ketdi`,
                attendance: populatedAttendance,
                work_summary: {
                    total_work_time: `${workHours} soat ${workMinutes} minut`,
                    overtime: overtimeMinutes > 0 ? `${Math.floor(overtimeMinutes / 60)} soat ${overtimeMinutes % 60} minut ortiqcha` : null,
                    early_leave: earlyLeaveMinutes > 0 ? `${Math.floor(earlyLeaveMinutes / 60)} soat ${earlyLeaveMinutes % 60} minut erta ketdi` : null,
                    work_end_time: schedule.end_time
                }
            });

        } catch (error) {
            console.error("Check-out xatosi:", error);
            res.status(500).json({ message: "Server xatosi", error: error.message });
        }
    }

    // Real-time NFC scan
    static async nfcScan(req, res) {
        try {
            const { nfc_card_id } = req.body;

            // NFC card ID orqali ishchini topish
            const employee = await Admin.findOne({
                nfc_card_id: nfc_card_id,
                is_active: true
            });

            if (!employee) {
                return res.status(404).json({ message: "NFC karta ro'yxatdan o'tmagan yoki ishchi faol emas" });
            }

            // Klinika faol emasligini tekshirish
            if (!employee.clinic_id.is_active) {
                return res.status(400).json({ message: "Klinika faol emas" });
            }

            const today = new Date().toISOString().split('T')[0];
            const attendance = await Attendance.findOne({
                employee_id: employee._id,
                date: today
            });

            // Temporary request object for internal methods
            const tempReq = {
                body: {
                    employee_id: employee._id,
                    nfc_card_id: nfc_card_id
                }
            };

            // Agar bugun hali kelmagan bo'lsa - check in
            if (!attendance || !attendance.check_in_time) {
                return this.checkIn(tempReq, res);
            }
            // Agar kelgan lekin ketmagan bo'lsa - check out
            else if (!attendance.check_out_time) {
                return this.checkOut(tempReq, res);
            }
            // Agar bugun to'liq record mavjud bo'lsa
            else {
                const populatedAttendance = await Attendance.findById(attendance._id)
                    .populate('employee_id', 'firstName lastName role');

                return res.json({
                    message: "Bugun allaqachon to'liq davomat qayd etilgan",
                    attendance: populatedAttendance,
                    work_summary: {
                        total_work_time: `${Math.floor(attendance.total_work_minutes / 60)} soat ${attendance.total_work_minutes % 60} minut`,
                        check_in_time: attendance.check_in_time,
                        check_out_time: attendance.check_out_time
                    }
                });
            }

        } catch (error) {
            console.error("NFC scan xatosi:", error);
            res.status(500).json({ message: "Server xatosi", error: error.message });
        }
    }

    // Kunlik hisobot
    static async getDailyReport(req, res) {
        try {
            const { date } = req.query;
            const targetDate = date || new Date().toISOString().split('T')[0];

            const attendances = await Attendance.find({ date: targetDate })
                .populate('employee_id', 'firstName lastName role specialization')
                .sort({ check_in_time: 1 });

            const summary = {
                total_employees: attendances.length,
                present: attendances.filter(a => a.check_in_time).length,
                late: attendances.filter(a => a.late_minutes > 0).length,
                early_leave: attendances.filter(a => a.early_leave_minutes > 0).length,
                overtime: attendances.filter(a => a.overtime_minutes > 0).length
            };

            res.json({
                date: targetDate,
                summary: summary,
                attendances: attendances
            });

        } catch (error) {
            console.error("Hisobot xatosi:", error);
            res.status(500).json({ message: "Server xatosi", error: error.message });
        }
    }

    // Ishchi tarixi
    static async getEmployeeHistory(req, res) {
        try {
            const { employee_id } = req.params;
            const { start_date, end_date } = req.query;

            let dateFilter = { employee_id: employee_id };

            if (start_date && end_date) {
                dateFilter.date = {
                    $gte: start_date,
                    $lte: end_date
                };
            }

            const history = await Attendance.find(dateFilter)
                .populate('employee_id', 'firstName lastName role')
                .sort({ date: -1 });

            res.json({
                employee_id: employee_id,
                history: history
            });

        } catch (error) {
            console.error("Tarix xatosi:", error);
            res.status(500).json({ message: "Server xatosi", error: error.message });
        }
    }

}
module.exports = AttendanceController;