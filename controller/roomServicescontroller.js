const RoomServices = require("../model/roomServicesModel");
const responses = require("../utils/response");

class RoomServicesController {
  async createRoomServices(req, res) {
    try {
      const { name, price } = req.body;
      if (!name) {
        return responses.error(res, "Xizmat nomi kiritilishi shart");
      }

      let roomServices = await RoomServices.create({ name, price });
      if (!roomServices) {
        return responses.success(res, "Xizmat qo'shildi", roomServices);
      }
      return responses.success(res, "Xizmat qo'shildi", roomServices);
    } catch (error) {
      return responses.error(res, error, error.message);
    }
  }

  async getRoomServices(req, res) {
    try {
      let roomServices = await RoomServices.find();
      if (!roomServices) {
        return responses.error(res, "Xizmatlar topilmadi");
      }
      return responses.success(res, "Xizmatlar", roomServices);
    } catch (error) {
      return responses.error(res, error, error.message);
    }
  }

  async updateRoomServices(req, res) {
    try {
      const { id } = req.params;
      const { name, price } = req.body;
      let roomServices = await RoomServices.findByIdAndUpdate(
        id,
        { name, price },
        { new: true }
      );
      if (!roomServices) {
        return responses.error(res, "Xizmat topilmadi");
      }
      return responses.success(res, "Xizmat o'zgartirildi", roomServices);
    } catch (error) {
      return responses.error(res, error, error.message);
    }
  }

  async deleteRoomServices(req, res) {
    try {
      const { id } = req.params;
      let roomServices = await RoomServices.findByIdAndDelete(id);
      if (!roomServices) {
        return responses.error(res, "Xizmat topilmadi");
      }
      return responses.success(res, "Xizmat o'chirildi", roomServices);
    } catch (error) {
      return responses.error(res, error, error.message);
    }
  }
}

module.exports = new RoomServicesController();
