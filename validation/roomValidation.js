const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const roomValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      roomNumber: { type: "number" },
      floor: { type: "number" },
      usersNumber: { type: "number" },
      pricePerDay: { type: "number" },
      category: { type: "string", enum: ["luxury", "standard", "econom"] },
    },
    required: ["roomNumber", "floor", "usersNumber", "pricePerDay", "category"],
    additionalProperties: false,
    errorMessage: {
      required: {
        roomNumber: "Xona raqami kiritish shart",
        floor: "Qavat kiritish shart",
        usersNumber: "Foydalanuvchilar soni kiritish shart",
        pricePerDay: "Kunlik narx kiritish shart",
        category: "Kategoriya kiritish shart",
      },
      properties: {
        roomNumber: "Xona raqami son bo'lishi kerak",
        floor: "Qavat son bo'lishi kerak",
        usersNumber: "Foydalanuvchilar soni son bo'lishi kerak",
        pricePerDay: "Kunlik narx son bo'lishi kerak",
        category: "Kategoriya noto'g'ri",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    let errorField =
      validate.errors[0].instancePath.replace("/", "") || "Umumiy";
    let errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }
  next();
};

module.exports = roomValidation;
