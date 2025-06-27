const response = require("../utils/response");
const patientsDB = require("../model/patientModel");
const storyDB = require("../model/storyModel");
const adminDB = require("../model/adminModel");
const expenseModel = require("../model/expenseModel");

class PatientController {
  // async createPatient(req, res) {
  //   let io = req.app.get("socket");
  //   try {
  //     let {
  //       firstname,
  //       lastname,
  //       idNumber,
  //       phone,
  //       address,
  //       year,
  //       gender,
  //       paymentType,
  //       payment_amount,
  //       services, // Extract services from req.body
  //       doctorId,
  //       description,
  //     } = req.body;

  //     // Telefon raqami orqali bemorni qidirish
  //     let patient = await patientsDB.findOne({ phone });
  //     if (!patient) {
  //       patient = await patientsDB.create({
  //         firstname,
  //         lastname,
  //         idNumber,
  //         phone,
  //         address,
  //         year,
  //         gender,
  //       });
  //     }

  //     // Validate doctorId
  //     if (!doctorId) return response.error(res, "doctorId is required");

  //     // Shu doktorga yozilgan, view: false bo'lgan storylarni sanash
  //     const today = new Date();
  //     today.setHours(0, 0, 0, 0);
  //     const tomorrow = new Date(today);
  //     tomorrow.setDate(today.getDate() + 1);

  //     const count = await storyDB.countDocuments({
  //       doctorId: doctorId,
  //       view: 0,
  //       createdAt: { $gte: today, $lt: tomorrow },
  //     });

  //     // order_number = navbat raqami
  //     const orderNumber = count + 1;

  //     let doctor = await adminDB.findById(doctorId);
  //     if (!doctor) return response.error(res, "Doctor not found");

  //     // Calculate total service price (if services provided)
  //     const totalServicePrice = services.reduce(
  //       (sum, service) => sum + service.price || 0
  //     );

  //     // Update payment_status logic (optional)
  //     // Example: Check if payment_amount matches doctor's admission_price + service prices
  //     const paymentStatus =
  //       doctor &&
  //       payment_amount === doctor &&
  //       admission_price + totalServicePrice;

  //     // Story yaratish
  //     const story = await storyDB.create({
  //       patientId: patient._id,
  //       doctorId,
  //       order_number: orderNumber,
  //       paymentType,
  //       payment_status: paymentStatus,
  //       payment_amount,
  //       services: services || [], // Save services to storyDB
  //       description: description || "",
  //     });

  //     await expenseModel.create({
  //       name: "Bemor to'lovi",
  //       amount: payment_amount,
  //       type:"kirim",
  //       category:"Bemor to'lovi",
  //       description: "Bemor to'lovi",
  //       paymentType: paymentType,
  //       relevantId: story._id,
  //     })

  //     io.emit("new_story", story);
  //     return response.success(res, "Bemor va story muvaffaqiyatli yaratildi", {
  //       patient: {
  //         firstname,
  //         lastname,
  //         phone,
  //         idNumber,
  //         address,
  //         order_number: orderNumber,
  //         createdAt: story.createdAt,
  //       },
  //       doctor: {
  //         firstName: doctor.firstName,
  //         lastName: doctor.lastName,
  //         specialization: doctor.specialization,
  //         phone: phone,
  //         admission_price: totalServicePrice,
  //       },
  //       services: services || [], // Return services in response
  //     });
  //   } catch (err) {
  //     console.error("Error in createPatient:", err);
  //     return response.serverError(res, "Server error occurred", err.message);
  //   }
  // }

  async createPatient(req, res) {
    let io = req.app.get("socket");
    const mongoose = require("mongoose");
    const session = await mongoose.startSession();
    session.startTransaction();
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
        payment_amount,
        services,
        doctorId,
        description,
      } = req.body;

      // Telefon raqami orqali bemorni qidirish
      let patient = await patientsDB.findOne({ phone }).session(session);
      if (!patient) {
        patient = await patientsDB.create(
          [
            {
              firstname,
              lastname,
              idNumber,
              phone,
              address,
              year,
              gender,
            },
          ],
          { session }
        );
        patient = patient[0];
      }

