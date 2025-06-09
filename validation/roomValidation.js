const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const roomValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      roomNumber: {
        type: "number",
        minimum: 1,
      },
      floor: {
        type: "number",
        minimum: 0,
      },
      usersNumber: {
        type: "number",
        minimum: 1,
      },
      beds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            status: {
              type: "string",
            enum: ["bo'sh", "band", "toza emas", "toza"],
            },
            comment: {
              type: "string",
              maxLength: 500,
            },
          },
          required: ["status"],
          additionalProperties: false,
        },
        default: [], // Matches schema default
      },
      nurse: {
        type: "string",
        pattern: "^[0-9a-fA-F]{24}$", // MongoDB ObjectId
      },
      cleaner: {
        type: "string",
        pattern: "^[0-9a-fA-F]{24}$", // MongoDB ObjectId
      },
      capacity: {
        type: "array",
        items: {
          type: "string",
          pattern: "^[0-9a-fA-F]{24}$", // MongoDB ObjectId
        },
        default: [], // Matches schema default
      },
      pricePerDay: {
        type: "number",
        minimum: 0,
      },
      category: {
        type: "string",
        enum: ["luxury", "standard", "econom"],
      },
      closeRoom: {
        type: "boolean",
        default: false, // Matches schema default
      },
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
        roomNumber: "Xona raqami musbat son bo'lishi kerak",
        floor: "Qavat 0 yoki undan yuqori son bo'lishi kerak",
        usersNumber: "Foydalanuvchilar soni musbat son bo'lishi kerak",
        beds: "Yotoqlar ro'yxati noto'g'ri formatda",
        "beds/status": "Yotoq holati faqat Bo'sh, Band, Toza emas yoki Toza bo'lishi mumkin",
        "beds/comment": "Izoh 500 belgidan oshmasligi kerak",
        nurse: "Hamshira ID si noto'g'ri formatda",
        cleaner: "Tozalovchi ID si noto'g'ri formatda",
        capacity: "Xona tarixi ID lari noto'g'ri formatda",
        pricePerDay: "Kunlik narx musbat son bo'lishi kerak",
        category: "Kategoriya faqat luxury, standard yoki econom bo'lishi mumkin",
        closeRoom: "Xona yopiq holati boolean bo'lishi kerak",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    let errorField = validate.errors[0].instancePath.replace("/", "") || "Umumiy";
    let errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }
  next();
};

module.exports = roomValidation;