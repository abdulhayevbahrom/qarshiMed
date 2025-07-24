const response = require("../utils/response");
const storyDB = require("../model/storyModel");
const PatientModel = require("../model/patientModel");
const Labaratory = require("../model/labaratoryModel");
const RoomStoryModel = require("../model/roomStoryModel");
const moment = require("moment");

class StoryController {
  async getStory(req, res) {
    try {
      let filter = {};
      let startDay, endDay;

      if (req.query.startDay && req.query.endDay) {
        // Agar frontenddan startDay va endDay kelsa, shu oraliqni olamiz
        startDay = new Date(req.query.startDay);
        startDay.setHours(0, 0, 0, 0);
        endDay = new Date(req.query.endDay);
        endDay.setHours(23, 59, 59, 999);
      } else {
        // Aks holda, oxirgi 7 kunni olamiz
        endDay = new Date();
        endDay.setHours(23, 59, 59, 999);
        startDay = new Date();
        startDay.setDate(endDay.getDate() - 6);
        startDay.setHours(0, 0, 0, 0);
      }

      filter.createdAt = { $gte: startDay, $lte: endDay };

      const stories = await storyDB
        .find(filter)
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");

      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");

      return response.success(res, "Success", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getStoryByPatientAndDoctor(req, res) {
    try {
      const { patientId, doctorId } = req.params;

      // Validate required parameters
      if (!patientId || !doctorId) {
        return response.badRequest(
          res,
          "Patient ID va Doctor ID talab qilinadi"
        );
      }

      // Fetch the most recent story matching both patientId and doctorId
      const story = await storyDB
        .findOne({ patientId, doctorId })
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order to get the latest
        .populate("patientId")
        .populate("doctorId")
        .lean()
        .exec();

      if (!story) {
        return response.notFound(res, "Tashrif topilmadi");
      }

      return response.success(res, "Eng so‘nggi tashrif topildi", story);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getStoryByPatientId(req, res) {
    try {
      const stories = await storyDB
        .find({ patientId: req.params.id })
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");
      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Bemor topildi", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getStoryByDoctorId(req, res) {
    try {
      const stories = await storyDB
        .find({ doctorId: req.params.id })
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");
      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Bemor topildi", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async updateStory(req, res) {
    try {
      const story = await storyDB.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!story) return response.notFound(res, "Bemor topilmadi");
      return response.success(res, "Bemor yangilandi", story);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getTodaysStory(req, res) {
    try {
      const startOfDay = moment().startOf("day").toDate();
      const endOfDay = moment().endOf("day").toDate();

      const stories = await storyDB
        .find({
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          view: false,
        })
        .sort({ createdAt: -1 })
        .populate("patientId")
        .populate("doctorId");

      if (!stories.length) return response.notFound(res, "Bemorlar topilmadi");
      return response.success(res, "Bemorlar topildi", stories);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async patientsByDoctor(req, res) {
    const { doctorId } = req.params;

    if (!doctorId) {
      return response.notFound(res, "Doktor id talab qilinadi");
    }

    try {
      // Bugungi sanani UTC formatida hisoblaymiz
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(today.getUTCDate() + 1);

      // Bugungi ko‘rilgan va ko‘rilmagan tashriflar sonini topamiz
      const todayViewedCount = await storyDB.countDocuments({
        doctorId,
        view: true,
        createdAt: { $gte: today, $lt: tomorrow },
      });

      const todayUnviewedCount = await storyDB.countDocuments({
        doctorId,
        view: false,
        createdAt: { $gte: today, $lt: tomorrow },
        payment_status: true,
        redirectStatus: false,
      });

      // Ko‘rilmagan bemorlarni topamiz
      const stories = await storyDB
        .find({
          doctorId,
          view: false,
          payment_status: true,
          redirectStatus: false,
        })
        .populate("patientId")
        .sort({ startTime: 1 });

      const patients = [];

      for (let story of stories) {
        // Shu doctor va shu bemorga oid boshqa tarixlar
        const visitHistoryData = await storyDB
          .find({
            doctorId,
            patientId: story.patientId._id,
            _id: { $ne: story._id }, // hozirgi yozuvdan tashqari
          })
          .sort({ startTime: -1 });

        const visitHistory = visitHistoryData.map((item) => ({
          date: item.startTime?.toISOString().split("T")[0],
          diagnosis: item.sickname || "Nomaʼlum tashxis",
        }));

        patients.push({
          _id: story._id,
          doctorId: story.doctorId,
          patientId: {
            _id: story.patientId._id,
            name: `${story.patientId.firstname} ${story.patientId.lastname}`,
            age: new Date().getFullYear() - Number(story.patientId.year),
            phone: story.patientId.phone,
            height: story.patientId.height,
            weight: story.patientId.weight,
            bloodGroup: story.patientId.bloodGroup,
            bmi: story.patientId.bmi,
          },
          paymentType: story.paymentType,
          payment_status: story.payment_status,
          payment_amount: story.payment_amount,
          sickname: story.sickname,
          view: story.view,
          order_number: story.order_number,
          startTime: story.startTime,
          services: story.services,
          visitHistory,
        });
      }

      const innerData = {
        patients,
        todayViewedCount,
        todayUnviewedCount,
      };

      return response.success(res, "Bemorlar topildi", innerData);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getPatientVisit(req, res) {
    const { doctorId, _id } = req.query;
    // Validate required parameters
    if (!doctorId || !_id) {
      return response.notFound(res, "Doktor ID va tashrif ID talab qilinadi");
    }

    try {
      // Fetch the specific visit (story) by _id and doctorId
      const story = await storyDB
        .findOne({ _id, doctorId, view: false })
        .populate("patientId");

      if (!story) {
        return response.notFound(
          res,
          "Tashrif topilmadi yoki allaqachon ko‘rilgan"
        );
      }

      // Fetch visit history for the same doctor and patient, excluding the current visit
      const visitHistoryData = await storyDB
        .find({
          doctorId,
          patientId: story.patientId._id,
          _id: { $ne: story._id },
        })
        .sort({ startTime: -1 });

      const visitHistory = visitHistoryData.map((item) => ({
        date: item.startTime.toISOString().split("T")[0],
        diagnosis: item.sickname || "Nomaʼlum tashxis",
      }));

      // Construct the patient data object
      const patientData = {
        _id: story._id,
        doctorId: story.doctorId,
        patientId: {
          _id: story.patientId._id,
          name: `${story.patientId.firstname} ${story.patientId.lastname}`,
          age: new Date().getFullYear() - Number(story.patientId.year),
          phone: story.patientId.phone,
          height: story.patientId.height,
          weight: story.patientId.weight,
          bloodGroup: story.patientId.bloodGroup,
          bmi: story.patientId.bmi,
          address: story.patientId.address,
          gender: story.patientId.gender,
        },
        paymentType: story.paymentType,
        payment_status: story.payment_status,
        payment_amount: story.payment_amount,
        sickname: story.sickname,
        description: story.description,
        view: story.view,
        order_number: story.order_number,
        startTime: story.startTime,
        services: story.services,
        visitHistory,
      };

      return response.success(res, "Bemor maʼlumotlari topildi", patientData);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async visitPatient(req, res) {
    try {
      const {
        diagnosis,
        prescriptions,
        recommendations,
        description,
        // reabilitationServices,
      } = req.body;
      const { id } = req.params;

      // Validate required fields
      if (!id) {
        return response.badRequest(res, "Story ID is required");
      }

      // Parse prescriptions safely
      let parsedPrescriptions = [];
      if (prescriptions) {
        try {
          parsedPrescriptions = JSON.parse(prescriptions);
          if (!Array.isArray(parsedPrescriptions)) {
            return response.badRequest(res, "Prescriptions must be an array");
          }
        } catch (error) {
          return response.badRequest(res, "Invalid prescriptions format");
        }
      }

      // Validate and initialize doseTracking for each prescription
      const validPrescriptions = parsedPrescriptions.map((p) => {
        const dosagePerDay = Number(p.dosagePerDay) || 0;
        const durationDays = Number(p.durationDays) || 0;
        const doseTracking = [];

        // Generate doseTracking entries for each day and dose
        for (let day = 1; day <= durationDays; day++) {
          for (let dose = 1; dose <= dosagePerDay; dose++) {
            doseTracking.push({
              day,
              doseNumber: dose,
              taken: false,
              timestamp: null,
            });
          }
        }

        return {
          medicationName: p.medicationName?.trim() || "",
          dosagePerDay,
          durationDays,
          description: p.description?.trim() || "",
          doseTracking,
        };
      });

      // Process uploaded files
      const files =
        req.files?.map((file) => ({
          filename: file.originalname,
          url: file.path,
        })) || [];

      // Update story with optimized fields
      const story = await storyDB.findByIdAndUpdate(
        id,
        {
          $set: {
            view: true,
            endTime: new Date(),
            retsept: {
              diagnosis: diagnosis?.trim() || "",
              prescription: validPrescriptions,
              recommendations: recommendations?.trim() || "",
            },
            description: description?.trim() || "",
            // reabilitationServices: JSON.parse(reabilitationServices) || [],
            files,
          },
        },
        { new: true, runValidators: true }
      );

      if (!story) {
        return response.notFound(res, "Story not found");
      }

      return response.success(res, "Visit completed successfully", story);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  async getAllPatientsStory(req, res) {
    try {
      const patients = await PatientModel.find().lean().exec();
      const patientIds = patients.map((patient) => patient._id);

      // Populate doctorId and patientId in stories
      const stories = await storyDB
        .find({ patientId: { $in: patientIds } })
        .populate("patientId") // Populate patientId
        .populate("doctorId") // Populate doctorId
        // .populate("reabilitationServices.serviceId") // Populate reabilitationServices.service
        .lean()
        .exec();

      const storyIds = stories.map((story) => story._id);

      // Populate storyId and its nested doctorId and patientId in laboratory results
      const laboratoryResults = await Labaratory.find({
        storyId: { $in: storyIds },
      })
        .populate({
          path: "storyId",
          populate: [
            { path: "doctorId" }, // Nested populate for doctorId
            { path: "patientId" }, // Nested populate for patientId
          ],
        })
        .lean()
        .exec();

      // Attach laboratory results to stories
      const storiesWithLab = stories.map((story) => ({
        ...story,
        laboratory: laboratoryResults.filter(
          (lab) => lab.storyId._id.toString() === story._id.toString()
        ),
      }));

      // Populate patientId and doctorId in roomStories
      const roomStories = await RoomStoryModel.find({
        patientId: { $in: patientIds },
      })
        .populate("patientId") // Populate patientId
        .populate("doctorId") // Populate doctorId
        .populate("roomId") // Optional: Populate roomId
        .lean()
        .exec();

      const result = patients.map((patient) => ({
        ...patient,
        stories: storiesWithLab.filter(
          (story) => story.patientId._id.toString() === patient._id.toString()
        ),
        roomStories: roomStories.filter(
          (roomStory) =>
            roomStory.patientId._id.toString() === patient._id.toString()
        ),
      }));

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching patients",
        error: error.message,
      });
    }
  }

  async getPatientStoryById(req, res) {
    try {
      const { patientId } = req.params;

      const patient = await PatientModel.findById(patientId).lean().exec();

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      // Populate doctorId and patientId in stories
      const stories = await storyDB
        .find({ patientId })
        .populate("patientId") // Populate patientId
        .populate("doctorId") // Populate doctorId
        .lean()
        .exec();

      const storyIds = stories.map((story) => story._id);

      // Populate storyId and its nested doctorId and patientId in laboratory results
      const laboratoryResults = await Labaratory.find({
        storyId: { $in: storyIds },
      })
        .populate({
          path: "storyId",
          populate: [
            { path: "doctorId" }, // Nested populate for doctorId
            { path: "patientId" }, // Nested populate for patientId
          ],
        })
        .lean()
        .exec();

      // Attach laboratory results to stories
      const storiesWithLab = stories.map((story) => ({
        ...story,
        laboratory: laboratoryResults.filter(
          (lab) => lab.storyId._id.toString() === story._id.toString()
        ),
      }));

      // Populate patientId and doctorId in roomStories
      const roomStories = await RoomStoryModel.find({ patientId })
        .populate("patientId") // Populate patientId
        .populate("doctorId") // Populate doctorId
        .populate("roomId") // Optional: Populate roomId
        .lean()
        .exec();

      const result = {
        ...patient,
        stories: storiesWithLab,
        roomStories,
      };

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching patient",
        error: error.message,
      });
    }
  }

  async getPatientsStoryByDoctorId(req, res) {
    try {
      const { doctorId } = req.params;

      // Populate patientId and doctorId in stories
      const stories = await storyDB
        .find({ doctorId })
        .populate("patientId") // Populate patientId
        .populate("doctorId") // Populate doctorId
        .lean()
        .exec();

      const storyIds = stories.map((story) => story._id);

      // Populate storyId and its nested doctorId and patientId in laboratory results
      const laboratoryResults = await Labaratory.find({
        storyId: { $in: storyIds },
      })
        .populate({
          path: "storyId",
          populate: [
            { path: "doctorId" }, // Nested populate for doctorId
            { path: "patientId" }, // Nested populate for patientId
          ],
        })
        .lean()
        .exec();

      // Attach laboratory results to stories
      const storiesWithLab = stories.map((story) => ({
        ...story,
        laboratory: laboratoryResults.filter(
          (lab) => lab.storyId._id.toString() === story._id.toString()
        ),
      }));

      // Populate patientId and doctorId in roomStories
      const roomStories = await RoomStoryModel.find({ doctorId })
        .populate("patientId") // Populate patientId
        .populate("doctorId") // Populate doctorId
        .populate("roomId") // Optional: Populate roomId
        .lean()
        .exec();

      const patientIds = [
        ...new Set([
          ...stories.map((story) => story.patientId._id.toString()),
          ...roomStories.map((roomStory) => roomStory.patientId._id.toString()),
        ]),
      ];

      const patients = await PatientModel.find({ _id: { $in: patientIds } })
        .lean()
        .exec();

      const result = patients.map((patient) => ({
        ...patient,
        stories: storiesWithLab.filter(
          (story) => story.patientId._id.toString() === patient._id.toString()
        ),
        roomStories: roomStories.filter(
          (roomStory) =>
            roomStory.patientId._id.toString() === patient._id.toString()
        ),
      }));

      if (!result.length)
        return res.status(404).json({
          success: false,
          message: "Bemorlar topilmadi",
        });

      return res.status(200).json({
        success: true,
        message: "Bemorlar topildi",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        error: err,
      });
    }
  }

  //==========================================

  async submitAnalis(req, res) {
    try {
      const { storyId, results } = req.body;

      // Validate request body
      if (!storyId || !Array.isArray(results) || results.length === 0) {
        return response.badRequest(
          res,
          "Noto‘g‘ri so‘rov: storyId va bo‘sh bo‘lmagan results massivi talab qilinadi"
        );
      }

      // Validate results array structure
      const validResults = results.every(
        (item) =>
          item.key &&
          item.name &&
          item.result &&
          typeof item.result === "string"
      );

      if (!validResults) {
        return response.badRequest(
          res,
          "Noto‘g‘ri results formati: har bir element key, name va result (string sifatida) bo‘lishi kerak"
        );
      }

      // Save to database using Labaratory model (corrected from PatientModel)
      const labaratory = new Labaratory({
        storyId,
        results,
      });

      const result = await labaratory.save();

      return response.success(
        res,
        "Maʼlumotlar muvaffaqiyatli saqlandi",
        result
      );
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // =========================================

  async updateDoseTaken(req, res) {
    try {
      const { storyId, prescriptionIndex, doseTrackingIndex, workerId } =
        req.params;

      // Validate required parameters
      if (
        !storyId ||
        prescriptionIndex === undefined ||
        doseTrackingIndex === undefined
      ) {
        return response.badRequest(
          res,
          "Story ID, prescription index, va dose tracking index talab qilinadi"
        );
      }

      // Find the story by ID
      const story = await storyDB.findById(storyId);
      if (!story) {
        return response.notFound(res, "Tashrif topilmadi");
      }

      // Check if prescription and doseTracking exist
      const prescription = story.retsept.prescription[prescriptionIndex];
      if (!prescription) {
        return response.badRequest(res, "Retsept topilmadi");
      }

      const dose = prescription.doseTracking[doseTrackingIndex];
      if (!dose) {
        return response.badRequest(res, "Dose tracking topilmadi");
      }

      // Toggle the taken status and update timestamp if taken is set to true
      dose.taken = !dose.taken;
      if (dose.taken) {
        dose.timestamp = new Date();
        // Save workerId if provided
        if (workerId) {
          dose.workerId = workerId;
        }
      } else {
        dose.timestamp = null; // Clear timestamp when untaken
        // Clear workerId when untaken, if it exists
        if (dose.workerId) {
          dose.workerId = null;
        }
      }

      // Save the updated story
      await story.save();

      return response.success(res, "Dose taken holati yangilandi", {
        medicationName: prescription.medicationName,
        doseTracking: prescription.doseTracking,
      });
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new StoryController();
