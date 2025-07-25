// 2. Yangilangan Controller (roomServicesController.js)
const ChoosedRoomServices = require("../model/choosedRoomServices");
const mongoose = require("mongoose");
const response = require("../utils/response");
const roomStoryModel = require("../model/roomStoryModel");

class RoomServicesController {
  // ✅ 1. Bemor uchun muolajalarni biriktirish
  async assignRoomServices(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { roomStoryId } = req.body;

      const newAssignment = await ChoosedRoomServices.create([req.body], {
        session,
      });

      if (!newAssignment || !newAssignment[0]) {
        await session.abortTransaction();
        session.endSession();
        return response.notFound(res, "Muolajalar biriktirilmadi");
      }

      await roomStoryModel.findByIdAndUpdate(
        roomStoryId,
        { choosedRoomServices: newAssignment[0]._id },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return response.success(res, "Muolajalar biriktirildi", newAssignment[0]);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(res, err.message, err);
    }
  }

  // ✅ 2. Bemorning ma'lumotlarini olish
  async getPatientServices(req, res) {
    try {
      const { patientId } = req.params;

      const data = await ChoosedRoomServices.findOne({
        roomStoryId: patientId,
      })
        // .populate("serviceId")
        .populate("services.serviceId", "name")
        .populate("services.dailyTracking.workerId", "firstName lastName role");
      if (!data) return response.notFound(res, "Ma'lumot topilmadi");

      return response.success(res, "Bemor muolajalari", data);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
  async getPatientServicesByPatientId(req, res) {
    try {
      const { patientId } = req.params;
      const data = await ChoosedRoomServices.findOne({ patientId })
        // .populate("serviceId")
        .populate("services.serviceId", "name")
        .populate("services.dailyTracking.workerId", "firstName lastName role");
      if (!data) return response.notFound(res, "Ma'lumot topilmadi");

      return response.success(res, "Bemor muolajalari", data);
    } catch (err) {
      logger.error("Error fetching patient services:", err);
      return response.serverError(res, err.message, err);
    }
  }

  // ✅ 3. Muolajani o'sha kunga bajarildi deb belgilash yoki o'chirish
  async markTreatmentDone(req, res) {
    try {
      const { patientId, serviceId, date, workerId, action } = req.body;

      const choosed = await ChoosedRoomServices.findOne({
        roomStoryId: patientId,
      });

      if (!choosed)
        return response.notFound(
          res,
          "Bemorga biriktirilgan muolajalar topilmadi"
        );

      const service = choosed.services.find(
        (s) => s.serviceId.toString() === serviceId
      );

      if (!service)
        return response.notFound(res, "Ko'rsatilgan muolaja topilmadi");

      const targetDate = new Date(date);
      const existingIndex = service.dailyTracking.findIndex(
        (d) => new Date(d.date).toDateString() === targetDate.toDateString()
      );

      if (action === "remove") {
        // O'chirish
        if (existingIndex !== -1) {
          service.dailyTracking.splice(existingIndex, 1);
          await choosed.save();
          return response.success(res, "Muolaja belgilash o'chirildi", service);
        } else {
          return response.notFound(res, "O'chiriladigan muolaja topilmadi");
        }
      } else {
        // Qo'shish
        if (existingIndex === -1) {
          service.dailyTracking.push({
            date: targetDate,
            workerId: workerId,
          });
          await choosed.save();
          return response.success(res, "Muolaja kuni saqlandi", service);
        } else {
          return response.success(
            res,
            "Muolaja allaqachon belgilangan",
            service
          );
        }
      }
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // ✅ 4. Bemorning muolajalarini yangilash
  async updateChoosedServices(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { roomStoryId, services } = req.body;

      // Validate inputs
      if (!mongoose.isValidObjectId(roomStoryId)) {
        await session.abortTransaction();
        session.endSession();
        return response.badRequest(res, "Invalid roomStoryId");
      }

      if (!Array.isArray(services) || services.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return response.badRequest(
          res,
          "Services array is required and cannot be empty"
        );
      }

      // Validate services array
      for (const service of services) {
        if (!mongoose.isValidObjectId(service.serviceId)) {
          await session.abortTransaction();
          session.endSession();
          return response.badRequest(
            res,
            `Invalid serviceId: ${service.serviceId}`
          );
        }
        if (!service.part || typeof service.part !== "string") {
          await session.abortTransaction();
          session.endSession();
          return response.badRequest(
            res,
            "Each service must have a valid part"
          );
        }
        if (!Number.isInteger(service.quantity) || service.quantity < 1) {
          await session.abortTransaction();
          session.endSession();
          return response.badRequest(
            res,
            "Each service must have a valid quantity (integer >= 1)"
          );
        }
        if (service.workerId && !mongoose.isValidObjectId(service.workerId)) {
          await session.abortTransaction();
          session.endSession();
          return response.badRequest(
            res,
            `Invalid workerId: ${service.workerId}`
          );
        }
        if (Array.isArray(service.dailyTracking)) {
          for (const track of service.dailyTracking) {
            if (!track.date || isNaN(new Date(track.date))) {
              await session.abortTransaction();
              session.endSession();
              return response.badRequest(res, "Invalid date in dailyTracking");
            }
            if (!mongoose.isValidObjectId(track.workerId)) {
              await session.abortTransaction();
              session.endSession();
              return response.badRequest(
                res,
                `Invalid workerId in dailyTracking: ${track.workerId}`
              );
            }
          }
        }
      }

      // Find existing document
      const existingAssignment = await ChoosedRoomServices.findOne({
        roomStoryId,
      }).session(session);

      if (!existingAssignment) {
        await session.abortTransaction();
        session.endSession();
        return response.notFound(res, "Muolajalar topilmadi");
      }

      // Update services array
      existingAssignment.services = services.map((service) => ({
        workerId: service.workerId
          ? new mongoose.Types.ObjectId(service.workerId)
          : undefined,
        serviceId: new mongoose.Types.ObjectId(service.serviceId),
        part: service.part,
        quantity: service.quantity,
        dailyTracking: service.dailyTracking
          ? service.dailyTracking.map((track) => ({
              date: new Date(track.date),
              workerId: new mongoose.Types.ObjectId(track.workerId),
              createdAt: track.createdAt
                ? new Date(track.createdAt)
                : Date.now(),
            }))
          : [],
      }));

      // Save updated document
      await existingAssignment.save({ session });

      // Update roomStoryModel reference if needed
      await roomStoryModel.findByIdAndUpdate(
        roomStoryId,
        { choosedRoomServices: existingAssignment._id },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return response.success(res, "Muolajalar yangilandi", existingAssignment);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(res, err.message, err);
    }
  }

  // ✅ 5. yotmaydigan bemorlarni olish
  async getUnassignedPatients(req, res) {
    try {
      const patients = await ChoosedRoomServices.find({
        roomStoryId: { $in: [null, undefined] },
      })
        .populate({
          path: "patientId",
          select: "patientId",
          populate: {
            path: "patientId", // nested patientId
            model: "patients", // model nomini to‘g‘ri yozing
            select: "firstname lastname phone",
          },
        })
        .populate("services.serviceId", "name")
        .populate("services.dailyTracking.workerId", "firstName lastName role");

      if (!patients.length) {
        return response.notFound(res, "Bemorlar topilmadi");
      }

      return response.success(res, "Bemorlar olinadi", patients);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getPatientServicesByStoryId(req, res) {
    try {
      const { patientId } = req.params;

      const data = await ChoosedRoomServices.findOne({
        patientId,
      })
        // .populate("serviceId")
        .populate("services.serviceId")
        .populate("services.dailyTracking.workerId", "firstName lastName role");
      if (!data) return response.notFound(res, "Ma'lumot topilmadi");

      return response.success(res, "Bemor muolajalari", data);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async markTreatmentDoneByStoryId(req, res) {
    try {
      const { patientId, serviceId, date, workerId, action } = req.body;

      const choosed = await ChoosedRoomServices.findOne({
        patientId,
      });

      if (!choosed)
        return response.notFound(
          res,
          "Bemorga biriktirilgan muolajalar topilmadi"
        );

      const service = choosed.services.find(
        (s) => s.serviceId.toString() === serviceId
      );

      if (!service)
        return response.notFound(res, "Ko'rsatilgan muolaja topilmadi");

      const targetDate = new Date(date);
      const existingIndex = service.dailyTracking.findIndex(
        (d) => new Date(d.date).toDateString() === targetDate.toDateString()
      );

      if (action === "remove") {
        // O'chirish
        if (existingIndex !== -1) {
          service.dailyTracking.splice(existingIndex, 1);
          await choosed.save();
          return response.success(res, "Muolaja belgilash o'chirildi", service);
        } else {
          return response.notFound(res, "O'chiriladigan muolaja topilmadi");
        }
      } else {
        // Qo'shish
        if (existingIndex === -1) {
          service.dailyTracking.push({
            date: targetDate,
            workerId: workerId,
          });
          await choosed.save();
          return response.success(res, "Muolaja kuni saqlandi", service);
        } else {
          return response.success(
            res,
            "Muolaja allaqachon belgilangan",
            service
          );
        }
      }
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new RoomServicesController();
