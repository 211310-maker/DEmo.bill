const bcrypt = require("bcryptjs");

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

const compareOtp = (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

module.exports = {
  generateOtp,
  hashOtp,
  compareOtp,
};
