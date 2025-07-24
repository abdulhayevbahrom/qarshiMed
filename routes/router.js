const router = require("express").Router();
const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, req.params.id + "-" + Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Controllers and Validations
const adminController = require("../controller/adminController");
const adminValidation = require("../validation/adminValidation");
const AttendanceController = require("../controller/attendanceController");
const patientController = require("../controller/patientController");
const storyController = require("../controller/storyController");
const ClinicInfoController = require("../controller/clinicInfoController");
const clinicInfoValidation = require("../validation/clinicInfoValidation");
const roomController = require("../controller/roomController");
const roomValidation = require("../validation/roomValidation");
const expenseController = require("../controller/expensesController");
const expenseValidation = require("../validation/expensesValidation");
const dashboardController = require("../controller/dashboardController");
const servicesController = require("../controller/services-crud");
const NightShiftController = require("../controller/nightShiftController");
const roomServicesController = require("../controller/roomServicescontroller");
const choosedRoomServicesController = require("../controller/choosedRoomServicesController");

router.get(
  "/room-services/unassigned",
  choosedRoomServicesController.getUnassignedPatients
);
router.post(
  "/room-services/assign",
  choosedRoomServicesController.assignRoomServices
);
router.get(
  "/room-services/patient/:patientId",
  choosedRoomServicesController.getPatientServicesByPatientId
);
router.get(
  "/room-services/:patientId",
  choosedRoomServicesController.getPatientServices
);

router.get(
  "/room-services-story/:patientId",
  choosedRoomServicesController.getPatientServicesByStoryId
);

router.post(
  "/room-services/mark",
  choosedRoomServicesController.markTreatmentDone
);
router.post(
  "/room-services-story/mark",
  choosedRoomServicesController.markTreatmentDoneByStoryId
);

router.put(
  "/room-services/update",
  choosedRoomServicesController.updateChoosedServices
);

/**
 * ============================
 * Admin Routes
 * ============================
 */
router.post("/admin/login", adminController.login);
router.get("/admin/all", adminController.getAdmins);
router.get("/admin/for_reception", adminController.getAdminsForReception);
router.get("/admines/:id", adminController.getAdminById);
router.post("/admin/create", adminValidation, adminController.createAdmin);
router.put("/admin/update/:id", adminValidation, adminController.updateAdmin);
router.delete("/admin/delete/:id", adminController.deleteAdmin);
router.put("/admin/:id/servicesId", adminController.updateServicesId);
router.put("/admins/:adminId/room", adminController.updateRoomId);
router.get("/doctors/:id", adminController.getTodayDoctors);

/**
 * ============================
 * Attendance Routes (NFC)
 * ============================
 */
// router.post("/check-in/:idCardNumber", AttendanceController.checkIn);
router.get("/daily-report", AttendanceController.getDailyReport);
router.get(
  "/employee-history/:idCardNumber",
  AttendanceController.getEmployeeHistory
);

/**
 * ============================
 * Patient (Client) Routes
 * ============================
 */
router.post("/client/create", patientController.createPatient);
router.get("/client/all", patientController.getPatients);
router.get("/client/:id", patientController.getPatientById);
router.put("/client/update/:id", patientController.updatePatient);
router.put("/client/updateBmi/:id", patientController.updatePatientBmi);
router.delete("/client/delete/:id", patientController.deletePatient);

// redirect to story
router.post("/story/redirect", patientController.redirectPatient);
router.post("/story/updateRedirect", patientController.updateRedirectPatient);
router.get("/story/redirected", patientController.getRedirectPatients);

/**
 * ============================
 * Story Routes
 * ============================
 */
router.get("/story/all", storyController.getStory);
router.get("/story/patient/:id", storyController.getStoryByPatientId);
router.get("/story/doctor/:id", storyController.getStoryByDoctorId);
router.put("/story/update/:id", storyController.updateStory);
router.get("/story/todays", storyController.getTodaysStory);
router.get(
  "/story/patients-by-doctor/:doctorId",
  storyController.patientsByDoctor
);
router.get("/story/todayVisit", storyController.getPatientVisit);
router.put(
  "/story/visit/:id",
  upload.array("uploadedFiles"),
  storyController.visitPatient
);
router.post("/analis/submit", storyController.submitAnalis);
router.get("/patientsStory", storyController.getAllPatientsStory);
router.get("/patientsStory/:patientId", storyController.getPatientStoryById);
router.get(
  "/doctors/:doctorId/patientsStory",
  storyController.getPatientsStoryByDoctorId
);
//getStoryByPatientAndDoctor
router.get(
  "/story/patient/:patientId/doctor/:doctorId",
  storyController.getStoryByPatientAndDoctor
);
router.put(
  "/stories/:storyId/prescription/:prescriptionIndex/dose/:doseTrackingIndex/workerId/:workerId",
  storyController.updateDoseTaken
);
/**
 * ============================
 * Clinic Info Routes
 * ============================
 */
