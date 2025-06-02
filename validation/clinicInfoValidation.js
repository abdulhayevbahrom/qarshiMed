const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const clinicInfoValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      clinicName: { type: "string", minLength: 2, maxLength: 100 },
      startTime: { type: "string", minLength: 1, maxLength: 20 },
      endTime: { type: "string", minLength: 1, maxLength: 20 },
      address: { type: "string", minLength: 2, maxLength: 200 },
      phone: { type: "string", minLength: 7, maxLength: 20 },
      logo: { type: "string" },
    },
    required: ["clinicName", "startTime", "endTime", "address", "phone"],
    additionalProperties: false,
    errorMessage: {
      required: {
        clinicName: "Klinika nomi kiritish shart",
        startTime: "Ish boshlanish vaqti kiritish shart",
        endTime: "Ish tugash vaqti kiritish shart",
        address: "Manzil kiritish shart",
        phone: "Telefon raqam kiritish shart",
      },
      properties: {
        clinicName: "Klinika nomi 2-100 ta belgi oralig‘ida bo‘lishi kerak",
        startTime: "Ish boshlanish vaqti noto‘g‘ri formatda",
        endTime: "Ish tugash vaqti noto‘g‘ri formatda",
        address: "Manzil 2-200 ta belgi oralig‘ida bo‘lishi kerak",
        phone: "Telefon raqam 7-20 ta belgi oralig‘ida bo‘lishi kerak",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    let errorField = validate.errors[0].instancePath.replace("/", "");
    let errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }
  next();
};

module.exports = clinicInfoValidation;
