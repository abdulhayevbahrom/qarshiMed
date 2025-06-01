const response = require("../utils/response");
const patientsDB = require("../model/patientModel");
const storyDB = require("../model/storyModel");

class PatientController {
  async createPatient(req, res) {
    try {
      let {
        firstname,
        lastname,
        idNumber,
        phone,
        address,
        year,
        gender,
        paymentType,
        payment_status,
        payment_amount,
      } = req.body;
      // Telefon raqami orqali bemorni qidirish
      let patient = await patientsDB.findOne({ phone: req.body.phone });
      if (!patient) {
        patient = await patientsDB.create({
          firstname,
          lastname,
          idNumber,
          phone,
          address,
          year,
          gender,
        });
      }

      // doctorId ni body dan olish
      const doctorId = req.body.doctorId;
      if (!doctorId) return response.serverError(res, "doctorId kiritilmagan");

      // Shu doktorga yozilgan, view: false bo'lgan storylarni sanash
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const count = await storyDB.countDocuments({
        doctorId: doctorId,
        view: false,
        createdAt: { $gte: today, $lt: tomorrow },
      });

      // order_number = navbat raqami
      const order_number = count + 1;

      // Story yaratish
      const story = await storyDB.create({
        patientId: patient._id,
        doctorId,
        order_number,
        paymentType,
        payment_status,
        payment_amount,
      });

      return response.success(res, "Bemor va story yaratildi", {
        patient,
        story,
        order_number,
      });
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getPatients(req, res) {
    try {
      const patients = await patientsDB.find().sort({ createdAt: -1 });
      if (!patients.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Success", patients);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Bemorni ID orqali olish
  async getPatientById(req, res) {
    try {
      const patient = await patientsDB.findById(req.params.id);
      if (!patient) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Success", patient);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Bemorni yangilash
  async updatePatient(req, res) {
    try {
      const patient = await patientsDB.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!patient) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Bemor yangilandi", patient);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Bemorni o'chirish
  async deletePatient(req, res) {
    try {
      const patient = await patientsDB.findByIdAndDelete(req.params.id);
      if (!patient) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Bemor o'chirildi", patient);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new PatientController();