router.post(
  "/clinic/create",
  clinicInfoValidation,
  ClinicInfoController.createClinicInfo
);
router.put("/clinic/update/:id", ClinicInfoController.updateClinicInfo);
router.get("/clinic/info", ClinicInfoController.getClinicInfo);

/**
 * ============================
 * Room Routes
 * ============================
 */
router.post("/room/create", roomValidation, roomController.createRoom);
router.get("/room/all", roomController.getRooms);
router.get("/room/stories", roomController.getRoomStories);
router.get("/room/:id", roomController.getRoomById);
router.put("/room/update/:id", roomController.updateRoom);
router.put("/roomStatus/update/:id", roomController.updateRoomCleanStatus);
router.delete("/room/delete/:id", roomController.deleteRoom);
router.patch("/room/closeRoom/:id", roomController.closeRoom);
router.patch("/room/addPatient/:id", roomController.addPatientToRoom);
router.post("/room/removePatient/:id", roomController.removePatientFromRoom);
router.post("/room/pay", roomController.payForRoom);
router.patch("/roomStory/changeDays", roomController.changeTreatingDays);
router.get("/roomStory/for-doctor", roomController.getRoomStoriesforDoctor);

/**
 * ============================
 * Expense Routes
 * ============================
 */
router.post(
  "/expense/create",
  expenseValidation,
  expenseController.createExpense
);
router.get("/expense/all", expenseController.getExpenses);
// updateExpense &  deleteExpense
router.put("/expense/update/:id", expenseController.updateExpense);
router.delete("/expense/delete/:id", expenseController.deleteExpense);

/**
 * ============================
 * Dashboard Routes
 * ============================
 */
router.get("/dashboard", dashboardController.getDashboard);

/**
 * ============================
 * Services Routes
 * ============================
 */
router.post("/services", servicesController.create);
router.get("/services", servicesController.getAll);
router.get("/services/:id", servicesController.getById);
router.put("/services/:id", servicesController.update);
router.delete("/services/:id", servicesController.delete);
router.post("/services/:id/add", servicesController.addService);
router.delete("/services/:id/remove", servicesController.deleteService);

/**
 * ============================
 * Nurse night shifts
 * ============================
 */
router.get("/nurses", NightShiftController.getNurses);
router.get("/night-shifts", NightShiftController.getNightShifts);
router.post("/night-shifts", NightShiftController.createNightShift);
router.put("/night-shifts/:id", NightShiftController.updateNightShift);
router.delete("/night-shifts/:id", NightShiftController.deleteNightShift);
router.delete(
  "/night-shifts/:id/nurses/:nurseId",
  NightShiftController.removeNurseFromShift
);
router.post("/night-shifts/:id/start", NightShiftController.startShift);
router.post("/night-shifts/:id/end", NightShiftController.endShift);
router.post(
  "/night-shifts/auto-schedule",
  NightShiftController.autoScheduleShifts
);
router.post("/shift-reports", NightShiftController.createShiftReport);
router.get("/shift-reports", NightShiftController.getShiftReports);
router.get("/statistics/shifts", NightShiftController.getShiftStatistics);
router.get(
  "/statistics/nurse-earnings/:nurseId",
  NightShiftController.getNurseEarnings
);
router.get("/statistics/reports", NightShiftController.getNurseReports);

// ============================
// rooms services
// ============================
router.get("/roomservices/all", roomServicesController.getRoomServices);
router.post("/roomservices/create", roomServicesController.createRoomServices);
router.put(
  "/roomservices/update/:id",
  roomServicesController.updateRoomServices
);

router.delete(
  "/roomservices/delete/:id",
  roomServicesController.deleteRoomServices
);

module.exports = router;
