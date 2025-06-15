const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const patientValidation = (req, res, next) => {
    const schema = {
        type: "object",
        required: ["firstname", "lastname", "phone", "year"],
        properties: {
            firstname: {
                type: "string",
                minLength: 2,
                errorMessage: {
                    type: "Ism faqat matn bo'lishi kerak",
                    minLength: "Ism kamida 2 ta belgidan iborat bo'lishi kerak",
                },
            },
            lastname: {
                type: "string",
                minLength: 2,
                errorMessage: {
                    type: "Familiya faqat matn bo'lishi kerak",
                    minLength: "Familiya kamida 2 ta belgidan iborat bo'lishi kerak",
                },
            },
            idNumber: {
                type: "string",
                minLength: 5,
                maxLength: 30,
                nullable: true,
                errorMessage: {
                    type: "ID raqam noto‘g‘ri formatda",
                },
            },
            phone: {
                type: "string",
                pattern: "^[0-9]{9,15}$",
                errorMessage: {
                    type: "Telefon raqam noto‘g‘ri formatda",
                    pattern: "Telefon raqam faqat raqamlardan iborat bo‘lishi kerak va 9-15 raqam oralig‘ida bo‘lishi kerak",
                },
            },
            address: {
                type: "string",
                minLength: 3,
                errorMessage: {
                    type: "Manzil noto‘g‘ri",
                    minLength: "Manzil kamida 3 ta belgidan iborat bo‘lishi kerak",
                },
            },
            year: {
                type: "string",
                pattern: "^[0-9]{4}$",
                errorMessage: {
                    type: "Yil noto‘g‘ri formatda",
                    pattern: "Yil 4 xonali raqam bo‘lishi kerak",
                },
            },
            treating: {
                type: "boolean",
                nullable: true,
            },
            debtor: {
                type: "boolean",
                nullable: true,
            },
            gender: {
                type: "string",
                enum: ["male", "female"],
                errorMessage: {
                    enum: "Jins 'male' yoki 'female' bo'lishi kerak",
                },
            },
            height: {
                type: "number",
                minimum: 30,
                maximum: 250,
                nullable: true,
                errorMessage: {
                    type: "Bo‘y noto‘g‘ri formatda",
                    minimum: "Bo‘y 30 sm dan kam bo‘lmasligi kerak",
                    maximum: "Bo‘y 250 sm dan oshmasligi kerak",
                },
            },
            weight: {
                type: "number",
                minimum: 1,
                maximum: 500,
                nullable: true,
                errorMessage: {
                    type: "Vazn noto‘g‘ri formatda",
                    minimum: "Vazn 1 kg dan kam bo‘lmasligi kerak",
                    maximum: "Vazn 500 kg dan oshmasligi kerak",
                },
            },
            bmi: {
                type: "number",
                minimum: 5,
                maximum: 100,
                nullable: true,
                errorMessage: {
                    type: "BMI noto‘g‘ri formatda",
                },
            },
            bloodGroup: {
                type: "string",
                enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
                nullable: true,
                errorMessage: {
                    enum: "Qon guruhi noto‘g‘ri. Masalan: A+, O-, AB+ va hokazo",
                },
            },
        },
        additionalProperties: false,
    };

    const validate = ajv.compile(schema);
    const valid = validate(req.body);
    if (!valid) {
        return response.error(res, 400, validate.errors[0].message);
    }

    next();
};

module.exports = patientValidation;