      // Validate doctorId
      if (!doctorId) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "doctorId is required");
      }

      // Shu doktorga yozilgan, view: false bo'lgan storylarni sanash
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const count = await storyDB
        .countDocuments({
          doctorId: doctorId,
          view: 0,
          createdAt: { $gte: today, $lt: tomorrow },
        })
        .session(session);

      // order_number = navbat raqami
      const orderNumber = count + 1;

      let doctor = await adminDB.findById(doctorId).session(session);
      if (!doctor) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Doctor not found");
      }

      // Calculate total service price (if services provided)
      const totalServicePrice = (services || []).reduce(
        (sum, service) => sum + (service.price || 0),
        0
      );

      // To'g'ri payment_status hisoblash
      const paymentStatus =
        payment_amount >= (doctor.admission_price || 0) + totalServicePrice;

      // Story yaratish
      const story = await storyDB.create(
        [
          {
            patientId: patient._id,
            doctorId,
            order_number: orderNumber,
            paymentType,
            payment_status: paymentStatus,
            payment_amount,
            services: services || [],
            description: description || "",
          },
        ],
        { session }
      );
      const createdStory = story[0];

      await expenseModel.create(
        [
          {
            name: "Bemor to'lovi",
            amount: payment_amount,
            type: "kirim",
            category: "Bemor to'lovi",
            description: "Bemor to'lovi",
            paymentType: paymentType,
            relevantId: createdStory._id,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      io.emit("new_story", createdStory);
      return response.success(res, "Bemor va story muvaffaqiyatli yaratildi", {
        patient: {
          firstname,
          lastname,
          phone,
          idNumber,
          address,
          order_number: orderNumber,
          createdAt: createdStory.createdAt,
        },
        doctor: {
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          specialization: doctor.specialization,
          phone: phone,
          admission_price: totalServicePrice,
        },
        services: services || [],
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error in createPatient:", err);
      return response.serverError(res, "Server error occurred", err.message);
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
  // router.put('/client/update/:id', async (req, res) => {
  async updatePatientBmi(req, res) {
    try {
      const { id } = req.params;
      const { height, weight, bloodGroup } = req.body;

      if (!id) {
        return response.notFound(res, "Patient ID is required");
      }

      const updateData = {};
      if (height !== undefined) updateData.height = Number(height) || null;
      if (weight !== undefined) updateData.weight = Number(weight) || null;
      if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup || null;

      if (height && weight) {
        const heightInMeters = Number(height) / 100;
        updateData.bmi = Number(
          (Number(weight) / (heightInMeters * heightInMeters)).toFixed(2)
        );
      } else if (height === null || weight === null) {
        updateData.bmi = null;
      }

      const updatedPatient = await patientsDB.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedPatient) {
        return response.notFound(res, "Patient not found");
      }

      response.success(res, "Patient updated successfully", updatedPatient);
    } catch (error) {
      return response.serverError(res, error.message, error);
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

  async redirectPatient(req, res) {
    try {
      let io = req.app.get("socket");
      let { storyId, newDoctorId, services } = req.body;

      let story = await storyDB.findById(storyId);
      if (!story) return response.notFound(res, "Story topilmadi");
      let newStory = {
        patientId: story?.patientId,
        doctorId: newDoctorId,
        redirectStatus: true,
        services: services,
      };

      let result = await storyDB.create(newStory);
      if (!result) return response.notFound(res, "Story topilmadi");
      io.emit("new_story", result);
      return response.success(res, "Story yaratildi", result);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // async updateRedirectPatient(req, res) {
  //   try {
  //     const { storyId, paymentType, payment_amount } = req.body;

  //     // Storyni topish va patient/doctor ma'lumotlarini populate qilish
  //     const story = await storyDB
  //       .findById(storyId)
  //       .populate("patientId")
  //       .populate("doctorId");
  //     if (!story) return response.notFound(res, "Story topilmadi", "hatolik");

  //     // Xizmatlar narxini hisoblash
  //     const servicesPrice = (story.services || []).reduce(
  //       (total, service) => total + (service.price || 0),
  //       0
  //     );

  //     // Navbat raqamini hisoblash
  //     const today = new Date();
  //     today.setHours(0, 0, 0, 0);
  //     const tomorrow = new Date(today);
  //     tomorrow.setDate(today.getDate() + 1);

  //     const count = await storyDB.countDocuments({
  //       doctorId: story.doctorId._id,
  //       view: false,
  //       createdAt: { $gte: today, $lt: tomorrow },
  //     });
  //     const order_number = count + 1;

  //     // Storyni yangilash
  //     story.paymentType = paymentType;
  //     story.payment_amount = payment_amount;
  //     story.payment_status = payment_amount >= servicesPrice;
  //     story.redirectStatus = false;
  //     story.order_number = order_number;
  //     await story.save();

  //     await expenseModel.create(
  //       [
  //         {
  //           name: "Bemor to'lovi",
  //           amount: payment_amount,
  //           type: "kirim",
  //           category: "Bemor to'lovi",
  //           description: "Bemor to'lovi",
  //           paymentType: paymentType,
  //           relevantId: story._id,
  //         },
  //       ],
  //       { session }
  //     );

  //     return response.success(res, "Bemor va story muvaffaqiyatli yangilandi", {
  //       patient: {
  //         firstname: story.patientId.firstname,
  //         lastname: story.patientId.lastname,
  //         phone: story.patientId.phone,
  //         idNumber: story.patientId.idNumber,
  //         address: story.patientId.address,
  //         order_number,
  //         createdAt: story.createdAt,
  //       },
  //       doctor: {
  //         firstName: story.doctorId.firstName,
  //         lastName: story.doctorId.lastName,
  //         specialization: story.doctorId.specialization,
  //         phone: story.doctorId.phone,
  //         admission_price: servicesPrice,
  //       },
  //       services: story.services || [],
  //     });
  //   } catch (err) {
  //     console.error("Error in updateRedirectPatient:", err);
  //     return response.serverError(res, err.message, err);
  //   }
  // }

  async updateRedirectPatient(req, res) {
    const mongoose = require("mongoose");
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { storyId, paymentType, payment_amount } = req.body;

      // Storyni topish va patient/doctor ma'lumotlarini populate qilish
      const story = await storyDB
        .findById(storyId)
        .populate("patientId")
        .populate("doctorId")
        .session(session);
      if (!story) {
        await session.abortTransaction();
        session.endSession();
        return response.notFound(res, "Story topilmadi", "hatolik");
      }

      // Xizmatlar narxini hisoblash
      const servicesPrice = (story.services || []).reduce(
        (total, service) => total + (service.price || 0),
        0
      );

      // Navbat raqamini hisoblash
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const count = await storyDB
        .countDocuments({
          doctorId: story.doctorId._id,
          view: false,
          createdAt: { $gte: today, $lt: tomorrow },
        })
        .session(session);
      const order_number = count + 1;

      // Storyni yangilash
      story.paymentType = paymentType;
      story.payment_amount = payment_amount;
      story.payment_status = payment_amount >= servicesPrice;
      story.redirectStatus = false;
      story.order_number = order_number;
      await story.save({ session });

      await expenseModel.create(
        [
          {
            name: "Bemor to'lovi",
            amount: payment_amount,
            type: "kirim",
            category: "Bemor to'lovi",
            description: "Bemor to'lovi",
            paymentType: paymentType,
            relevantId: story._id,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return response.success(res, "Bemor va story muvaffaqiyatli yangilandi", {
        patient: {
          firstname: story.patientId.firstname,
          lastname: story.patientId.lastname,
          phone: story.patientId.phone,
          idNumber: story.patientId.idNumber,
          address: story.patientId.address,
          order_number,
          createdAt: story.createdAt,
        },
        doctor: {
          firstName: story.doctorId.firstName,
          lastName: story.doctorId.lastName,
          specialization: story.doctorId.specialization,
          phone: story.doctorId.phone,
          admission_price: servicesPrice,
        },
        services: story.services || [],
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error in updateRedirectPatient:", err);
      return response.serverError(res, err.message, err);
    }
  }

  async getRedirectPatients(req, res) {
    try {
      let allRedirectedPatients = await storyDB
        .find({ redirectStatus: true })
        .populate("patientId")
        .populate("doctorId");
      if (allRedirectedPatients.length === 0) {
        return response.notFound(res, "Yo'naltirilgan bemorlar topilmadi");
      }
      return response.success(
        res,
        "Yo'naltirilgan bemorlar topildi",
        allRedirectedPatients
      );
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new PatientController();
