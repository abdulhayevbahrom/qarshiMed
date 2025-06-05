const router = require("express").Router();
const adminController = require("../controller/adminController");
const adminValidation = require("../validation/adminValidation");

router.post("/admin/login", adminController.login);
router.get("/admin/all", adminController.getAdmins);
router.get("/admin/for_reception", adminController.getAdminsForReception);
router.get("/admin/:id", adminController.getAdminById);
router.post("/admin/create", adminValidation, adminController.createAdmin);
router.put("/admin/update/:id", adminValidation, adminController.updateAdmin);
router.delete("/admin/delete/:id", adminController.deleteAdmin);

const patientController = require("../controller/patientController");
router.post("/client/create", patientController.createPatient);
router.get("/client/all", patientController.getPatients);
router.get("/client/:id", patientController.getPatientById);
router.put("/client/update/:id", patientController.updatePatient);
router.delete("/client/delete/:id", patientController.deletePatient);

// story
const storyController = require("../controller/storyController");
router.get("/story/all", storyController.getStory);
router.get("/story/patient/:id", storyController.getStoryByPatientId);
router.get("/story/doctor/:id", storyController.getStoryByDoctorId);
router.put("/story/update/:id", storyController.updateStory);
router.get("/story/todays", storyController.getTodaysStory);

// clinicInfo
// ...existing code...
const ClinicInfoController = require("../controller/clinicInfoController");
const clinicInfoValidation = require("../validation/clinicInfoValidation");
router.post("/clinic/create", clinicInfoValidation, ClinicInfoController.createClinicInfo);
router.put("/clinic/update/:id", ClinicInfoController.updateClinicInfo);
router.get("/clinic/info", ClinicInfoController.getClinicInfo);


// room
const roomController = require("../controller/roomController");
const roomValidation = require("../validation/roomValidation");

router.post("/room/create", roomValidation, roomController.createRoom);
router.get("/room/all", roomController.getRooms);
router.get("/room/stories", roomController.getRoomStories); // avval stories
router.get("/room/:id", roomController.getRoomById);        // keyin :id
router.put("/room/update/:id", roomValidation, roomController.updateRoom);
router.delete("/room/delete/:id", roomController.deleteRoom);
router.patch("/room/closeRoom/:id", roomController.closeRoom);
router.patch("/room/addPatient/:id", roomController.addPatientToRoom);
router.post("/room/removePatient/:id", roomController.removePatientFromRoom);
router.post("/room/pay", roomController.payForRoom);



module.exports = router;
