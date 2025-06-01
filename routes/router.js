const router = require("express").Router();
const adminController = require("../controller/adminController");
const adminValidation = require("../validation/adminValidation");

router.post("/admin/login", adminController.login);
router.get("/admin/all", adminController.getAdmins);
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

module.exports = router;
