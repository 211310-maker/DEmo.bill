const axios = require("axios");
const logger = require("../logger");

const sendSms = async (mobileNo, message) => {
  if (!mobileNo || !message) return false;

  try {
    if (process.env.REDSMS_API_KEY) {
      await axios.get(
        `http://login.redsms.in/api/smsapi?key=${process.env.REDSMS_API_KEY}&route=2&sender=UVAHAN&number=${mobileNo}&sms=${encodeURIComponent(
          message
        )}`
      );
    } else {
      logger.info(`SMS to ${mobileNo}: ${message}`);
    }
    return true;
  } catch (error) {
    logger.error(`Failed to send SMS to ${mobileNo}: ${error.message}`);
    return false;
  }
};

module.exports = { sendSms };
