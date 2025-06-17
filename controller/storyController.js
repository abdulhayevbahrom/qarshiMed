const response = require("../utils/response");
const storyDB = require("../model/storyModel");
const PatientModel = require("../model/patientModel");
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
        startTime: { $gte: today, $lt: tomorrow },
      });

      const todayUnviewedCount = await storyDB.countDocuments({
        doctorId,
        view: false,
        startTime: { $gte: today, $lt: tomorrow },
      });

      // Ko‘rilmagan bemorlarni topamiz
      const stories = await storyDB
        .find({ doctorId, view: false })
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
      const { diagnosis, prescription, recommendations, description } =
        req.body;

      const files = req.files.map((file) => ({
        filename: file.originalname,
        url: file.path,
      }));

      // Mana shu yerda bemorga qo‘shiladi
      const retsept = {
        diagnosis,
        prescription,
        recommendations,
      };

      const story = await storyDB.findByIdAndUpdate(
        req.params.id,
        {
          view: true,
          endTime: new Date(),
          retsept,
          description,
          files,
        },
        { new: true }
      );

      if (!story) {
        return response.notFound(res, "Tashrif topilmadi");
      }

      return response.success(res, "Tashrif ko‘rib chiqildi", story);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  //==========================================

  async getAllPatientsStory(req, res) {
    try {
      const patients = await PatientModel.find()
        .lean()
        .exec();

      const patientIds = patients.map(patient => patient._id);

      const stories = await storyDB.find({ patientId: { $in: patientIds } })
        .lean()
        .exec();

      const roomStories = await RoomStoryModel.find({ patientId: { $in: patientIds } })
        .lean()
        .exec();

      const result = patients.map(patient => ({
        ...patient,
        stories: stories.filter(story => story.patientId.toString() === patient._id.toString()),
        roomStories: roomStories.filter(roomStory => roomStory.patientId.toString() === patient._id.toString()),
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

  // Get patient by ID with their stories and room stories
  async getPatientStoryById(req, res) {
    try {
      const { patientId } = req.params;

      const patient = await PatientModel.findById(patientId)
        .lean()
        .exec();

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      const stories = await storyDB.find({ patientId })
        .lean()
        .exec();

      const roomStories = await RoomStoryModel.find({ patientId })
        .lean()
        .exec();

      const result = {
        ...patient,
        stories,
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

  // Get all patients by doctor ID with their stories and room stories
  async getPatientsStoryByDoctorId(req, res) {
    try {
      const { doctorId } = req.params;

      const stories = await storyDB.find({ doctorId })
        .lean()
        .exec();

      const roomStories = await RoomStoryModel.find({ doctorId })
        .lean()
        .exec();

      const patientIds = [
        ...new Set([
          ...stories.map(story => story.patientId.toString()),
          ...roomStories.map(roomStory => roomStory.patientId.toString()),
        ]),
      ];

      const patients = await PatientModel.find({ _id: { $in: patientIds } })
        .lean()
        .exec();

      const result = patients.map(patient => ({
        ...patient,
        stories: stories.filter(story => story.patientId.toString() === patient._id.toString()),
        roomStories: roomStories.filter(roomStory => roomStory.patientId.toString() === patient._id.toString()),
      }));

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching patients by doctor",
        error: error.message,
      });
    }
  }
}

module.exports = new StoryController();
